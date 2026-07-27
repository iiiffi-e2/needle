-- Stress-test bot flag + run control plane

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_stress_bot BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_is_stress_bot_idx
  ON public.users (id)
  WHERE is_stress_bot = TRUE;

CREATE TABLE IF NOT EXISTS public.stress_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL CHECK (status IN ('running', 'stopped', 'expired', 'failed')),
  mode TEXT NOT NULL DEFAULT 'presence' CHECK (mode IN ('presence', 'realtime')),
  primary_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  secondary_room_ids UUID[] NOT NULL DEFAULT '{}',
  total_listeners INTEGER NOT NULL CHECK (total_listeners > 0 AND total_listeners <= 250),
  per_room_counts JSONB NOT NULL DEFAULT '{}',
  bot_user_ids UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS stress_runs_one_running_idx
  ON public.stress_runs ((status))
  WHERE status = 'running';

ALTER TABLE public.stress_runs ENABLE ROW LEVEL SECURITY;
-- No policies: service role only
