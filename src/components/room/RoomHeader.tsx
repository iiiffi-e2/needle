"use client";

import Link from "next/link";
import type { Room } from "@/lib/types";

interface RoomHeaderProps {
  room: Room;
  listenerCount: number;
}

export function RoomHeader({ room, listenerCount }: RoomHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl">🪡</span>
          <span className="font-semibold group-hover:text-accent transition-colors hidden sm:inline">
            Needle
          </span>
        </Link>
        <span className="text-muted">/</span>
        <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[200px] sm:max-w-none">
          {room.name}
        </h1>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
          {listenerCount} listening
        </span>
      </div>
    </header>
  );
}
