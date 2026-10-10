"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NeedleLogo } from "@/components/shared/NeedleLogo";
import { createClient } from "@/lib/supabase/client";
import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  emailSendError,
} from "@/lib/auth/auth-errors";
import { parseFediverseHandle } from "@/lib/auth/fediverse-handle";
import { oauthRedirectTo } from "@/lib/auth/safe-redirect";

type ContinueFormProps = {
  heading: string;
  lede: string;
  alternate: { prompt: string; href: string; label: string };
};

function providerCookie(provider: "google" | "apple" | "") {
  if (!provider) {
    document.cookie = "needle_auth_provider=; Path=/; Max-Age=0; SameSite=Lax";
    return;
  }
  document.cookie = `needle_auth_provider=${provider}; Path=/; Max-Age=600; SameSite=Lax`;
}

export function ContinueForm({ heading, lede, alternate }: ContinueFormProps) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [handle, setHandle] = useState(searchParams.get("handle") ?? "");
  const [fediOpen, setFediOpen] = useState(Boolean(searchParams.get("handle")));
  const [phase, setPhase] = useState<"form" | "sent">("form");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState(
    authErrorMessage(searchParams.get("error")) ?? ""
  );

  const startOAuth = async (provider: "google" | "apple") => {
    setLoading(provider);
    setError("");
    providerCookie(provider);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirectTo(redirect) },
    });
    if (oauthError) {
      setError(AUTH_ERROR_MESSAGES[provider]);
      setLoading(null);
    }
  };

  const sendLink = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setLoading("email");
    setError("");
    providerCookie("");
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: oauthRedirectTo(redirect),
        shouldCreateUser: true,
      },
    });
    if (otpError) {
      setError(AUTH_ERROR_MESSAGES[emailSendError(otpError.message)]);
      setLoading(null);
      return;
    }
    setPhase("sent");
    setLoading(null);
  };

  const startFediverse = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseFediverseHandle(handle);
    if (!parsed) {
      setError(AUTH_ERROR_MESSAGES.handle);
      return;
    }
    setLoading("fedi");
    setError("");
    const response = await fetch("/api/auth/fediverse/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, next: redirect }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!response.ok || !data.url) {
      setError(
        authErrorMessage(data.error) ?? AUTH_ERROR_MESSAGES.fedi_unsupported
      );
      setLoading(null);
      return;
    }
    window.location.assign(data.url);
  };

  return (
    <div className="min-h-screen venue-bg flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <NeedleLogo size={40} />
        <span className="font-display text-2xl font-extrabold">Needle</span>
      </Link>

      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h1 className="font-display text-xl font-extrabold mb-1">{heading}</h1>
        <p className="text-sm text-muted mb-6">{lede}</p>

        {phase === "sent" ? (
          <div className="text-center py-2">
            <p className="text-sm text-muted">
              Check your inbox. We sent a link to{" "}
              <span className="text-foreground">{email.trim()}</span>.
            </p>
            <button
              type="button"
              onClick={() => sendLink()}
              disabled={loading === "email"}
              className="mt-6 text-sm text-glow-soft font-bold hover:underline disabled:opacity-50"
            >
              {loading === "email" ? "Sending..." : "Send again"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => startOAuth("google")}
              disabled={loading !== null}
              className="w-full btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
            >
              {loading === "google" ? "Continuing..." : "Continue with Google"}
            </button>
            {fediOpen ? (
              <form onSubmit={startFediverse} className="space-y-3">
                <input
                  type="text"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder="name@server"
                  aria-label="Fediverse handle"
                  autoComplete="username"
                  className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="w-full btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
                >
                  {loading === "fedi" ? "Continuing..." : "Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFediOpen(false);
                    setError("");
                  }}
                  className="w-full text-sm text-muted hover:text-foreground"
                >
                  Back
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFediOpen(true);
                  setError("");
                }}
                disabled={loading !== null}
                className="w-full btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
              >
                Continue with the Fediverse
              </button>
            )}

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-muted">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={sendLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
                required
              />
              <button
                type="submit"
                disabled={loading !== null}
                className="w-full btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
              >
                {loading === "email" ? "Sending..." : "Email me a link"}
              </button>
            </form>

            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}

        <p className="text-sm text-muted text-center mt-6">
          {alternate.prompt}{" "}
          <Link href={alternate.href} className="text-glow-soft font-bold hover:underline">
            {alternate.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
