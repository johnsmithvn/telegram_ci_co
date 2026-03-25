import { query } from "../postgres";
import { User } from "../../types/domain";

interface UserRow {
  id: string;
  telegram_id: string;
  chat_id: string;
  name: string | null;
  is_active: boolean;
  created_at: Date;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    chatId: row.chat_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

function firstRowOrThrow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(`Missing row: ${label}`);
  }
  return row;
}

export async function upsertUser(input: {
  telegramId: number;
  chatId: number;
  name?: string | null;
}): Promise<User> {
  const result = await query<UserRow>(
    `
      INSERT INTO users (telegram_id, chat_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        chat_id = EXCLUDED.chat_id,
        name = EXCLUDED.name
      RETURNING id, telegram_id, chat_id, name, is_active, created_at
    `,
    [input.telegramId, input.chatId, input.name ?? null]
  );
  return mapUser(firstRowOrThrow(result.rows, "upsertUser"));
}

export async function reactivateUser(input: {
  telegramId: number;
  chatId: number;
  name?: string | null;
}): Promise<User> {
  const result = await query<UserRow>(
    `
      INSERT INTO users (telegram_id, chat_id, name, is_active, deactivated_at)
      VALUES ($1, $2, $3, TRUE, NULL)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        chat_id = EXCLUDED.chat_id,
        name = EXCLUDED.name,
        is_active = TRUE,
        deactivated_at = NULL
      RETURNING id, telegram_id, chat_id, name, is_active, created_at
    `,
    [input.telegramId, input.chatId, input.name ?? null]
  );
  return mapUser(firstRowOrThrow(result.rows, "reactivateUser"));
}

export async function getAllUsers(): Promise<User[]> {
  const result = await query<UserRow>(
    `
      SELECT id, telegram_id, chat_id, name, is_active, created_at
      FROM users
      WHERE is_active = TRUE
      ORDER BY created_at ASC
    `
  );
  return result.rows.map(mapUser);
}

export async function findUserByTelegramId(telegramId: number): Promise<User | null> {
  const result = await query<UserRow>(
    `
      SELECT id, telegram_id, chat_id, name, is_active, created_at
      FROM users
      WHERE telegram_id = $1
      LIMIT 1
    `,
    [telegramId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await query<UserRow>(
    `
      SELECT id, telegram_id, chat_id, name, is_active, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}
