"use client";

import { useCallback, useEffect, useState } from "react";
import type { StressRun } from "@/lib/types";

const SECRET_KEY = "needle_stress_secret";
const POLL_MS = 10_000;

type StatusResponse =
  | { status: "idle" }
  | { status: "running"; run: StressRun };

function authHeaders(secret: string): HeadersInit {
  return {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function StressAdminPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [ready, setReady] = useState(false);

  const [primaryRoomSlug, setPrimaryRoomSlug] = useState("");
  const [secondaryRoomSlugs, setSecondaryRoomSlugs] = useState("");
  const [totalListeners, setTotalListeners] = useState(50);
  const [ttlMinutes, setTtlMinutes] = useState(20);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SECRET_KEY);
    if (stored) setSecret(stored);
    setReady(true);
  }, []);

  const fetchStatus = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/admin/stress", {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setStatus((await res.json()) as StatusResponse);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch status");
    }
  }, []);

  useEffect(() => {
    if (!secret) return;
    void fetchStatus(secret);
    const id = setInterval(() => void fetchStatus(secret), POLL_MS);
    return () => clearInterval(id);
  }, [secret, fetchStatus]);

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    const value = secretInput.trim();
    if (!value) return;
    sessionStorage.setItem(SECRET_KEY, value);
    setSecret(value);
    setError("");
  }

  function lock() {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret(null);
    setSecretInput("");
    setStatus(null);
    setError("");
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!secret) return;
    setBusy(true);
    setError("");
    try {
      const secondary = secondaryRoomSlugs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/stress", {
        method: "POST",
        headers: authHeaders(secret),
        body: JSON.stringify({
          primaryRoomSlug: primaryRoomSlug.trim(),
          secondaryRoomSlugs: secondary,
          totalListeners,
          ttlMinutes,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
      } else {
        await fetchStatus(secret);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!secret) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stress", {
        method: "DELETE",
        headers: authHeaders(secret),
      });
      if (!res.ok) {
        setError(await readError(res));
      } else {
        await fetchStatus(secret);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stop failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen venue-bg flex items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="min-h-screen venue-bg flex flex-col items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 w-full max-w-md">
          <h1 className="font-display text-xl font-extrabold mb-1">
            Stress harness
          </h1>
          <p className="text-sm text-muted mb-6">
            Enter the stress test secret to unlock controls.
          </p>
          <form onSubmit={unlock} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1.5 font-medium">
                Secret
              </label>
              <input
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
                autoComplete="off"
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              className="w-full btn-primary py-2.5 rounded-full font-bold"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  const run = status?.status === "running" ? status.run : null;
  const running = Boolean(run);

  return (
    <div className="min-h-screen venue-bg px-4 py-10">
      <main className="max-w-lg mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              Stress harness
            </h1>
            <p className="text-sm text-muted mt-1">
              Operator controls for synthetic listeners.
            </p>
          </div>
          <button
            type="button"
            onClick={lock}
            className="btn-secondary px-3 py-1.5 rounded-full text-xs font-medium"
          >
            Lock
          </button>
        </div>

        <section className="glass-card rounded-2xl p-6 space-y-2 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Status
          </h2>
          {!status && <p className="text-muted">Polling…</p>}
          {status?.status === "idle" && <p>Idle — no active run.</p>}
          {run && (
            <div className="space-y-1 font-mono text-xs leading-relaxed">
              <p>status: {run.status}</p>
              <p>id: {run.id}</p>
              <p>mode: {run.mode}</p>
              <p>totalListeners: {run.total_listeners}</p>
              <p>bots: {run.bot_user_ids.length}</p>
              <p>primary: {run.primary_room_id}</p>
              <p>secondary: {run.secondary_room_ids.join(", ") || "—"}</p>
              <p>perRoom: {JSON.stringify(run.per_room_counts)}</p>
              <p>expiresAt: {run.expires_at}</p>
              {run.error && <p className="text-danger">error: {run.error}</p>}
            </div>
          )}
        </section>

        {error && <p className="text-sm text-danger">{error}</p>}

        {!running ? (
          <form onSubmit={start} className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Start run
            </h2>
            <div>
              <label className="block text-sm text-muted mb-1.5 font-medium">
                Primary room slug
              </label>
              <input
                value={primaryRoomSlug}
                onChange={(e) => setPrimaryRoomSlug(e.target.value)}
                className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5 font-medium">
                Secondary room slugs
              </label>
              <input
                value={secondaryRoomSlugs}
                onChange={(e) => setSecondaryRoomSlugs(e.target.value)}
                placeholder="slug-a, slug-b"
                className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-muted mb-1.5 font-medium">
                  Listeners (1–250)
                </label>
                <input
                  type="number"
                  min={1}
                  max={250}
                  value={totalListeners}
                  onChange={(e) => setTotalListeners(Number(e.target.value))}
                  className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1.5 font-medium">
                  TTL minutes
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={ttlMinutes}
                  onChange={(e) => setTtlMinutes(Number(e.target.value))}
                  className="w-full input-venue rounded-xl px-4 py-2.5 text-sm"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full btn-primary py-2.5 rounded-full font-bold disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start"}
            </button>
          </form>
        ) : (
          <div className="glass-card rounded-2xl p-6">
            <button
              type="button"
              onClick={() => void stop()}
              disabled={busy}
              className="w-full btn-secondary py-2.5 rounded-full font-bold disabled:opacity-50"
            >
              {busy ? "Stopping…" : "Stop"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
