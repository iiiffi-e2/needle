"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          vibe: vibe.trim() || null,
          description: description.trim() || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create room");
        return;
      }

      router.push(`/rooms/${data.slug}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5 max-w-lg mx-auto">
      <div>
        <label className="block text-sm font-medium text-muted mb-1.5">
          Room Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Late Night Indie Funeral"
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-1.5">
          Vibe
        </label>
        <input
          type="text"
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          placeholder="Sad bangers for people who still believe in choruses"
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this room about?"
          rows={3}
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-1.5">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="indie, sad, late-night"
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full bg-accent text-background py-3 rounded-full font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Creating..." : "Open the Room"}
      </button>
    </form>
  );
}
