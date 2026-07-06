import type { RelationshipHint, RelationshipStatus } from "@/lib/types";

export const DECLINE_COOLDOWN_MS = 72 * 60 * 60 * 1000;

export function canonicalPair(
  userId1: string,
  userId2: string
): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

export function isDeclineCooldownActive(
  declinedAt: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!declinedAt) return false;
  return nowMs - Date.parse(declinedAt) < DECLINE_COOLDOWN_MS;
}

export function getRelationshipHint(
  relationship: { status: RelationshipStatus; requested_by: string } | null,
  currentUserId: string
): RelationshipHint {
  if (!relationship) return "none";
  if (relationship.status === "accepted") return "friends";
  if (relationship.status === "blocked") {
    return relationship.requested_by === currentUserId
      ? "blocked"
      : "blocked_by_them";
  }
  if (relationship.status === "pending") {
    return relationship.requested_by === currentUserId
      ? "pending_out"
      : "pending_in";
  }
  return "none";
}

export type SendRequestValidation =
  | { ok: true }
  | { ok: false; status: number; message: string };

export function validateSendRequest(params: {
  fromId: string;
  toId: string;
  relationship: {
    status: RelationshipStatus;
    requested_by: string;
    declined_at: string | null;
  } | null;
  nowMs?: number;
}): SendRequestValidation {
  const { fromId, toId, relationship, nowMs = Date.now() } = params;

  if (fromId === toId) {
    return { ok: false, status: 400, message: "Cannot friend yourself" };
  }

  if (!relationship) return { ok: true };

  if (relationship.status === "accepted") {
    return { ok: false, status: 409, message: "Already friends" };
  }

  if (relationship.status === "blocked") {
    return { ok: false, status: 403, message: "Unable to send request" };
  }

  if (relationship.status === "pending") {
    if (relationship.requested_by === fromId) {
      return { ok: false, status: 409, message: "Request already sent" };
    }
    return {
      ok: false,
      status: 409,
      message: "This user already sent you a request",
    };
  }

  if (relationship.status === "declined") {
    if (isDeclineCooldownActive(relationship.declined_at, nowMs)) {
      return {
        ok: false,
        status: 429,
        message: "Request declined recently — try again later",
      };
    }
  }

  return { ok: true };
}
