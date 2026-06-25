"use client";

import { useState } from "react";

interface TrackSubmitFormProps {
  roomSlug: string;
  isDj: boolean;
  hasQueuedTrack: boolean;
}

export function TrackSubmitForm({
  roomSlug,
  isDj,
  hasQueuedTrack,
}: TrackSubmitFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isDj) return null;

  if (hasQueuedTrack) {
    return (
      <div className="glass-card rounded-2xl p-4 text-center">
        <p className="text-sm text-success">✓ Your track is queued</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/rooms/${roomSlug}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add track");
        return;
      }

      setSuccess(true);
      setUrl("");
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Add Your Track
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL..."
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {success && (
          <p className="text-xs text-success">Track added to queue!</p>
        )}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full bg-accent text-background py-2.5 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Adding..." : "Drop Track"}
        </button>
      </form>
    </div>
  );
}
