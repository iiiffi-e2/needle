"use client";

import { useMemo, useState } from "react";
import { getRelationshipHint } from "@/lib/friends";
import type { Relationship, RelationshipHint } from "@/lib/types";

interface FriendActionsProps {
  profileUserId: string;
  currentUserId: string;
  initialRelationship: Relationship | null;
}

export function FriendActions({
  profileUserId,
  currentUserId,
  initialRelationship,
}: FriendActionsProps) {
  const [relationship, setRelationship] = useState<Relationship | null>(
    initialRelationship
  );
  const [hintOverride, setHintOverride] = useState<RelationshipHint | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const relationshipHint = useMemo(
    () =>
      hintOverride ??
      getRelationshipHint(
        relationship
          ? {
              status: relationship.status,
              requested_by: relationship.requested_by,
            }
          : null,
        currentUserId
      ),
    [hintOverride, relationship, currentUserId]
  );

  const runAction = async (
    action: string,
    request: () => Promise<void>
  ): Promise<void> => {
    setLoadingAction(action);
    setError("");
    try {
      await request();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Something went wrong";
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const requestJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
    const res = await fetch(input, init);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error || "Request failed");
    }
    return payload as T;
  };

  const sendRequest = () =>
    runAction("request", async () => {
      const next = await requestJson<Relationship>("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profileUserId }),
      });
      setRelationship(next);
      setHintOverride(null);
    });

  const cancelRequest = () =>
    runAction("cancel", async () => {
      if (!relationship?.id) return;
      await requestJson(`/api/friends/requests/${relationship.id}`, {
        method: "DELETE",
      });
      setRelationship(null);
      setHintOverride(null);
    });

  const acceptRequest = () =>
    runAction("accept", async () => {
      if (!relationship?.id) return;
      const next = await requestJson<Relationship>(
        `/api/friends/requests/${relationship.id}/accept`,
        { method: "POST" }
      );
      setRelationship(next);
      setHintOverride(null);
    });

  const declineRequest = () =>
    runAction("decline", async () => {
      if (!relationship?.id) return;
      await requestJson(`/api/friends/requests/${relationship.id}/decline`, {
        method: "POST",
      });
      setRelationship(null);
      setHintOverride(null);
    });

  const unfriendUser = () =>
    runAction("unfriend", async () => {
      await requestJson(`/api/friends/${profileUserId}`, { method: "DELETE" });
      setRelationship(null);
      setHintOverride(null);
    });

  const blockUser = () =>
    runAction("block", async () => {
      await requestJson("/api/friends/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profileUserId }),
      });
      setHintOverride("blocked");
    });

  const isBusy = (action: string) => loadingAction === action;
  const disableAll = loadingAction !== null;

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        Friend Actions
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {relationshipHint === "none" && (
          <button
            type="button"
            onClick={sendRequest}
            disabled={disableAll}
            className="btn-primary px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
          >
            {isBusy("request") ? "Sending..." : "Add Friend"}
          </button>
        )}

        {relationshipHint === "pending_out" && (
          <>
            <span className="px-4 py-2 rounded-full text-sm font-semibold bg-accent/10 text-accent">
              Request Sent
            </span>
            <button
              type="button"
              onClick={cancelRequest}
              disabled={disableAll}
              className="btn-secondary px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {isBusy("cancel") ? "Cancelling..." : "Cancel"}
            </button>
          </>
        )}

        {relationshipHint === "pending_in" && (
          <>
            <button
              type="button"
              onClick={acceptRequest}
              disabled={disableAll}
              className="btn-primary px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
            >
              {isBusy("accept") ? "Accepting..." : "Accept"}
            </button>
            <button
              type="button"
              onClick={declineRequest}
              disabled={disableAll}
              className="btn-secondary px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {isBusy("decline") ? "Declining..." : "Decline"}
            </button>
          </>
        )}

        {relationshipHint === "friends" && (
          <>
            <span className="px-4 py-2 rounded-full text-sm font-semibold bg-success/20 text-success">
              Friends
            </span>
            <button
              type="button"
              onClick={unfriendUser}
              disabled={disableAll}
              className="btn-secondary px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {isBusy("unfriend") ? "Removing..." : "Unfriend"}
            </button>
          </>
        )}

        {relationshipHint === "blocked" && (
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-danger/20 text-danger">
            Blocked
          </span>
        )}

        {relationshipHint === "blocked_by_them" && (
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-surface-light text-muted">
            Not Available
          </span>
        )}

        {relationshipHint !== "blocked" && relationshipHint !== "blocked_by_them" && (
          <button
            type="button"
            onClick={blockUser}
            disabled={disableAll}
            className="btn-secondary px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {isBusy("block") ? "Blocking..." : "Block"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
