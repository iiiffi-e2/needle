-- Room energy: server-backed 0–100 vibe meter synced via realtime
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS room_energy INTEGER NOT NULL DEFAULT 30
    CHECK (room_energy >= 0 AND room_energy <= 100),
  ADD COLUMN IF NOT EXISTS room_energy_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
