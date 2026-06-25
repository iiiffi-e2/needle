"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarColorPicker } from "@/components/profile/AvatarColorPicker";
import { resolveUserColor } from "@/lib/design-tokens";

interface ProfileColorSettingsProps {
  userId: string;
  initialColor: string | null;
}

export function ProfileColorSettings({
  userId,
  initialColor,
}: ProfileColorSettingsProps) {
  const router = useRouter();
  const [color, setColor] = useState(
    resolveUserColor(userId, initialColor)
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const hasChanges = color !== resolveUserColor(userId, initialColor);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_color: color }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save color.");
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        Avatar Color
      </h2>
      <AvatarColorPicker
        value={color}
        onChange={(c) => {
          setColor(c);
          setSaved(false);
        }}
        previewSize={80}
      />
      <div className="flex items-center justify-center gap-3 mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || !hasChanges}
          className="btn-primary px-5 py-2 rounded-full text-sm font-bold disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save color"}
        </button>
        {saved && (
          <span className="text-sm text-success">Saved!</span>
        )}
      </div>
      {error && <p className="text-sm text-danger text-center mt-2">{error}</p>}
    </div>
  );
}
