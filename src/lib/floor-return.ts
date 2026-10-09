import { PRESENCE_WINDOW_MS } from "@/lib/dj-booth";
import type { FriendWithPresence } from "@/lib/types";

export function friendsOnTheFloor(
  friends: FriendWithPresence[]
): FriendWithPresence[] {
  const rows = friends.filter(
    (friend) =>
      friend.presence.canJoin &&
      friend.presence.roomSlug &&
      friend.presence.roomId
  );
  rows.sort((a, b) => {
    const room = (a.presence.roomName ?? "").localeCompare(b.presence.roomName ?? "");
    if (room !== 0) return room;
    return (a.user.display_name ?? "").localeCompare(b.user.display_name ?? "");
  });
  return rows;
}

export function yourLiveRooms<T extends { id: string; name: string }>(
  spinning: T[],
  memberships: { roomId: string; lastSeen: string }[],
  nowMs: number,
  presenceWindowMs: number = PRESENCE_WINDOW_MS
): T[] {
  const cutoff = nowMs - presenceWindowMs;
  const latestSeen = new Map<string, number>();

  for (const membership of memberships) {
    const seen = Date.parse(membership.lastSeen);
    if (Number.isNaN(seen)) continue;
    const previous = latestSeen.get(membership.roomId);
    if (previous === undefined || seen > previous) {
      latestSeen.set(membership.roomId, seen);
    }
  }

  return spinning
    .filter((room) => {
      const seen = latestSeen.get(room.id);
      return seen !== undefined && seen < cutoff;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface FloorPing {
  id: string;
  href: string;
  label: string;
}

export function floorPingsFrom(
  friends: FriendWithPresence[],
  yourRooms: { id: string; name: string; slug: string }[]
): FloorPing[] {
  const friendPings: FloorPing[] = [];
  const announcedHrefs = new Set<string>();

  for (const friend of friendsOnTheFloor(friends)) {
    const slug = friend.presence.roomSlug;
    if (!slug) continue;
    const href = `/rooms/${slug}`;
    friendPings.push({
      id: `friend:${friend.user.id}`,
      href,
      label: `${friend.user.display_name || "A friend"} is in ${friend.presence.roomName ?? ""}`,
    });
    announcedHrefs.add(href);
  }

  const roomPings: FloorPing[] = [];
  for (const room of yourRooms) {
    const href = `/rooms/${room.slug}`;
    if (announcedHrefs.has(href)) continue;
    announcedHrefs.add(href);
    roomPings.push({
      id: `room:${room.id}`,
      href,
      label: `${room.name} is spinning`,
    });
  }

  return [...friendPings, ...roomPings];
}

export function nextFloorPings(
  previousIds: string[] | null,
  next: FloorPing[]
): FloorPing[] {
  if (previousIds === null) return [];
  const seen = new Set(previousIds);
  return next.filter((ping) => !seen.has(ping.id));
}
