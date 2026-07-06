# Friend Requests & Social Graph — Design Spec

**Date:** 2026-07-06  
**Status:** Approved (brainstorming)  
**Problem:** Needle has profiles and in-room presence, but no way to connect users outside the ephemeral context of a single room. Users need to send friend requests, manage a friend list, see where friends are listening, and invite them to rooms.

---

## Goals

1. **Send friend requests** from another user's profile or via display-name search.
2. **Accept / decline** incoming requests; declined senders are **suppressed for 72 hours** before they can re-request.
3. **Friend list** on a dedicated `/friends` page with **live presence** (which room a friend is in, if any).
4. **Click-to-join** from friend presence — navigate directly to the friend's current room.
5. **Explicit room invites** — send an in-app notification with a join link; recipient sees a toast/banner when relevant.
6. **Navbar badge** on the user menu for pending incoming requests; dropdown shows a quick preview.
7. **Block users** — open requests by default, but blocked users cannot send requests or invites.
8. **Realtime** — new requests, acceptances, friend presence, and room invites update live via Supabase Realtime.

## Non-Goals (v1)

- Push / email / browser notifications
- Mutual-friends suggestions ("people you may know")
- Requiring a shared-room history before requesting (open graph)
- Private/friends-only rooms (invites link to existing rooms; room privacy rules unchanged)
- Unblock UI (block is one-way for v1; can add unblock later)
- DM / direct messaging between friends
- Friend count on public profiles (optional nice-to-have; not required for v1)

---

## Chosen Approach

**Approach A: Single `relationships` table + `room_invites`**

One canonical-pair table holds the full relationship lifecycle (`pending`, `accepted`, `declined`, `blocked`). Room invites are a separate short-lived table. Server-side TypeScript helpers in `lib/friends.ts` centralize validation (blocks, cooldowns, duplicates). Matches existing patterns (`lib/dj-booth.ts`, API routes + service client, Realtime subscriptions).

### Alternatives considered

| Approach | Why not chosen |
|----------|----------------|
| Split `friend_requests` + `friendships` | Extra sync on accept; two sources of truth |
| Follow model (no acceptance) | Does not match "request to add a friend" |
| Postgres triggers for accept side-effects | Harder to test; app already orchestrates in TS |

---

## Product Rules

### Relationships

| Rule | Behavior |
|------|----------|
| Canonical pair | Always store `user_a_id < user_b_id` (UUID lexicographic compare) to prevent duplicate rows |
| Send request | Creates row with `status = pending`, `requested_by = sender` |
| Duplicate pending | Reject — "Request already sent" |
| Already friends | Reject — "Already friends" |
| Self-request | Reject — 400 |
| Accept | Set `status = accepted`, clear `declined_at` |
| Decline | Set `status = declined`, `declined_at = now()` |
| Re-request after decline | Allowed only if `declined_at` is older than **72 hours**; row updates back to `pending` |
| Re-request within 72h | Reject — "Request declined recently" |
| Unfriend | Delete the `accepted` row |
| Cancel outgoing pending | Sender deletes the `pending` row |
| Block | Upsert `status = blocked`; delete any `pending` row in either direction; blocked user cannot request or invite |

### User search

| Rule | Behavior |
|------|----------|
| Query | Partial, case-insensitive match on `users.display_name` |
| Min length | 2 characters |
| Max results | 20 |
| Auth | Authenticated users only |
| Exclude | Current user; users who blocked the searcher |
| Result fields | `id`, `display_name`, `avatar_url`, `avatar_color`, relationship status hint (`none` / `pending_out` / `pending_in` / `friends` / `blocked`) |

### Friend presence

| Rule | Behavior |
|------|----------|
| Online in room | Friend has `room_members` row with `last_seen` within **5 minutes** (reuse `presenceCutoff()` from `lib/dj-booth.ts`) |
| Display | Show room name + slug on friend list; "Offline" when no recent membership |
| Join | Click friend row → navigate to `/rooms/[slug]` |
| Private rooms | Show presence only if the viewing user can access the room (`is_private = false` OR user is a member); otherwise show "In a private room" without slug |

### Room invites

| Rule | Behavior |
|------|----------|
| Who can invite | Friends only (`status = accepted`) |
| Send | Creates `room_invites` row with `status = pending` |
| Duplicate pending invite (same room + pair) | Upsert / no-op with success |
| Recipient UX | Toast/banner: "{name} invited you to {room}" with **Join** link |
| Dismiss | Set `status = dismissed` |
| Join | Navigate to room; dismiss invite on successful room join (or manual dismiss) |
| Blocked users | Cannot send or receive invites |

### Realtime subscriptions

