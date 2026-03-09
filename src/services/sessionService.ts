import dayjs from "dayjs";
import { PoolClient } from "pg";
import {
  closeSession,
  createOpenSession,
  findOpenSession,
  getWorkedMinutesByDate,
  getWorkedMinutesInRange,
  insertClosedSession,
  listOpenSessionsWithUsers
} from "../db/repositories/sessionRepository";
import {
  getState,
  markForgotCheckoutPrompt,
  setAddFlowState,
  setKpiWarningWeek,
  setPendingManualEntry
} from "../db/repositories/stateRepository";
import { getAllUsers, upsertUser } from "../db/repositories/userRepository";
import { withTransaction } from "../db/postgres";
import { logger } from "../logger";
import { User, UserState, WeeklySummary, WorkSession } from "../types/domain";
import {
  KPI_WARNING_THRESHOLD_MINUTES,
  WEEKLY_TARGET_MINUTES,
  getLocalDateString,
  getWeekBounds,
  getWeekStartDateString,
  getWeekdaysLeftForBurndown
} from "../utils/time";

interface TelegramProfile {
  telegramId: number;
  chatId: number;
  name: string | null;
}

function minutesBetween(start: Date, end: Date): number {
  const minutes = dayjs(end).diff(dayjs(start), "minute");
  return Math.max(1, minutes);
}

async function setWorkingStateTx(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `
      INSERT INTO user_state (
        user_id, status, manual_entry_pending_session_id, manual_entry_pending_date
      )
      VALUES ($1, 'working', NULL, NULL)
      ON CONFLICT (user_id)
      DO UPDATE SET
        status = 'working',
        manual_entry_pending_session_id = NULL,
        manual_entry_pending_date = NULL
    `,
    [userId]
  );
}

async function setIdleStateTx(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `
      INSERT INTO user_state (
        user_id, status, manual_entry_pending_session_id, manual_entry_pending_date
      )
      VALUES ($1, 'idle', NULL, NULL)
      ON CONFLICT (user_id)
      DO UPDATE SET
        status = 'idle',
        manual_entry_pending_session_id = NULL,
        manual_entry_pending_date = NULL
    `,
    [userId]
  );
}

export async function ensureUser(profile: TelegramProfile): Promise<User> {
  const user = await upsertUser({
    telegramId: profile.telegramId,
    chatId: profile.chatId,
    name: profile.name
  });
  await getState(user.id);
  return user;
}

export async function checkIn(userId: string, now: Date, timezoneName: string): Promise<{
  alreadyWorking: boolean;
  session: WorkSession;
}> {
  return withTransaction(async (client) => {
    const existingOpen = await findOpenSession(userId, client);
    if (existingOpen) {
      return { alreadyWorking: true, session: existingOpen };
    }

    const workDate = getLocalDateString(now, timezoneName);
    let created: WorkSession;

    try {
      created = await createOpenSession(userId, now, workDate, "normal", client);
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "23505") {
        const locked = await findOpenSession(userId, client);
        if (locked) {
          return { alreadyWorking: true, session: locked };
        }
      }
      throw error;
    }

    await setWorkingStateTx(client, userId);
    return { alreadyWorking: false, session: created };
  });
}

export async function checkOut(
  userId: string,
  now: Date
): Promise<{ session: WorkSession; workedMinutes: number } | null> {
  const closed = await withTransaction(async (client) => {
    const openSession = await findOpenSession(userId, client);
    if (!openSession) {
      return null;
    }
    const durationMinutes = minutesBetween(openSession.startTime, now);
    const done = await closeSession(openSession.id, now, durationMinutes, "normal", null, client);
    await setIdleStateTx(client, userId);
    return { session: done, workedMinutes: durationMinutes };
  });

  return closed;
}

export async function closeOpenSessionByManualHours(
  userId: string,
  hours: number,
  timezoneName: string,
  pendingDate?: string | null
): Promise<{ session: WorkSession; workedMinutes: number } | null> {
  const durationMinutes = Math.max(1, Math.round(hours * 60));
  return withTransaction(async (client) => {
    const openSession = await findOpenSession(userId, client);
    if (!openSession) {
      return null;
    }

    const endTime = dayjs(openSession.startTime).add(durationMinutes, "minute").toDate();
    const workDate = pendingDate ?? getLocalDateString(openSession.startTime, timezoneName);
    const done = await closeSession(openSession.id, endTime, durationMinutes, "manual", workDate, client);
    await setIdleStateTx(client, userId);
    return { session: done, workedMinutes: durationMinutes };
  });
}

