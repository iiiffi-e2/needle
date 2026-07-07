"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function FriendsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/friends] render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen venue-bg flex flex-col items-center justify-center px-4">
      <p className="text-5xl mb-4">🪡</p>
      <h1 className="font-display text-2xl font-extrabold mb-2">
        Friends page failed to load
      </h1>
      <p className="text-muted mb-6 text-center max-w-md">
        Something went wrong loading your friends list. Try again, or head back
        to the rooms.
      </p>
      {error?.message && (
        <p className="text-xs text-danger mb-6 text-center max-w-md font-mono break-words">
          {error.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-primary px-6 py-2.5 rounded-full font-bold"
        >
          Try again
        </button>
        <Link
          href="/rooms"
          className="btn-secondary px-6 py-2.5 rounded-full font-medium"
        >
          Back to rooms
        </Link>
      </div>
    </div>
  );
}
