import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import { buildManualNoPendingMessage, buildManualPastDayAddedMessage } from "../services/reportService";
import {
  addManualSessionForDate,
  closeOpenSessionByManualHours,
  getTodayWorkedMinutes,
  getUserState,
  getWeeklySummary
} from "../services/sessionService";
import { formatMinutes } from "../utils/time";

export async function handleManualHoursForOpenSession(
  ctx: BotContext,
  hours: number,
  timezoneName: string
): Promise<boolean> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return false;
  }

  const state = await getUserState(user.id);
  const closeResult = await closeOpenSessionByManualHours(
    user.id,
    hours,
    timezoneName,
    state.manualEntryPendingDate
  );

  if (!closeResult) {
    return false;
  }

  const now = new Date();
  const [weekly, today] = await Promise.all([
    getWeeklySummary(user.id, now, timezoneName),
    getTodayWorkedMinutes(user.id, now, timezoneName)
  ]);

  const remainingLine =
    weekly.remainingMinutes > 0
      ? `Còn nợ: ${formatMinutes(weekly.remainingMinutes)}.`
      : `Đã vượt KPI: ${formatMinutes(Math.abs(weekly.remainingMinutes))}.`;

  await ctx.reply(
    [
      `Đã ghi nhận ${hours} tiếng cho phiên đang mở và đóng ca giúp bạn.`,
      `Hôm nay: ${formatMinutes(today)} / 44h.`,
      `Tuần này: ${formatMinutes(weekly.workedMinutes)} / 44h.`,
      remainingLine
    ].join("\n"),
    { ...buildMainKeyboard() }
  );

  return true;
}

export async function handleDirectManualAdd(
  ctx: BotContext,
  workDate: string,
  hours: number,
  timezoneName: string
): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  await addManualSessionForDate(user.id, workDate, hours, timezoneName);
  await ctx.reply(buildManualPastDayAddedMessage(workDate, hours), {
    ...buildMainKeyboard()
  });
}

export async function replyNoManualTarget(ctx: BotContext): Promise<void> {
  await ctx.reply(buildManualNoPendingMessage(), {
    ...buildMainKeyboard()
  });
}

