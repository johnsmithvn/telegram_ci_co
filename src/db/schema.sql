CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_session_source') THEN
    CREATE TYPE work_session_source AS ENUM ('normal', 'manual', 'auto');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_session_status') THEN
    CREATE TYPE work_session_status AS ENUM ('OPEN', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_presence_status') THEN
    CREATE TYPE user_presence_status AS ENUM ('idle', 'working');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'add_flow_step') THEN
    CREATE TYPE add_flow_step AS ENUM ('NONE', 'WAITING_DATE', 'WAITING_HOURS');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  chat_id BIGINT NOT NULL UNIQUE,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_active_idx
  ON users(is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  work_date DATE NOT NULL,
  source work_session_source NOT NULL DEFAULT 'normal',
  status work_session_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT non_negative_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS work_sessions_one_open_per_user
  ON work_sessions(user_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS work_sessions_user_start_time_idx
  ON work_sessions(user_id, start_time);

CREATE INDEX IF NOT EXISTS work_sessions_user_work_date_idx
  ON work_sessions(user_id, work_date);

CREATE TABLE IF NOT EXISTS user_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status user_presence_status NOT NULL DEFAULT 'idle',
  last_kpi_warning_week_start DATE,
  last_forgot_checkout_prompt_date DATE,
  last_target_met_week_start DATE,
  manual_entry_pending_session_id UUID REFERENCES work_sessions(id) ON DELETE SET NULL,
  manual_entry_pending_date DATE,
  add_flow_step add_flow_step NOT NULL DEFAULT 'NONE',
  add_flow_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_state
  ADD COLUMN IF NOT EXISTS last_target_met_week_start DATE;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_sessions_updated_at ON work_sessions;
CREATE TRIGGER trg_work_sessions_updated_at
BEFORE UPDATE ON work_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_state_updated_at ON user_state;
CREATE TRIGGER trg_user_state_updated_at
BEFORE UPDATE ON user_state
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
