# Friend Requests & Social Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add friend requests, friend list with live room presence, user search, room invites, blocking, and navbar request alerts — all backed by `relationships` + `room_invites` tables with Supabase Realtime.

**Architecture:** Pure validation helpers and canonical-pair logic live in `src/lib/friends.ts` (unit-tested). Async DB operations in the same module are called from thin API routes using `createServiceClient()`. Client UI: `/friends` page, profile `FriendActions`, `UserMenu` badge, `InviteToast` in root layout, and an invite picker in the room top bar.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + Realtime), Vitest

**Spec:** `docs/superpowers/specs/2026-07-06-friend-requests-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/005_friendships.sql` | `relationships` + `room_invites` schema, RLS, Realtime |
| `src/lib/types.ts` | `Relationship`, `RoomInvite`, `FriendPresence`, `RelationshipHint` types |
| `src/lib/friends.ts` | Pure helpers + async relationship/invite operations |
| `src/lib/friends.test.ts` | Unit tests for pure helpers |
| `src/app/api/users/search/route.ts` | Display-name search |
| `src/app/api/friends/route.ts` | List friends + presence |
| `src/app/api/friends/requests/route.ts` | List pending requests |
| `src/app/api/friends/request/route.ts` | Send friend request |
| `src/app/api/friends/requests/[id]/accept/route.ts` | Accept request |
| `src/app/api/friends/requests/[id]/decline/route.ts` | Decline request |
| `src/app/api/friends/requests/[id]/route.ts` | Cancel outgoing pending |
| `src/app/api/friends/[userId]/route.ts` | Unfriend |
| `src/app/api/friends/block/route.ts` | Block user |
| `src/app/api/rooms/[slug]/invite/route.ts` | Send room invite |
| `src/app/api/invites/route.ts` | List pending invites |
| `src/app/api/invites/[id]/dismiss/route.ts` | Dismiss invite |
| `src/app/friends/page.tsx` | Friends page shell (server auth gate) |
| `src/components/friends/FriendsClient.tsx` | Tabs: Friends, Requests, Search |
| `src/components/profile/FriendActions.tsx` | Profile add/accept/decline/block UI |
| `src/components/shared/UserMenu.tsx` | Badge + incoming request preview |
| `src/components/shared/InviteToast.tsx` | Global room-invite toast |
| `src/components/venue/InviteFriendsButton.tsx` | Room invite picker |
| `src/components/venue/RoomTopBar.tsx` | Host invite button |
| `src/hooks/useFriendRealtime.ts` | Realtime subscriptions |
| `src/app/profile/[id]/page.tsx` | Wire `FriendActions` |
| `src/app/layout.tsx` | Mount `InviteToast` |
| `README.md` | `/friends` route + migration step |

---

### Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/005_friendships.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/005_friendships.sql` with the exact SQL from the spec (`relationships`, `room_invites`, indexes, RLS SELECT policies, Realtime publication).

Also add `updated_at` trigger for `relationships` (reuse existing `update_updated_at` function from `001_initial_schema.sql`):

```sql
CREATE TRIGGER relationships_updated_at
  BEFORE UPDATE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

- [ ] **Step 2: Apply migration locally**

Run migration via Supabase SQL Editor or CLI against your dev project.

- [ ] **Step 3: Enable Realtime**

Confirm in Supabase dashboard: Realtime enabled for `relationships` and `room_invites`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_friendships.sql
git commit -m "feat: add relationships and room_invites schema"
```

---

### Task 2: Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add types**

Append to `src/lib/types.ts`:

```ts
export type RelationshipStatus = "pending" | "accepted" | "declined" | "blocked";

export type RelationshipHint =
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends"
  | "blocked"
  | "blocked_by_them";

export interface Relationship {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: RelationshipStatus;
  requested_by: string;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomInvite {
  id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "dismissed";
  created_at: string;
  room?: Pick<Room, "id" | "name" | "slug">;
  from_user?: User;
}

export interface FriendPresence {
  roomId: string | null;
  roomName: string | null;
  roomSlug: string | null;
  isPrivate: boolean;
  canJoin: boolean;
}

export interface FriendWithPresence {
  user: User;
  presence: FriendPresence;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add relationship and invite types"
```

---

### Task 3: Pure friends helpers + tests

