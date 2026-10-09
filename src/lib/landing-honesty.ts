export function formatListenerCount(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0";
  return Math.floor(total).toLocaleString("en-US");
}

export function landingMarquee(
  room: {
    name: string;
    current_track?: { title: string; artist?: string | null } | null;
  } | null
): string {
  const track = room?.current_track;
  if (!room || !track) return "THE BOOTH IS OPEN · ";
  if (track.artist) {
    return `NOW SPINNING · ${track.title} — ${track.artist} · ${room.name} · `;
  }
  return `NOW SPINNING · ${track.title} · ${room.name} · `;
}

export function heroDeckLabel(
  room: {
    current_dj?: { display_name: string | null } | null;
    current_track?: unknown | null;
  } | null
): string | null {
  if (!room?.current_track) return null;
  const name = room.current_dj?.display_name;
  if (name) return `${name} · ON DECK`;
  return "House · SPINNING";
}
