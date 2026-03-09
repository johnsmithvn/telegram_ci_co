import { PoolClient, QueryResultRow } from "pg";
import { query } from "../postgres";
import { WorkSession, WorkSessionSource } from "../../types/domain";

type Queryable = PoolClient;

interface SessionRow {
  id: string;
  user_id: string;
  start_time: Date;
  end_time: Date | null;
  duration_minutes: number | null;
  work_date: string;
  source: WorkSessionSource;
  status: "OPEN" | "CLOSED";
  created_at: Date;
  updated_at: Date;
}

interface OpenSessionWithUserRow extends SessionRow {
  chat_id: string;
  telegram_id: string;
  name: string | null;
}

function mapSession(row: SessionRow): WorkSession {
  return {
    id: row.id,
    userId: row.user_id,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    workDate: row.work_date,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function execute<T extends QueryResultRow>(
  sql: string,
  params: unknown[] | undefined,
  client?: Queryable
): Promise<{ rows: T[] }> {
  if (client) {
    const result = await client.query<T>(sql, params);
    return { rows: result.rows };
  }
  const result = await query<T>(sql, params);
  return { rows: result.rows };
}

function firstRowOrThrow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(`Missing row: ${label}`);
  }
  return row;
}

export async function findOpenSession(userId: string, client?: Queryable): Promise<WorkSession | null> {
  const result = await execute<SessionRow>(
    `
      SELECT id, user_id, start_time, end_time, duration_minutes, work_date, source, status, created_at, updated_at
      FROM work_sessions
      WHERE user_id = $1 AND status = 'OPEN'
      LIMIT 1
    `,
    [userId],
    client
  );
  return result.rows[0] ? mapSession(result.rows[0]) : null;
}

export async function createOpenSession(
  userId: string,
  startTime: Date,
  workDate: string,
  source: WorkSessionSource = "normal",
  client?: Queryable
): Promise<WorkSession> {
  const result = await execute<SessionRow>(
    `
      INSERT INTO work_sessions (user_id, start_time, work_date, source, status)
      VALUES ($1, $2, $3, $4, 'OPEN')
      RETURNING id, user_id, start_time, end_time, duration_minutes, work_date, source, status, created_at, updated_at
    `,
    [userId, startTime, workDate, source],
    client
  );
  return mapSession(firstRowOrThrow(result.rows, "createOpenSession"));
}

export async function closeSession(
  sessionId: string,
  endTime: Date,
  durationMinutes: number,
  source: WorkSessionSource,
  workDate: string | null = null,
  client?: Queryable
): Promise<WorkSession> {
  const result = await execute<SessionRow>(
    `
      UPDATE work_sessions
      SET end_time = $2,
          duration_minutes = $3,
          source = $4,
          status = 'CLOSED',
          work_date = COALESCE($5, work_date)
      WHERE id = $1
      RETURNING id, user_id, start_time, end_time, duration_minutes, work_date, source, status, created_at, updated_at
    `,
    [sessionId, endTime, durationMinutes, source, workDate],
    client
  );
  return mapSession(firstRowOrThrow(result.rows, "closeSession"));
}

export async function insertClosedSession(input: {
  userId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  workDate: string;
  source: WorkSessionSource;
}): Promise<WorkSession> {
  const result = await query<SessionRow>(
    `
      INSERT INTO work_sessions (user_id, start_time, end_time, duration_minutes, work_date, source, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'CLOSED')
      RETURNING id, user_id, start_time, end_time, duration_minutes, work_date, source, status, created_at, updated_at
    `,
    [input.userId, input.startTime, input.endTime, input.durationMinutes, input.workDate, input.source]
  );
  return mapSession(firstRowOrThrow(result.rows, "insertClosedSession"));
}

export async function getWorkedMinutesInRange(userId: string, start: Date, end: Date): Promise<number> {
  const result = await query<{ total: string | null }>(
    `
      SELECT COALESCE(SUM(duration_minutes), 0)::text AS total
      FROM work_sessions
      WHERE user_id = $1
        AND status = 'CLOSED'
        AND start_time >= $2
        AND start_time <= $3
    `,
    [userId, start, end]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function getWorkedMinutesByDate(userId: string, workDate: string): Promise<number> {
  const result = await query<{ total: string | null }>(
    `
      SELECT COALESCE(SUM(duration_minutes), 0)::text AS total
      FROM work_sessions
      WHERE user_id = $1
        AND status = 'CLOSED'
        AND work_date = $2::date
    `,
    [userId, workDate]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function listOpenSessionsWithUsers(): Promise<
  Array<{
    session: WorkSession;
    user: {
      id: string;
      telegramId: string;
      chatId: string;
      name: string | null;
    };
  }>
> {
  const result = await query<OpenSessionWithUserRow>(
    `
      SELECT ws.id, ws.user_id, ws.start_time, ws.end_time, ws.duration_minutes,
             ws.work_date, ws.source, ws.status, ws.created_at, ws.updated_at,
             u.chat_id, u.telegram_id, u.name
      FROM work_sessions ws
      JOIN users u ON u.id = ws.user_id
      WHERE ws.status = 'OPEN'
      ORDER BY ws.start_time ASC
    `
  );

  return result.rows.map((row) => ({
    session: mapSession(row),
    user: {
      id: row.user_id,
      telegramId: row.telegram_id,
      chatId: row.chat_id,
      name: row.name
    }
  }));
}