**Files:**
- Create: `src/lib/friends.ts` (pure helpers only)
- Create: `src/lib/friends.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/friends.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DECLINE_COOLDOWN_MS,
  canonicalPair,
  getRelationshipHint,
  isDeclineCooldownActive,
  validateSendRequest,
} from "./friends";

describe("canonicalPair", () => {
  it("orders UUIDs lexicographically", () => {
    const a = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const c = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    expect(canonicalPair(a, c)).toEqual([c, a]);
    expect(canonicalPair(c, a)).toEqual([c, a]);
  });
});

describe("isDeclineCooldownActive", () => {
  it("returns true within 72 hours", () => {
    const now = Date.parse("2026-07-06T12:00:00.000Z");
    const declinedAt = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    expect(isDeclineCooldownActive(declinedAt, now)).toBe(true);
  });

  it("returns false after 72 hours", () => {
    const now = Date.parse("2026-07-06T12:00:00.000Z");
    const declinedAt = new Date(now - DECLINE_COOLDOWN_MS - 1000).toISOString();
    expect(isDeclineCooldownActive(declinedAt, now)).toBe(false);
  });

  it("returns false when declined_at is null", () => {
    expect(isDeclineCooldownActive(null)).toBe(false);
  });
});

describe("getRelationshipHint", () => {
  const me = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const them = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("returns none when no relationship", () => {
    expect(getRelationshipHint(null, me)).toBe("none");
  });

  it("returns pending_out when I sent request", () => {
    expect(
      getRelationshipHint({ status: "pending", requested_by: me }, me)
    ).toBe("pending_out");
  });

  it("returns pending_in when they sent request", () => {
    expect(
      getRelationshipHint({ status: "pending", requested_by: them }, me)
    ).toBe("pending_in");
  });

  it("returns friends when accepted", () => {
    expect(
      getRelationshipHint({ status: "accepted", requested_by: me }, me)
    ).toBe("friends");
  });
});

describe("validateSendRequest", () => {
  const me = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const them = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const now = Date.parse("2026-07-06T12:00:00.000Z");

  it("rejects self-request", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: me,
      relationship: null,
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects when already friends", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "accepted",
        requested_by: me,
        declined_at: null,
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("rejects duplicate pending from same sender", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "pending",
        requested_by: me,
        declined_at: null,
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("already sent");
  });

  it("rejects within decline cooldown", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "declined",
        requested_by: me,
        declined_at: new Date(now - 60 * 60 * 1000).toISOString(),
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  });

  it("allows re-request after cooldown", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "declined",
        requested_by: me,
        declined_at: new Date(now - DECLINE_COOLDOWN_MS - 1000).toISOString(),
      },
      nowMs: now,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when blocked", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "blocked",
        requested_by: them,
        declined_at: null,
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/friends.test.ts`
Expected: FAIL — module `./friends` not found

- [ ] **Step 3: Implement pure helpers**

Create `src/lib/friends.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/friends.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/friends.ts src/lib/friends.test.ts
git commit -m "feat: add pure friend request validation helpers with tests"
```

---

### Task 4: Async friends module

**Files:**
- Modify: `src/lib/friends.ts`

- [ ] **Step 1: Add async DB functions**

Append to `src/lib/friends.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { presenceCutoff } from "@/lib/dj-booth";
import type {
  FriendPresence,
  FriendWithPresence,
  Relationship,
  RoomInvite,
  User,
} from "@/lib/types";

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
  if (!validation.ok) {
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

export class FriendRequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
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
    const room = member.room as {
      id: string;
      name: string;
      slug: string;
      is_private: boolean;
    } | null;
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
  if (rel.status === "blocked") {
    throw new FriendRequestError(403, "Unable to send invite");
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
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/lib/friends.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/friends.ts
git commit -m "feat: add async friend relationship and invite helpers"
```

---

### Task 5: User search API

**Files:**
- Create: `src/app/api/users/search/route.ts`

- [ ] **Step 1: Implement search route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getRelationshipHint } from "@/lib/friends";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { data: users, error } = await admin
    .from("users")
    .select("id, display_name, avatar_url, avatar_color")
    .ilike("display_name", `%${q}%`)
    .neq("id", user.id)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const u of users ?? []) {
    const [userA, userB] =
      user.id < u.id ? [user.id, u.id] : [u.id, user.id];
    const { data: rel } = await admin
      .from("relationships")
      .select("status, requested_by")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .maybeSingle();

    const hint = getRelationshipHint(rel, user.id);
    if (hint === "blocked_by_them") continue;

    results.push({ ...u, relationshipHint: hint });
  }

  return NextResponse.json({ users: results });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/users/search/route.ts
git commit -m "feat: add user display name search API"
```

---

### Task 6: Friends list + requests APIs

**Files:**
- Create: `src/app/api/friends/route.ts`
- Create: `src/app/api/friends/requests/route.ts`
- Create: `src/app/api/friends/request/route.ts`

- [ ] **Step 1: GET /api/friends**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/friends";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const friends = await listFriends(admin, user.id);
  return NextResponse.json({ friends });
}
```

