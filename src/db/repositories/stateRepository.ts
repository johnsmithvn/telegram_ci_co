import { query } from "../postgres";
import { AddFlowStep, DeleteFlowStep, UserState, UserStatus } from "../../types/domain";

interface StateRow {
  user_id: string;
  status: UserStatus;
  last_kpi_warning_week_start: string | Date | null;
  last_forgot_checkout_prompt_date: string | Date | null;
  last_target_met_week_start: string | Date | null;
  manual_entry_pending_session_id: string | null;
  manual_entry_pending_date: string | Date | null;
  add_flow_step: AddFlowStep;
  add_flow_date: string | Date | null;
  add_flow_start_time: string | null;
  add_flow_start_hour: number | null;
  add_flow_end_hour: number | null;
  delete_flow_step: DeleteFlowStep;
  delete_flow_date: string | Date | null;
  updated_at: Date;
}

function normalizeDateOnly(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.toISOString().slice(0, 10);
}

function normalizeTimeOnly(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 5);
}

function mapState(row: StateRow): UserState {
  return {
    userId: row.user_id,
    status: row.status,
    lastKpiWarningWeekStart: normalizeDateOnly(row.last_kpi_warning_week_start),
    lastForgotCheckoutPromptDate: normalizeDateOnly(row.last_forgot_checkout_prompt_date),
    lastTargetMetWeekStart: normalizeDateOnly(row.last_target_met_week_start),
    manualEntryPendingSessionId: row.manual_entry_pending_session_id,
    manualEntryPendingDate: normalizeDateOnly(row.manual_entry_pending_date),
    addFlowStep: row.add_flow_step,
    addFlowDate: normalizeDateOnly(row.add_flow_date),
    addFlowStartTime: normalizeTimeOnly(row.add_flow_start_time),
    addFlowStartHour: row.add_flow_start_hour,
    addFlowEndHour: row.add_flow_end_hour,
    deleteFlowStep: row.delete_flow_step,
    deleteFlowDate: normalizeDateOnly(row.delete_flow_date),
    updatedAt: row.updated_at
  };
}

function firstRowOrThrow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(`Missing row: ${label}`);
  }
  return row;
}

async function ensureState(userId: string): Promise<void> {
  await query(
    `
      INSERT INTO user_state (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
}

export async function getState(userId: string): Promise<UserState> {
  await ensureState(userId);
  const result = await query<StateRow>(
    `
      SELECT user_id, status, last_kpi_warning_week_start, last_forgot_checkout_prompt_date,
             last_target_met_week_start,
             manual_entry_pending_session_id, manual_entry_pending_date,
             add_flow_step, add_flow_date, add_flow_start_time, add_flow_start_hour, add_flow_end_hour, updated_at
                  , delete_flow_step, delete_flow_date
      FROM user_state
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );
  return mapState(firstRowOrThrow(result.rows, "getState"));
}

export async function setStatus(userId: string, status: UserStatus): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET status = $2
      WHERE user_id = $1
    `,
    [userId, status]
  );
}

export async function setPendingManualEntry(
  userId: string,
  sessionId: string | null,
  pendingDate: string | null
): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET manual_entry_pending_session_id = $2,
          manual_entry_pending_date = $3
      WHERE user_id = $1
    `,
    [userId, sessionId, pendingDate]
  );
}

export async function markForgotCheckoutPrompt(userId: string, date: string): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET last_forgot_checkout_prompt_date = $2
      WHERE user_id = $1
    `,
    [userId, date]
  );
}

export async function setKpiWarningWeek(userId: string, weekStartDate: string): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET last_kpi_warning_week_start = $2
      WHERE user_id = $1
    `,
    [userId, weekStartDate]
  );
}

export async function setTargetMetWeek(userId: string, weekStartDate: string): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET last_target_met_week_start = $2
      WHERE user_id = $1
    `,
    [userId, weekStartDate]
  );
}

export async function setAddFlowState(
  userId: string,
  step: AddFlowStep,
  date: string | null = null,
  startTime: string | null = null,
  startHour: number | null = null,
  endHour: number | null = null
): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET add_flow_step = $2,
          add_flow_date = $3,
          add_flow_start_time = $4,
          add_flow_start_hour = $5,
          add_flow_end_hour = $6
      WHERE user_id = $1
    `,
    [userId, step, date, startTime, startHour, endHour]
  );
}

export async function setDeleteFlowState(
  userId: string,
  step: DeleteFlowStep,
  date: string | null = null
): Promise<void> {
  await ensureState(userId);
  await query(
    `
      UPDATE user_state
      SET delete_flow_step = $2,
          delete_flow_date = $3
      WHERE user_id = $1
    `,
    [userId, step, date]
  );
}
