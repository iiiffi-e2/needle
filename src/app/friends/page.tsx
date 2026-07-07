import Link from "next/link";
import { Navbar } from "@/components/shared/Navbar";
import { FriendsClient } from "@/components/friends/FriendsClient";

export default function FriendsPage() {
  return (
    <div className="min-h-screen venue-bg">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-extrabold mb-2">
            Friends
          </h1>
          <p className="text-muted">
            Keep up with your people, respond to requests, and find new listeners.
          </p>
        </div>
        <FriendsClient />
      </main>
    </div>
  );
}
