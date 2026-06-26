"use client";

import { useState, Suspense, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NeedleLogo } from "@/components/shared/NeedleLogo";

function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const prefill = searchParams.get("email");
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="text-success text-lg mb-2">Account created.</p>
        <p className="text-sm text-muted mb-1">
          We sent a confirmation link to <span className="text-foreground">{email}</span>.
        </p>
        <p className="text-sm text-muted">
          Check your email and click the link to confirm your address before signing in.
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-6 text-sm text-glow-soft font-bold hover:underline"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <label className="block text-sm text-muted mb-1.5">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="DJ Handle"
          className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
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
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen venue-bg flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <NeedleLogo size={40} />
        <span className="font-display text-2xl font-extrabold">Needle</span>
      </Link>

      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h1 className="font-display text-xl font-extrabold mb-1">Join the party</h1>
        <p className="text-sm text-muted mb-6">
          Create an account to enter live music rooms.
        </p>

        <Suspense fallback={<div className="text-muted text-sm">Loading...</div>}>
          <SignupForm />
        </Suspense>

        <p className="text-sm text-muted text-center mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-glow-soft font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
