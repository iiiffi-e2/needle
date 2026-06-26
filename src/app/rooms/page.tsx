import { Suspense } from "react";
import { Navbar } from "@/components/shared/Navbar";
import { RoomDirectory } from "@/components/room/RoomDirectory";

export default function RoomsPage() {
  return (
    <div className="min-h-screen venue-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight">
            Live rooms, right now
          </h1>
          <p className="text-muted text-lg max-w-xl">
            Walk into a room. Hear what everyone&apos;s hearing. Stay for one
            more song.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="glass-card rounded-2xl p-5 h-48 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <RoomDirectory />
        </Suspense>
      </main>
    </div>
  );
}
