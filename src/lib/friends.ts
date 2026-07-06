import type { SupabaseClient } from "@supabase/supabase-js";
import { presenceCutoff } from "@/lib/dj-booth";
import type {
  FriendPresence,
  FriendWithPresence,
  Relationship,
  RelationshipHint,
  RelationshipStatus,
  RoomInvite,
  User,
} from "@/lib/types";

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

export class FriendRequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function getRelationship(
  admin: SupabaseClient,
  userId: string,
  otherUserId: string
): Promise<Relationship | null> {
  const [userA, userB] = canonicalPair(userId, otherUserId);
  const { data } = await admin
    .from("relationships")
    .select("*")
    .eq("user_a_id", userA)
    .eq("user_b_id", userB)
    .maybeSingle();
  return data;
}

export async function sendFriendRequest(
  admin: SupabaseClient,
  fromId: string,
  toId: string
): Promise<Relationship> {
  const existing = await getRelationship(admin, fromId, toId);
  const validation = validateSendRequest({
    fromId,
    toId,
    relationship: existing,
  });
  if (validation.ok === false) {
    throw new FriendRequestError(validation.status, validation.message);
  }

  const [userA, userB] = canonicalPair(fromId, toId);

  if (existing?.status === "declined") {
    const { data, error } = await admin
      .from("relationships")
      .update({
        status: "pending",
        requested_by: fromId,
        declined_at: null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new FriendRequestError(500, error.message);
    return data;
  }

  const { data, error } = await admin
    .from("relationships")
    .insert({
      user_a_id: userA,
      user_b_id: userB,
      status: "pending",
      requested_by: fromId,
    })
    .select("*")
    .single();

  if (error) throw new FriendRequestError(500, error.message);
  return data;
}

export async function acceptFriendRequest(
  admin: SupabaseClient,
  relationshipId: string,
  userId: string
): Promise<Relationship> {
  const { data: rel } = await admin
    .from("relationships")
    .select("*")
    .eq("id", relationshipId)
    .single();

  if (!rel || rel.status !== "pending") {
    throw new FriendRequestError(404, "Request not found");
  }
  if (rel.requested_by === userId) {
    throw new FriendRequestError(403, "Not authorized");
  }
  if (rel.user_a_id !== userId && rel.user_b_id !== userId) {
    throw new FriendRequestError(403, "Not authorized");
  }

  const { data, error } = await admin
    .from("relationships")
    .update({ status: "accepted", declined_at: null })
    .eq("id", relationshipId)
    .select("*")
    .single();

  if (error) throw new FriendRequestError(500, error.message);
  return data;
}

export async function declineFriendRequest(
  admin: SupabaseClient,
  relationshipId: string,
  userId: string
): Promise<void> {
  const { data: rel } = await admin
    .from("relationships")
    .select("*")
    .eq("id", relationshipId)
    .single();

  if (!rel || rel.status !== "pending") {
    throw new FriendRequestError(404, "Request not found");
  }
  if (rel.requested_by === userId) {
    throw new FriendRequestError(403, "Not authorized");
  }
  if (rel.user_a_id !== userId && rel.user_b_id !== userId) {
    throw new FriendRequestError(403, "Not authorized");
  }

  const { error } = await admin
    .from("relationships")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
    })
    .eq("id", relationshipId);

  if (error) throw new FriendRequestError(500, error.message);
}

export async function cancelFriendRequest(
  admin: SupabaseClient,
  relationshipId: string,
  userId: string
): Promise<void> {
  const { data: rel } = await admin
    .from("relationships")
    .select("*")
    .eq("id", relationshipId)
    .single();

  if (!rel || rel.status !== "pending" || rel.requested_by !== userId) {
    throw new FriendRequestError(403, "Not authorized");
  }

  const { error } = await admin
    .from("relationships")
    .delete()
    .eq("id", relationshipId);

  if (error) throw new FriendRequestError(500, error.message);
}

export async function unfriend(
  admin: SupabaseClient,
  userId: string,
  otherUserId: string
): Promise<void> {
  const [userA, userB] = canonicalPair(userId, otherUserId);
  const { error } = await admin
    .from("relationships")
    .delete()
    .eq("user_a_id", userA)
    .eq("user_b_id", userB)
    .eq("status", "accepted");

  if (error) throw new FriendRequestError(500, error.message);
}