| Table | Filter | Consumer |
|-------|--------|----------|
| `relationships` | `user_a_id = me OR user_b_id = me` (client filters incoming pending where `requested_by ≠ me`) | Navbar badge, `/friends` requests tab |
| `room_members` | `user_id IN (friend_ids)` | `/friends` presence column |
| `room_invites` | `to_user_id = me` | Global invite toast (layout-level hook) |

---

## Schema

### Migration: `005_friendships.sql`

```sql
CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT relationships_ordered_pair CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE public.room_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (room_id, from_user_id, to_user_id)
);

CREATE INDEX idx_relationships_user_a ON public.relationships(user_a_id);
CREATE INDEX idx_relationships_user_b ON public.relationships(user_b_id);
CREATE INDEX idx_relationships_status ON public.relationships(status);
CREATE INDEX idx_room_invites_to_user ON public.room_invites(to_user_id, status);

ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

-- Users can read relationships they are part of
CREATE POLICY "Users read own relationships" ON public.relationships
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Users can read invites they sent or received
CREATE POLICY "Users read own invites" ON public.room_invites
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Writes go through service role API routes (same pattern as chat, DJ booth)

ALTER PUBLICATION supabase_realtime ADD TABLE public.relationships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;
```

**Note:** All mutations (request, accept, decline, block, invite) use `createServiceClient()` in API routes with server-side validation, consistent with existing endpoints. RLS SELECT policies enable client-side Realtime.

### Helper: canonical pair

```ts
function canonicalPair(userId1: string, userId2: string): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}
```

---

## Architecture

### New module: `src/lib/friends.ts`

| Function | Purpose |
|----------|---------|
| `canonicalPair(a, b)` | Ordered UUID pair |
| `getRelationship(admin, userId, otherUserId)` | Load row for pair |
| `canSendRequest(admin, fromId, toId)` | Validates not self, not blocked, not friends, cooldown, no duplicate pending |
| `sendFriendRequest(admin, fromId, toId)` | Insert or revive declined row after cooldown |
| `acceptFriendRequest(admin, relationshipId, userId)` | Verify recipient, set accepted |
| `declineFriendRequest(admin, relationshipId, userId)` | Verify recipient, set declined + timestamp |
| `blockUser(admin, blockerId, blockedId)` | Upsert blocked, clear pending |
| `listFriends(admin, userId)` | Accepted relationships with user profiles |
| `friendPresence(admin, userId, friendIds)` | Map friend → current room (respecting private room visibility) |
| `listPendingRequests(admin, userId)` | Incoming + outgoing pending |
| `sendRoomInvite(admin, fromId, toId, roomId)` | Friends-only invite |

### API routes

| Route | Method | Body / params | Response |
|-------|--------|---------------|----------|
| `/api/users/search` | GET | `?q=` (min 2 chars) | `{ users: [...] }` |
| `/api/friends` | GET | — | `{ friends: [{ user, presence }] }` |
| `/api/friends/requests` | GET | — | `{ incoming: [], outgoing: [] }` |
| `/api/friends/request` | POST | `{ userId }` | `{ relationship }` or error |
| `/api/friends/requests/[id]/accept` | POST | — | `{ relationship }` |
| `/api/friends/requests/[id]/decline` | POST | — | `{ ok: true }` |
| `/api/friends/requests/[id]` | DELETE | — | Cancel outgoing pending |
| `/api/friends/[userId]` | DELETE | — | Unfriend |
| `/api/friends/block` | POST | `{ userId }` | `{ ok: true }` |
| `/api/rooms/[slug]/invite` | POST | `{ userId }` | `{ invite }` |
| `/api/invites` | GET | — | Pending room invites for current user |
| `/api/invites/[id]/dismiss` | POST | — | `{ ok: true }` |

### Data flow

```
Profile / Search → POST /api/friends/request
  → validate (block, cooldown, duplicate)
  → insert/update relationships (pending)
  → Realtime → navbar badge + /friends requests

Recipient → POST accept
  → status = accepted
  → Realtime → sender's friend list updates

/friends page loads → GET /api/friends
  → join room_members for friend IDs (presenceCutoff)
  → subscribe room_members for live updates

In room → POST /api/rooms/[slug]/invite { userId }
  → insert room_invites
  → Realtime → recipient toast with join link
```

---

## UI

### Profile page (`/profile/[id]`)

When viewing **another** user's profile, show action button below the header:

| Relationship state | Button |
|--------------------|--------|
| None | **Add Friend** |
| Pending (you sent) | **Request Sent** (disabled) + **Cancel** |
| Pending (they sent) | **Accept** + **Decline** |
| Friends | **Friends ✓** + **Unfriend** (confirm) |
| Blocked (you blocked them) | **Blocked** |
| Blocked (they blocked you) | Hide add button or show nothing |

