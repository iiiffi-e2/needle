import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <p className="text-5xl mb-4">🪡</p>
      <h1 className="text-2xl font-bold mb-2">Room not found</h1>
      <p className="text-muted mb-6">
        This door doesn&apos;t lead anywhere. Yet.
      </p>
      <Link
        href="/"
        className="bg-accent text-background px-6 py-2.5 rounded-full font-medium hover:bg-accent/90 transition-colors"
      >
        Back to Rooms
      </Link>
    </div>
  );
}
