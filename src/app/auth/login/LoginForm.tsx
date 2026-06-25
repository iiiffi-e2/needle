"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NeedleLogo } from "@/components/shared/NeedleLogo";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="min-h-screen venue-bg flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <NeedleLogo size={40} />
        <span className="font-display text-2xl font-extrabold">Needle</span>
      </Link>

      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h1 className="font-display text-xl font-extrabold mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-muted mb-6">
          Sign in to join the listening party.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5 font-medium">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5 font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
              required
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-muted text-center mt-6">
          No account?{" "}
          <Link href="/auth/signup" className="text-glow-soft font-bold hover:underline">
            Join Needle
          </Link>
        </p>
      </div>
    </div>
  );
}
