"use client";

import Link from "next/link";
import type { FriendWithPresence } from "@/lib/types";

interface FriendsOnTheFloorProps {
  friends: FriendWithPresence[];
  yourRooms: { id: string; name: string; slug: string }[];
}

export function FriendsOnTheFloor({ friends, yourRooms }: FriendsOnTheFloorProps) {
  if (friends.length === 0 && yourRooms.length === 0) return null;

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-14 pt-16 sm:pt-24 pb-2 bg-[var(--bg1)]">
      <h2 className="font-display font-extrabold text-[28px] tracking-[-0.02em] m-0 mb-4">
        Where people you know are
      </h2>
      <ul className="list-none m-0 p-0 flex flex-col gap-2">
        {friends.map((friend) => (
          <li key={friend.user.id}>
            <Link
              href={`/rooms/${friend.presence.roomSlug}`}
              className="text-[15px] font-bold text-[var(--glow2)] hover:underline"
            >
              {friend.user.display_name} is in {friend.presence.roomName}
            </Link>
          </li>
        ))}
        {yourRooms.map((room) => (
          <li key={room.id}>
            <Link
              href={`/rooms/${room.slug}`}
              className="text-[15px] font-bold text-[var(--glow2)] hover:underline"
            >
              {room.name} is spinning
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