Overflow menu or secondary action: **Block user**.

### `/friends` page (new)

Authenticated-only. Three tabs:

1. **Friends** — list with avatar, display name, presence ("In {room name}" / "Offline"), click row to join or view profile.
2. **Requests** — incoming (accept/decline) and outgoing (cancel).
3. **Search** — input (debounced, min 2 chars), results with Add Friend / status chip.

Uses venue aesthetic (`venue-bg`, `glass-card`, existing avatar components).

### Navbar (`UserMenu`)

- Red badge on menu button when `incomingPendingCount > 0`.
- Dropdown section above "View profile":
  - Up to 3 recent incoming requests with accept/decline inline.
  - **See all** link → `/friends`.
- New menu item: **Friends**.

`UserMenu` is client-side; fetch pending count on mount + Realtime subscription.

### Room invite UI

- **Invite friends** affordance in room UI (e.g. Room top bar or side panel menu): opens picker of friends not already in the room.
- **Global `InviteToast`** in root layout (client): subscribes to `room_invites`, shows dismissible toast with join link.

### Profile links from rooms

Make avatars / display names in chat and member list link to `/profile/[id]` where they don't already (incremental polish; include if low effort during implementation).

---

## Error Handling

| Case | HTTP | Message |
|------|------|---------|
| Not authenticated | 401 | Unauthorized |
| User not found | 404 | User not found |
| Self-request | 400 | Cannot friend yourself |
| Already friends | 409 | Already friends |
| Pending exists | 409 | Request already sent |
| Decline cooldown active | 429 | Request declined recently — try again later |
| Blocked | 403 | Unable to send request |
| Not friends (invite) | 403 | Can only invite friends |
| Not request recipient (accept/decline) | 403 | Not authorized |

---

## Testing

### Unit tests (`src/lib/friends.test.ts`)

- Canonical pair ordering
- Decline → re-request blocked within 72h, allowed after
- Block clears pending and prevents new requests
- `canSendRequest` edge cases (self, friends, duplicate)

### Manual integration

1. Search partial display name → add friend from results
2. Accept from `/friends` and from navbar dropdown → both appear in friend list
3. Decline → sender cannot re-request for 72h
4. Friend joins room → presence appears on `/friends`; click navigates to room
5. Send room invite → recipient sees toast; join works
6. Block user → requests and invites stop both ways
7. Realtime: second browser/tab sees request without refresh

---

## Files to Touch

| File | Purpose |
|------|---------|
| `supabase/migrations/005_friendships.sql` | Schema + RLS + Realtime |
| `src/lib/friends.ts` | Core relationship logic |
| `src/lib/friends.test.ts` | Unit tests |
| `src/lib/types.ts` | `Relationship`, `RoomInvite` types |
| `src/app/api/users/search/route.ts` | Display name search |
| `src/app/api/friends/route.ts` | List friends + presence |
| `src/app/api/friends/request/route.ts` | Send request |
| `src/app/api/friends/requests/route.ts` | List pending |
| `src/app/api/friends/requests/[id]/accept/route.ts` | Accept |
| `src/app/api/friends/requests/[id]/decline/route.ts` | Decline |
| `src/app/api/friends/requests/[id]/route.ts` | Cancel pending |
| `src/app/api/friends/[userId]/route.ts` | Unfriend |
| `src/app/api/friends/block/route.ts` | Block |
| `src/app/api/rooms/[slug]/invite/route.ts` | Send room invite |
| `src/app/api/invites/route.ts` | List pending invites |
| `src/app/api/invites/[id]/dismiss/route.ts` | Dismiss invite |
| `src/app/friends/page.tsx` | Friends page |
| `src/components/friends/*` | Friend list, search, request cards |
| `src/components/shared/UserMenu.tsx` | Badge + request preview |
| `src/components/shared/InviteToast.tsx` | Global room invite toast |
| `src/app/profile/[id]/page.tsx` | Add Friend button |
| `src/components/profile/FriendActions.tsx` | Client actions on profile |
| `src/hooks/useFriendRealtime.ts` | Realtime hook (optional) |
| `README.md` | Document `/friends` route + migration step |

---

## Open Questions (resolved)

| Question | Decision |
|----------|----------|
| User search behavior | Partial match, min 2 chars, max 20 results |
| Re-request after decline | Suppressed for 72 hours |
| Friendship unlocks | Friend list, presence, room invites |
| Discovery | Profile + search |
| Privacy | Open requests + block |
| Room invites | Notification with link + presence click-to-join |
| Request inbox | `/friends` page + navbar badge |
| Live updates | Supabase Realtime |