export async function addManualSessionForDate(
  userId: string,
  workDate: string,
  hours: number,
  timezoneName: string
): Promise<WorkSession> {
  const durationMinutes = Math.max(1, Math.round(hours * 60));
  const startTime = dayjs.tz(`${workDate} 09:00`, timezoneName).toDate();
  const endTime = dayjs(startTime).add(durationMinutes, "minute").toDate();
  return insertClosedSession({
    userId,
    startTime,
    endTime,
    durationMinutes,
    workDate,
    source: "manual"
  });
}

export async function getWeeklySummary(userId: string, now: Date, timezoneName: string): Promise<WeeklySummary> {
  const bounds = getWeekBounds(now, timezoneName);
  const workedMinutes = await getWorkedMinutesInRange(userId, bounds.start, bounds.end);
  return {
    workedMinutes,
    targetMinutes: WEEKLY_TARGET_MINUTES,
    remainingMinutes: WEEKLY_TARGET_MINUTES - workedMinutes
  };
}

export async function getTodayWorkedMinutes(userId: string, now: Date, timezoneName: string): Promise<number> {
  const workDate = getLocalDateString(now, timezoneName);
  return getWorkedMinutesByDate(userId, workDate);
}

export async function getUserState(userId: string): Promise<UserState> {
  return getState(userId);
}

export async function beginAddFlow(userId: string): Promise<void> {
  await setAddFlowState(userId, "WAITING_DATE", null);
}

export async function setAddFlowDate(userId: string, workDate: string): Promise<void> {
  await setAddFlowState(userId, "WAITING_HOURS", workDate);
}

export async function clearAddFlow(userId: string): Promise<void> {
  await setAddFlowState(userId, "NONE", null);
}

export async function setPendingManual(userId: string, sessionId: string, date: string): Promise<void> {
  await setPendingManualEntry(userId, sessionId, date);
}

export async function clearPendingManual(userId: string): Promise<void> {
  await setPendingManualEntry(userId, null, null);
}

export async function markForgotPrompt(userId: string, date: string): Promise<void> {
  await markForgotCheckoutPrompt(userId, date);
}

export async function markKpiWarningSent(userId: string, now: Date, timezoneName: string): Promise<void> {
  const weekStart = getWeekStartDateString(now, timezoneName);
  await setKpiWarningWeek(userId, weekStart);
}

export async function shouldSendKpiWarning(userId: string, now: Date, timezoneName: string): Promise<boolean> {
  const state = await getState(userId);
  if (state.status !== "working") {
    return false;
  }

  const weekStart = getWeekStartDateString(now, timezoneName);
  if (state.lastKpiWarningWeekStart === weekStart) {
    return false;
  }

  const summary = await getWeeklySummary(userId, now, timezoneName);
  return summary.workedMinutes >= KPI_WARNING_THRESHOLD_MINUTES;
}

export async function getBurnDown(userId: string, now: Date, timezoneName: string): Promise<{
  remainingMinutes: number;
  daysLeft: number;
  requiredMinutesPerDay: number;
}> {
  const summary = await getWeeklySummary(userId, now, timezoneName);
  const daysLeft = getWeekdaysLeftForBurndown(now, timezoneName);
  const remainingMinutes = Math.max(0, summary.remainingMinutes);
  const requiredMinutesPerDay = daysLeft > 0 ? Math.ceil(remainingMinutes / daysLeft) : remainingMinutes;
  return { remainingMinutes, daysLeft, requiredMinutesPerDay };
}

export async function getAllTrackedUsers(): Promise<User[]> {
  return getAllUsers();
}

export async function getOpenSessionsForReminder(): Promise<
  Array<{
    session: WorkSession;
    user: { id: string; telegramId: string; chatId: string; name: string | null };
  }>
> {
  return listOpenSessionsWithUsers();
}

export async function safeUserSummary(userId: string, now: Date, timezoneName: string): Promise<WeeklySummary> {
  try {
    return await getWeeklySummary(userId, now, timezoneName);
  } catch (error) {
    logger.error({ error, userId }, "Failed to compute weekly summary");
    return {
      workedMinutes: 0,
      targetMinutes: WEEKLY_TARGET_MINUTES,
      remainingMinutes: WEEKLY_TARGET_MINUTES
    };
  }
}
