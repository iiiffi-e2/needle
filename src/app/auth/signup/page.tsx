"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

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
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <p className="text-success text-lg mb-2">You&apos;re in.</p>
        <p className="text-sm text-muted">Redirecting to the rooms...</p>
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
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
        />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
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
          className="w-full bg-surface-light border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          required
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-background py-2.5 rounded-full font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="text-3xl">🪡</span>
        <span className="text-2xl font-semibold">Needle</span>
      </Link>

      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-1">Join the party</h1>
        <p className="text-sm text-muted mb-6">
          Create an account to enter live music rooms.
        </p>

        <Suspense fallback={<div className="text-muted text-sm">Loading...</div>}>
          <SignupForm />
        </Suspense>

        <p className="text-sm text-muted text-center mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-accent hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