- [ ] **Step 2: GET /api/friends/requests**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { listPendingRequests } from "@/lib/friends";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const requests = await listPendingRequests(admin, user.id);
  return NextResponse.json(requests);
}
```

- [ ] **Step 3: POST /api/friends/request**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { FriendRequestError, sendFriendRequest } from "@/lib/friends";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: target } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const relationship = await sendFriendRequest(admin, user.id, userId);
    return NextResponse.json({ relationship });
  } catch (err) {
    if (err instanceof FriendRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/friends/route.ts src/app/api/friends/requests/route.ts src/app/api/friends/request/route.ts
git commit -m "feat: add friends list, requests, and send request APIs"
```

---

### Task 7: Request action APIs

**Files:**
- Create: `src/app/api/friends/requests/[id]/accept/route.ts`
- Create: `src/app/api/friends/requests/[id]/decline/route.ts`
- Create: `src/app/api/friends/requests/[id]/route.ts`
- Create: `src/app/api/friends/[userId]/route.ts`
- Create: `src/app/api/friends/block/route.ts`

- [ ] **Step 1: Accept route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { FriendRequestError, acceptFriendRequest } from "@/lib/friends";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  try {
    const relationship = await acceptFriendRequest(admin, id, user.id);
    return NextResponse.json({ relationship });
  } catch (err) {
    if (err instanceof FriendRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 2: Decline route** — same pattern calling `declineFriendRequest`.

- [ ] **Step 3: DELETE /api/friends/requests/[id]** — calls `cancelFriendRequest`.

- [ ] **Step 4: DELETE /api/friends/[userId]** — calls `unfriend`.

- [ ] **Step 5: POST /api/friends/block** — body `{ userId }`, calls `blockUser`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/friends/
git commit -m "feat: add accept, decline, cancel, unfriend, and block APIs"
```

---

### Task 8: Room invite APIs

**Files:**
- Create: `src/app/api/rooms/[slug]/invite/route.ts`
- Create: `src/app/api/invites/route.ts`
- Create: `src/app/api/invites/[id]/dismiss/route.ts`

- [ ] **Step 1: POST /api/rooms/[slug]/invite**

Resolve room by slug, verify sender is member (optional but good), call `sendRoomInvite(admin, user.id, userId, room.id)`.

- [ ] **Step 2: GET /api/invites**

Return pending invites for current user with joined `room` and `from_user`:

```ts
const { data } = await admin
  .from("room_invites")
  .select("*, room:rooms(id, name, slug), from_user:users(*)")
  .eq("to_user_id", user.id)
  .eq("status", "pending")
  .order("created_at", { ascending: false });
```

- [ ] **Step 3: POST /api/invites/[id]/dismiss**

Verify `to_user_id === user.id`, set `status = dismissed`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/rooms/[slug]/invite/route.ts src/app/api/invites/
git commit -m "feat: add room invite send, list, and dismiss APIs"
```

---

### Task 9: Profile FriendActions

**Files:**
- Create: `src/components/profile/FriendActions.tsx`
- Modify: `src/app/profile/[id]/page.tsx`

- [ ] **Step 1: Create client component**

`FriendActions` props: `profileUserId`, `currentUserId`, initial `relationship` row (or null).

Fetch relationship on mount if needed. Render buttons per spec state table:

- Add Friend → `POST /api/friends/request`
- Accept / Decline → accept/decline routes
- Cancel → `DELETE /api/friends/requests/[id]`
- Unfriend → confirm + `DELETE /api/friends/[userId]`
- Block → `POST /api/friends/block`

Use `glass-card` styling consistent with `ProfileColorSettings`.

- [ ] **Step 2: Wire into profile page**

In `src/app/profile/[id]/page.tsx`, when `!isOwnProfile && sessionUser`, load relationship via admin + pass to `FriendActions`.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/FriendActions.tsx src/app/profile/[id]/page.tsx
git commit -m "feat: add friend actions on profile page"
```

---

### Task 10: /friends page

**Files:**
- Create: `src/app/friends/page.tsx`
- Create: `src/components/friends/FriendsClient.tsx`

- [ ] **Step 1: Server page with auth gate**

```tsx
import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { FriendsClient } from "@/components/friends/FriendsClient";
import { createClient } from "@/lib/supabase/server";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/friends");

  return (
    <div className="min-h-screen venue-bg">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="font-display text-2xl font-extrabold mb-6">Friends</h1>
        <FriendsClient currentUserId={user.id} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: FriendsClient with three tabs**

- **Friends tab:** fetch `GET /api/friends`, render rows with `UserAvatar`, presence text, click → `/rooms/[slug]` if `canJoin` else `/profile/[id]`.
- **Requests tab:** fetch `GET /api/friends/requests`, incoming/outgoing sections with action buttons.
- **Search tab:** debounced input (300ms), `GET /api/users/search?q=`, result cards with status chip + Add Friend.

Subscribe to `useFriendRealtime` for live updates on friends/requests tabs.

- [ ] **Step 3: Commit**

```bash
git add src/app/friends/page.tsx src/components/friends/FriendsClient.tsx
git commit -m "feat: add /friends page with list, requests, and search"
```

---

### Task 11: Realtime hook

**Files:**
- Create: `src/hooks/useFriendRealtime.ts`

- [ ] **Step 1: Implement hook**

```ts
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFriendRealtime(
  userId: string | undefined,
  onChange: () => void
) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`friends:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
          filter: `user_a_id=eq.${userId}`,
        },
        onChange
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
          filter: `user_b_id=eq.${userId}`,
        },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onChange]);
}
```

Add a sibling `useInviteRealtime` in same file or `InviteToast` for `room_invites` filtered by `to_user_id`.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFriendRealtime.ts
git commit -m "feat: add friend relationship realtime hook"
```

