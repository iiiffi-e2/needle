import type { SupabaseClient } from "@supabase/supabase-js";

export const ENERGY_FLOOR = 24;
export const ENERGY_DEFAULT = 30;
export const DECAY_PER_SECOND = 1.4;

export const ENERGY_BUMP = {
  awesomeVote: 11,
  lameVote: -6,
  chat: 3,
  react: 5,
  reactFire: 6,
  dropTrack: 7,
  joinDeck: 8,
  joinRoom: 2,
} as const;

export function clampEnergy(value: number): number {
  return Math.min(100, Math.max(ENERGY_FLOOR, Math.round(value)));
}

export function getEffectiveEnergy(
  stored: number,
  updatedAt: string | null | undefined,
  now = Date.now()
): number {
  if (!updatedAt) return clampEnergy(stored);
  const elapsedSec = (now - new Date(updatedAt).getTime()) / 1000;
  if (elapsedSec <= 0) return clampEnergy(stored);
  return clampEnergy(stored - elapsedSec * DECAY_PER_SECOND);
}

export function energyLabel(energy: number): string {
  if (energy >= 80) return "Going off";
  if (energy >= 58) return "Heating up";
  if (energy >= 38) return "Good buzz";
  return "Warming up";
}

export function energyBarHeights(): string[] {
  return ["8px", "11px", "13px", "15px", "17px", "19px", "21px"];
}

interface RoomEnergyRow {
  room_energy: number;
  room_energy_updated_at: string;
}

export async function syncRoomEnergyDecay(
  supabase: SupabaseClient,
  roomId: string
): Promise<{ energy: number; updatedAt: string }> {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("room_energy, room_energy_updated_at")
    .eq("id", roomId)
    .single();

  const now = new Date().toISOString();

  if (error || !room || room.room_energy == null) {
    return { energy: ENERGY_DEFAULT, updatedAt: now };
  }

  const row = room as RoomEnergyRow;
  const effective = getEffectiveEnergy(
    row.room_energy,
    row.room_energy_updated_at
  );

  if (Math.abs(effective - row.room_energy) >= 0.5) {
    await supabase
      .from("rooms")
      .update({
        room_energy: effective,
        room_energy_updated_at: now,
      })
      .eq("id", roomId);
    return { energy: effective, updatedAt: now };
  }

  return { energy: effective, updatedAt: row.room_energy_updated_at };
}

export async function bumpRoomEnergy(
  supabase: SupabaseClient,
  roomId: string,
  delta: number
): Promise<number> {
  const { data: room } = await supabase
    .from("rooms")
    .select("room_energy, room_energy_updated_at")
    .eq("id", roomId)
    .single();

  if (!room) return ENERGY_DEFAULT;

  const row = room as RoomEnergyRow;
  const current = getEffectiveEnergy(
    row.room_energy,
    row.room_energy_updated_at
  );
  const next = clampEnergy(current + delta);

  await supabase
    .from("rooms")
    .update({
      room_energy: next,
      room_energy_updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  return next;
}
