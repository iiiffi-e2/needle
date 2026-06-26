# DJ Waitlist — Design Spec

**Date:** 2026-06-26  
**Status:** Approved (brainstorming)  
**Problem:** When all DJ slots are full, crowd members have no fair path onto the deck. The booth needs a waitlist with visible queue depth, automatic promotion when slots open, and removal of inactive DJs who repeatedly miss their turn.

---

## Goals

1. When the booth is full (`max_djs`, default 3), listeners can **join a FIFO waitlist**.
2. **Waitlist count** is visible in the venue UI; full ordered list appears in Room Info.
3. When a DJ **steps off**, the next eligible waitlist member (still in the room) is promoted onto the deck.
4. When a DJ is **skipped 3 times** for having no queued track, they are demoted to the crowd and the next waitlist member is promoted.
5. **Waitlist priority:** while anyone is waiting, open slots are reserved for the queue — crowd cannot bypass via empty deck slots.

## Non-Goals (MVP)

- Waitlist max size or VIP priority
- Host/moderator override of queue order
- Push/browser notification on promotion (system chat message only)
- Re-wiring the legacy `DJBooth` component into the main layout
- Postgres triggers for promotion (server-side TypeScript orchestration instead)

---

## Chosen Approach

**Approach B: Central booth module (`lib/dj-booth.ts`)**

Extract slot lifecycle into shared helpers called from the DJ API route and `advancePlayback`. Most schema and API surface already exist; the gap is orchestration, presence checks, step-off promotion, and venue UI.

### Alternatives considered

| Approach | Why not chosen |
|----------|----------------|
| Patch existing paths only | Duplicated logic in `dj/route.ts` and `playback.ts`; easy to drift |
| Postgres triggers on slot delete | Harder to debug, test, and attach system messages / energy bumps |

---

## Product Rules

| Rule | Behavior |
|------|----------|
| Deck capacity | `room.max_djs` (default 3) |
| Join when slots available, waitlist empty | Direct join to `dj_slots` (current behavior) |
| Join when deck full OR waitlist non-empty | Add to `dj_waitlist` at next `position` |
| Open slot with waitlist | Promote next eligible waiter; crowd cannot direct-join |
| Promotion presence | User must be in `room_members` with `last_seen` within **5 minutes** (same threshold as listener count) |
| Absent waitlist entries | Removed from waitlist when skipped during promotion |
| Voluntary step-off | Delete slot → promote waiter → `advancePlayback` if they were current DJ |
| Empty turn skip | Increment `dj_slots.missed_turns` when rotation reaches a DJ with no queued track |
| 3 missed turns | Demote to crowd (`role: listener`), delete queued items, system message, promote next waiter if any |
| Queue a track | Reset `missed_turns` to 0 (already implemented in track route) |
| All waitlist absent during promotion | Purge absent entries; slot stays open; optional system msg: waitlist cleared, booth open |

---

## Architecture

### New module: `src/lib/dj-booth.ts`

#### `promoteFromWaitlist(supabase, roomId) → User | null`

1. Load `dj_waitlist` ordered by `position`.
2. For each entry, check `room_members.last_seen` within 5 minutes.
3. Skip and delete absent entries.
4. For first present user:
   - Insert `dj_slots` at next position
   - Upsert `room_members` role to `dj`
   - Delete waitlist row
   - Post system message: `{name} rotated into the booth from the waitlist.`
   - Bump room energy (`ENERGY_BUMP.joinDeck`)
   - Return promoted user
5. If no eligible waiter, return `null`.

#### `removeDjFromBooth(supabase, roomId, userId, options?) → { wasCurrentDj, slotPosition }`

1. Load slot and playback state.
2. Delete `dj_slots` row for user.
3. Delete user's queued `queue_items`.
4. Set `room_members.role` to `listener`.
5. Call `promoteFromWaitlist` once (one slot opened).
6. Return `{ wasCurrentDj, slotPosition }` for playback advance.

#### `processInactiveDjs(supabase, roomId) → number`

1. Find slots with `missed_turns >= 3`.
2. For each, call `removeDjFromBooth` with reason `inactive`.
3. Post system message: `{name} was removed from the booth after missing 3 turns.`
4. Return count removed.

### Call sites

