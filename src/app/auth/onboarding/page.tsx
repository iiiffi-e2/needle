"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { NeedleLogo } from "@/components/shared/NeedleLogo";
import { AvatarColorPicker } from "@/components/profile/AvatarColorPicker";
import { CROWD_COLORS } from "@/lib/design-tokens";

function OnboardingForm() {
  const [color, setColor] = useState<string>(CROWD_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/rooms";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_color: color }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    window.location.assign(redirect);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center">
      <AvatarColorPicker value={color} onChange={setColor} />

      {error && <p className="text-sm text-danger mt-4">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-8 w-full max-w-xs btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
      >
        {loading ? "Saving..." : "Browse rooms"}
      </button>
    </form>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen venue-bg flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <NeedleLogo size={40} />
        <span className="font-display text-2xl font-extrabold">Needle</span>
      </Link>

      <div className="glass-card rounded-2xl p-8 w-full max-w-md text-center">
        <h1 className="font-display text-xl font-extrabold mb-1">
          Pick your color
        </h1>
        <p className="text-sm text-muted mb-8">
          This is how you&apos;ll appear in the crowd and on the decks.
        </p>

        <Suspense fallback={<div className="text-muted text-sm">Loading...</div>}>
          <OnboardingForm />
        </Suspense>
      </div>
    </div>
  );
}
