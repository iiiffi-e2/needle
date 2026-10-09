"use client";

import { useEffect, useState } from "react";
import { RoomCard } from "./RoomCard";
import type { RoomWithStats } from "@/lib/types";
import { partitionRooms } from "@/lib/room-liveness";
import Link from "next/link";

export function RoomDirectory() {
  const [rooms, setRooms] = useState<RoomWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data) => {
        setRooms(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/rooms", { method: "PUT" });
      const data = await res.json();
      if (data.created?.length > 0) {
        const roomsRes = await fetch("/api/rooms");
        const roomsData = await roomsRes.json();
        setRooms(Array.isArray(roomsData) ? roomsData : []);
      }
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="glass-card rounded-2xl p-5 h-48 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🪡</p>
        <h2 className="text-xl font-semibold mb-2">No rooms yet</h2>
        <p className="text-muted mb-6">
          Be the first to open a door, or seed the example rooms.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/rooms/create"
            className="bg-accent text-background px-6 py-2.5 rounded-full font-medium hover:bg-accent/90 transition-colors"
          >
            Create Room
          </Link>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="bg-surface-light text-foreground px-6 py-2.5 rounded-full font-medium hover:bg-surface-light/80 transition-colors disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Seed Example Rooms"}
          </button>
        </div>
      </div>
    );
  }

  const { spinning, open, quiet } = partitionRooms(rooms);
  const sections = [
    { heading: "Spinning right now", rooms: spinning },
    { heading: "Booth is open", rooms: open },
    { heading: "Quiet rooms", rooms: quiet },
  ];

  return (
    <div className="space-y-10">
      {sections.map(
        (section) =>
          section.rooms.length > 0 && (
            <div key={section.heading}>
              <h2 className="font-display text-xl font-extrabold mb-4">
                {section.heading}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.rooms.map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}