| Location | Change |
|----------|--------|
| `POST /api/rooms/[slug]/dj` | If waitlist.length > 0 OR slots full → waitlist; reject duplicate waitlist entry; reject direct join when waitlist has priority |
| `DELETE /api/rooms/[slug]/dj` | Replace inline deletes with `removeDjFromBooth`; keep `advancePlayback` when `wasCurrentDj` |
| `advancePlayback` | After rotation loop, call `processInactiveDjs`; remove duplicated waitlist promotion block; increment `missed_turns` on every empty-turn skip (including when only one DJ is on deck) |
| `RoomClient` / `VenueCanvas` | Waitlist UI (see below) |
| `RoomSidePanel` (info tab) | Ordered waitlist names |

### Data flow

```
POST join (full or waitlist active)
  → insert dj_waitlist
  → system message + realtime

DELETE step off
  → removeDjFromBooth
    → delete slot, clear queue, listener role
    → promoteFromWaitlist
  → advancePlayback if was current DJ

advancePlayback (rotation)
  → try each DJ's queue
  → on empty turn: missed_turns++
  → processInactiveDjs (missed_turns >= 3)
    → removeDjFromBooth + promoteFromWaitlist per inactive DJ
```

---

## UI

### Venue (`VenueCanvas` + `RoomClient`)

**Waitlist count pill** — Below booth / near deck slots when `waitlistCount > 0`:

- Copy: `{n} waiting`
- Hidden when count is 0

**Join affordance**

| State | Empty deck slot label | Action |
|-------|----------------------|--------|
| Slots open, waitlist empty | `JOIN DECK` | POST → direct slot |
| Slots full OR waitlist non-empty | `JOIN WAITLIST` | POST → waitlist |
| User on waitlist | Disabled join; chip shown | `You're #N in line` + **Leave waitlist** (DELETE `/dj`) |
| User on deck | Step off (existing) | DELETE `/dj` |

**Toasts**

| Outcome | Message |
|---------|---------|
| Direct join | `You're on the deck — line up a track` |
| Waitlist join | `You're #N in line for the booth` |
| Promotion | Server system chat (existing pattern) |

### Room Info tab

Under booth section, show ordered waitlist display names when non-empty.

### New props on `VenueCanvas`

- `waitlistCount: number`
- `waitlistPosition: number | null` (1-based; null if not waitlisted)
- `deckJoinMode: 'deck' | 'waitlist'`
- `onLeaveWaitlist: () => void` (same DELETE endpoint; only shown when waitlisted)

---

## Error Handling

- **Empty waitlist on promotion:** No-op; slot remains open for next direct join once waitlist drains.
- **Concurrent step-offs:** Postgres unique constraints on `(room_id, user_id)` and `(room_id, position)` prevent duplicate slots; promotion is safe to call after each removal.
- **Realtime:** Existing subscriptions on `dj_slots` and `dj_waitlist` refresh client state; no new tables.

---

## Testing

### Unit tests (`src/lib/dj-booth.test.ts` or pure helpers)

- FIFO promotion order
- Skip absent waitlist members and remove stale entries
- `processInactiveDjs` at threshold 3
- Waitlist priority: direct join blocked when waitlist non-empty

### Integration / manual

1. Fill booth → join waitlist → verify count and position
2. Step off → next waiter promoted if present
3. Waitlist member leaves room (>5 min) → skipped on promotion
4. DJ skipped 3 times with no queue → demoted, next waiter promoted
5. Queue track → `missed_turns` reset to 0

---

## Files to Touch

| File | Purpose |
|------|---------|
| `src/lib/dj-booth.ts` | New — promotion, removal, inactive processing |
| `src/lib/dj-booth.test.ts` | New — unit tests |
| `src/lib/playback.ts` | Refactor inactive/waitlist block to use dj-booth |
| `src/app/api/rooms/[slug]/dj/route.ts` | Waitlist priority + shared removal |
| `src/components/room/RoomClient.tsx` | Waitlist state, toasts, props |
| `src/components/venue/VenueCanvas.tsx` | Count pill, join/leave waitlist UI |
| `src/components/venue/RoomSidePanel.tsx` | Info tab waitlist list |

No schema migration required — `dj_waitlist`, `dj_slots.missed_turns`, and Realtime are already in place.