---

### Task 12: UserMenu badge + request preview

**Files:**
- Modify: `src/components/shared/UserMenu.tsx`

- [ ] **Step 1: Fetch pending count on mount**

```ts
const refreshRequests = useCallback(async () => {
  const res = await fetch("/api/friends/requests");
  if (!res.ok) return;
  const data = await res.json();
  setIncoming(data.incoming ?? []);
}, []);
```

- [ ] **Step 2: Badge on menu button**

When `incoming.length > 0`, show red dot badge (absolute top-right on button).

- [ ] **Step 3: Dropdown preview**

Above "View profile", render up to 3 incoming requests with accept/decline buttons. Link **See all** → `/friends`. Add **Friends** menu item → `/friends`.

- [ ] **Step 4: Wire `useFriendRealtime`**

Pass `userId` and `refreshRequests` to hook.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/UserMenu.tsx
git commit -m "feat: show friend request badge and preview in user menu"
```

---

### Task 13: InviteToast + room invite picker

**Files:**
- Create: `src/components/shared/InviteToast.tsx`
- Create: `src/components/venue/InviteFriendsButton.tsx`
- Modify: `src/components/venue/RoomTopBar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: InviteToast**

Client component mounted in `layout.tsx`. On mount: `GET /api/invites`. Subscribe to `room_invites` Realtime (`to_user_id=eq.${userId}`). Show fixed bottom toast:

`{from_user.display_name} invited you to {room.name}` with **Join** (`/rooms/{slug}`) and **Dismiss** (`POST /api/invites/[id]/dismiss`).

- [ ] **Step 2: InviteFriendsButton**

Props: `roomSlug`, `currentUserId`, `memberUserIds: Set<string>`.

On click: fetch `GET /api/friends`, filter out users already in room. Show modal list. On select: `POST /api/rooms/${roomSlug}/invite` with `{ userId }`. Toast "Invite sent".

- [ ] **Step 3: Add to RoomTopBar**

Pass `memberUserIds` from `RoomClient` through to `RoomTopBar`. Show `InviteFriendsButton` when `currentUser` is set.

- [ ] **Step 4: Mount InviteToast in layout**

```tsx
import { InviteToast } from "@/components/shared/InviteToast";
// inside body, after children:
<InviteToast />
```

`InviteToast` reads session via supabase client `getUser()`.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/InviteToast.tsx src/components/venue/InviteFriendsButton.tsx src/components/venue/RoomTopBar.tsx src/app/layout.tsx
git commit -m "feat: add room invite picker and global invite toast"
```

---

### Task 14: README + verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add to Pages table: `/friends` — Friends, requests, search.

Add migration step: run `005_friendships.sql`, enable Realtime on `relationships` and `room_invites`.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 4: Manual verification**

| Scenario | Expected |
|----------|----------|
| Search 2+ char display name | Up to 20 results with relationship hints |
| Add friend from profile | Pending state; recipient sees navbar badge |
| Accept from /friends | Both users see friend in list |
| Decline | Sender cannot re-request for 72h (429) |
| Friend in room | Presence shows room name; click joins |
| Private room presence | "In a private room" without join link |
| Send room invite | Recipient sees InviteToast with Join |
| Block user | Requests and invites blocked |
| Second tab open | Realtime updates badge without refresh |

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document friends feature and migration"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Send requests from profile + search | Task 9, Task 10 |
| Accept / decline with 72h cooldown | Task 3, Task 7 |
| Friend list with presence | Task 4, Task 10 |
| Click-to-join from presence | Task 10 |
| Room invites (notification + link) | Task 8, Task 13 |
| Navbar badge + dropdown preview | Task 12 |
| Block users | Task 7 |
| Realtime updates | Task 11, Task 12, Task 13 |
| User search (partial, min 2, max 20) | Task 5 |
| Private room presence rules | Task 4 `friendPresence` |
| Migration + RLS + Realtime | Task 1 |
