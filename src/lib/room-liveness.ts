import type { RoomWithStats } from "@/lib/types";

export type RoomLiveness = "spinning" | "open" | "quiet";

type LivenessInput = Pick<
  RoomWithStats,
  "listener_count" | "dj_count" | "current_track"
>;

export function roomLiveness(room: LivenessInput): RoomLiveness {
  const people = room.listener_count > 0 || room.dj_count > 0;
  if (!people) return "quiet";
  if (room.current_track) return "spinning";
  return "open";
}

export function partitionRooms<T extends LivenessInput & { name: string }>(
  rooms: T[]
): { spinning: T[]; open: T[]; quiet: T[] } {
  const spinning: T[] = [];
  const open: T[] = [];
  const quiet: T[] = [];

  for (const room of rooms) {
    const state = roomLiveness(room);
    if (state === "spinning") spinning.push(room);
    else if (state === "open") open.push(room);
    else quiet.push(room);
  }

  const byCrowd = (a: T, b: T) =>
    b.listener_count - a.listener_count || a.name.localeCompare(b.name);

  spinning.sort(byCrowd);
  open.sort(byCrowd);
  quiet.sort((a, b) => a.name.localeCompare(b.name));

  return { spinning, open, quiet };
}