export async function blockUser(
  admin: SupabaseClient,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const [userA, userB] = canonicalPair(blockerId, blockedId);
  const existing = await getRelationship(admin, blockerId, blockedId);

  if (existing) {
    await admin
      .from("relationships")
      .update({
        status: "blocked",
        requested_by: blockerId,
        declined_at: null,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("relationships").insert({
      user_a_id: userA,
      user_b_id: userB,
      status: "blocked",
      requested_by: blockerId,
    });
  }

  await admin
    .from("room_invites")
    .update({ status: "dismissed" })
    .or(
      `and(from_user_id.eq.${blockerId},to_user_id.eq.${blockedId}),and(from_user_id.eq.${blockedId},to_user_id.eq.${blockerId})`
    )
    .eq("status", "pending");
}

export async function listFriends(
  admin: SupabaseClient,
  userId: string
): Promise<FriendWithPresence[]> {
  const { data: relationships } = await admin
    .from("relationships")
    .select("*")
    .eq("status", "accepted")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (!relationships?.length) return [];

  const friendIds = relationships.map((r) =>
    r.user_a_id === userId ? r.user_b_id : r.user_a_id
  );

  const { data: users } = await admin
    .from("users")
    .select("*")
    .in("id", friendIds);

  const presenceMap = await friendPresence(admin, userId, friendIds);

  return (users ?? []).map((user) => ({
    user,
    presence: presenceMap.get(user.id) ?? offlinePresence(),
  }));
}

function offlinePresence(): FriendPresence {
  return {
    roomId: null,
    roomName: null,
    roomSlug: null,
    isPrivate: false,
    canJoin: false,
  };
}

export async function friendPresence(
  admin: SupabaseClient,
  viewerId: string,
  friendIds: string[]
): Promise<Map<string, FriendPresence>> {
  const result = new Map<string, FriendPresence>();
  if (!friendIds.length) return result;

  const cutoff = presenceCutoff();
  const { data: memberships } = await admin
    .from("room_members")
    .select("user_id, room_id, last_seen, room:rooms(id, name, slug, is_private)")
    .in("user_id", friendIds)
    .gte("last_seen", cutoff)
    .order("last_seen", { ascending: false });

  const viewerMemberships = new Set<string>();
  const roomIds = [
    ...new Set((memberships ?? []).map((m) => m.room_id)),
  ];
  if (roomIds.length) {
    const { data: viewerRooms } = await admin
      .from("room_members")
      .select("room_id")
      .eq("user_id", viewerId)
      .in("room_id", roomIds);
    for (const row of viewerRooms ?? []) {
      viewerMemberships.add(row.room_id);
    }
  }

  for (const member of memberships ?? []) {
    if (result.has(member.user_id)) continue;
    const roomRelation = member.room as
      | {
          id: string;
          name: string;
          slug: string;
          is_private: boolean;
        }
      | Array<{
          id: string;
          name: string;
          slug: string;
          is_private: boolean;
        }>
      | null;
    const room = Array.isArray(roomRelation)
      ? (roomRelation[0] ?? null)
      : roomRelation;
    if (!room) {
      result.set(member.user_id, offlinePresence());
      continue;
    }
    const canJoin = !room.is_private || viewerMemberships.has(room.id);
    result.set(member.user_id, {
      roomId: room.id,
      roomName: room.name,
      roomSlug: canJoin ? room.slug : null,
      isPrivate: room.is_private,
      canJoin,
    });
  }

  for (const id of friendIds) {
    if (!result.has(id)) result.set(id, offlinePresence());
  }

  return result;
}

export async function listPendingRequests(
  admin: SupabaseClient,
  userId: string
): Promise<{
  incoming: Array<Relationship & { user: User }>;
  outgoing: Array<Relationship & { user: User }>;
}> {
  const { data: pending } = await admin
    .from("relationships")
    .select("*")
    .eq("status", "pending")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  const incoming: Array<Relationship & { user: User }> = [];
  const outgoing: Array<Relationship & { user: User }> = [];

  for (const rel of pending ?? []) {
    const otherId = rel.user_a_id === userId ? rel.user_b_id : rel.user_a_id;
    const { data: user } = await admin
      .from("users")
      .select("*")
      .eq("id", otherId)
      .single();
    if (!user) continue;
    if (rel.requested_by === userId) {
      outgoing.push({ ...rel, user });
    } else {
      incoming.push({ ...rel, user });
    }
  }

  return { incoming, outgoing };
}

export async function sendRoomInvite(
  admin: SupabaseClient,
  fromId: string,
  toId: string,
  roomId: string
): Promise<RoomInvite> {
  const rel = await getRelationship(admin, fromId, toId);
  if (!rel || rel.status !== "accepted") {
    throw new FriendRequestError(403, "Can only invite friends");
  }

  const { data, error } = await admin
    .from("room_invites")
    .upsert(
      {
        room_id: roomId,
        from_user_id: fromId,
        to_user_id: toId,
        status: "pending",
      },
      { onConflict: "room_id,from_user_id,to_user_id" }
    )
    .select("*")
    .single();

  if (error) throw new FriendRequestError(500, error.message);
  return data;
}
