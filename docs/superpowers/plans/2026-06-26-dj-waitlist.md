# DJ Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete DJ waitlist flow — FIFO queue when booth is full, waitlist priority over open slots, promotion on step-off and inactive removal (3 empty turns), with venue UI showing count and join/leave affordances.

**Architecture:** Centralize booth slot lifecycle in `src/lib/dj-booth.ts` (`promoteFromWaitlist`, `removeDjFromBooth`, `processInactiveDjs`). Pure helpers are unit-tested; API route and `advancePlayback` call the shared module. Venue UI reads existing waitlist state from room fetch + realtime.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + Realtime), Vitest

**Spec:** `docs/superpowers/specs/2026-06-26-dj-waitlist-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/lib/dj-booth.ts` | Pure helpers + async booth lifecycle (promote, remove, inactive) |
| `src/lib/dj-booth.test.ts` | Unit tests for pure helpers |
| `src/lib/playback.ts` | Refactor: missed-turn increment always; call `processInactiveDjs`; remove inline waitlist block |
| `src/app/api/rooms/[slug]/dj/route.ts` | Waitlist priority on POST; `removeDjFromBooth` on DELETE |
| `src/components/room/RoomClient.tsx` | Derived waitlist state, toasts, props to venue |
| `src/components/venue/VenueCanvas.tsx` | Waitlist pill, join label, waitlist chip + leave |
| `src/components/venue/RoomSidePanel.tsx` | Ordered waitlist in Room Info tab |

No schema migration — `dj_waitlist`, `dj_slots.missed_turns`, and Realtime already exist.

---

### Task 1: Pure booth helpers + tests

**Files:**
- Create: `src/lib/dj-booth.ts` (helpers only first)
- Create: `src/lib/dj-booth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/dj-booth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PRESENCE_WINDOW_MS,
  isMemberPresent,
  shouldJoinWaitlist,
  pickNextWaitlistEntry,
  type WaitlistCandidate,
} from "./dj-booth";

describe("isMemberPresent", () => {
  it("returns true when last_seen is within 5 minutes", () => {
    const now = Date.parse("2026-06-26T12:00:00.000Z");
    const lastSeen = new Date(now - 4 * 60 * 1000).toISOString();
    expect(isMemberPresent(lastSeen, now)).toBe(true);
  });

  it("returns false when last_seen is older than 5 minutes", () => {
    const now = Date.parse("2026-06-26T12:00:00.000Z");
    const lastSeen = new Date(now - PRESENCE_WINDOW_MS - 1000).toISOString();
    expect(isMemberPresent(lastSeen, now)).toBe(false);
  });
});

describe("shouldJoinWaitlist", () => {
  it("returns false when slots open and waitlist empty", () => {
    expect(shouldJoinWaitlist(2, 3, 0)).toBe(false);
  });

  it("returns true when booth is full", () => {
    expect(shouldJoinWaitlist(3, 3, 0)).toBe(true);
  });

  it("returns true when waitlist has entries even if slot open", () => {
    expect(shouldJoinWaitlist(2, 3, 1)).toBe(true);
  });
});

describe("pickNextWaitlistEntry", () => {
  const entries: WaitlistCandidate[] = [
    { id: "w1", user_id: "u1", position: 0 },
    { id: "w2", user_id: "u2", position: 1 },
    { id: "w3", user_id: "u3", position: 2 },
  ];

  it("returns first entry whose user is present", () => {
    const result = pickNextWaitlistEntry(entries, new Set(["u2", "u3"]));
    expect(result).toEqual({
      promote: entries[1],
      staleIds: ["w1"],
    });
  });

  it("returns null promote and all stale when nobody present", () => {
    const result = pickNextWaitlistEntry(entries, new Set());
    expect(result.promote).toBeNull();
    expect(result.staleIds).toEqual(["w1", "w2", "w3"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/dj-booth.test.ts`
Expected: FAIL — module `./dj-booth` not found or exports missing

- [ ] **Step 3: Implement pure helpers**

Create `src/lib/dj-booth.ts` with:

```ts
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

export interface WaitlistCandidate {
  id: string;
  user_id: string;
  position: number;
}

export function isMemberPresent(
  lastSeen: string,
  nowMs: number = Date.now()
): boolean {
  return Date.parse(lastSeen) >= nowMs - PRESENCE_WINDOW_MS;
}

/** True when user must join waitlist instead of taking an open deck slot. */
export function shouldJoinWaitlist(
  slotCount: number,
  maxDjs: number,
  waitlistCount: number
): boolean {
  return waitlistCount > 0 || slotCount >= maxDjs;
}

export function pickNextWaitlistEntry(
  entries: WaitlistCandidate[],
  presentUserIds: Set<string>
): { promote: WaitlistCandidate | null; staleIds: string[] } {
  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const staleIds: string[] = [];
  for (const entry of sorted) {
    if (presentUserIds.has(entry.user_id)) {
      return { promote: entry, staleIds };
    }
    staleIds.push(entry.id);
  }
  return { promote: null, staleIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/dj-booth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dj-booth.ts src/lib/dj-booth.test.ts
git commit -m "feat: add pure DJ booth waitlist helpers with tests"
```

---

### Task 2: Async booth lifecycle functions

**Files:**
- Modify: `src/lib/dj-booth.ts`

- [ ] **Step 1: Add async functions**

Append to `src/lib/dj-booth.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { postSystemMessage } from "@/lib/playback";
import { bumpRoomEnergy, ENERGY_BUMP } from "@/lib/room-energy";

export interface RemoveDjResult {
  wasOnDeck: boolean;
  wasWaitlisted: boolean;
  wasCurrentDj: boolean;
  wasPlaying: boolean;
  slotPosition: number | null;
}

export async function promoteFromWaitlist(
  supabase: SupabaseClient,
  roomId: string
): Promise<string | null> {
  const { data: waitlist } = await supabase
    .from("dj_waitlist")
    .select("id, user_id, position")
    .eq("room_id", roomId)
    .order("position");

  if (!waitlist?.length) return null;

  const userIds = waitlist.map((w) => w.user_id);
  const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, last_seen")
    .eq("room_id", roomId)
    .in("user_id", userIds)
    .gte("last_seen", cutoff);

  const presentIds = new Set((members ?? []).map((m) => m.user_id));
  const { promote, staleIds } = pickNextWaitlistEntry(waitlist, presentIds);

  if (staleIds.length) {
    await supabase.from("dj_waitlist").delete().in("id", staleIds);
  }

  if (!promote) {
    if (staleIds.length) {
      await postSystemMessage(
        supabase,
        roomId,
        "Waitlist cleared — the booth is open."
      );
    }
    return null;
  }

  const { data: slots } = await supabase
    .from("dj_slots")
    .select("position")
    .eq("room_id", roomId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (slots?.[0]?.position ?? -1) + 1;

  await supabase.from("dj_slots").insert({
    room_id: roomId,
    user_id: promote.user_id,
    position: nextPosition,
    missed_turns: 0,
  });

  await supabase
    .from("room_members")
    .upsert(
      { room_id: roomId, user_id: promote.user_id, role: "dj" },
      { onConflict: "room_id,user_id" }
    );

  await supabase.from("dj_waitlist").delete().eq("id", promote.id);

  const { data: user } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", promote.user_id)
    .single();

  await postSystemMessage(
    supabase,
    roomId,
    `${user?.display_name || "Someone"} rotated into the booth from the waitlist.`
  );

  await bumpRoomEnergy(supabase, roomId, ENERGY_BUMP.joinDeck);

  return promote.user_id;
}

export async function removeDjFromBooth(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  options: { skipPromotion?: boolean } = {}
): Promise<RemoveDjResult> {
  const { data: leavingSlot } = await supabase
    .from("dj_slots")
    .select("id, position")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: waitlistEntry } = await supabase
    .from("dj_waitlist")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: playback } = await supabase
    .from("room_playback")
    .select("current_dj_user_id, current_track_id")
    .eq("room_id", roomId)
    .maybeSingle();

  const wasOnDeck = !!leavingSlot;
  const wasCurrentDj = playback?.current_dj_user_id === userId;
  const wasPlaying = wasCurrentDj && !!playback?.current_track_id;

  if (leavingSlot) {
    await supabase.from("dj_slots").delete().eq("id", leavingSlot.id);
  }

  if (waitlistEntry) {
    await supabase.from("dj_waitlist").delete().eq("id", waitlistEntry.id);
  }

  if (wasOnDeck) {
    await supabase
      .from("queue_items")
      .delete()
      .eq("room_id", roomId)
      .eq("dj_user_id", userId)
      .eq("status", "queued");

    await supabase
      .from("room_members")
      .update({ role: "listener" })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  }

  if (wasOnDeck && !options.skipPromotion) {
    await promoteFromWaitlist(supabase, roomId);
  }

  return {
    wasOnDeck,
    wasWaitlisted: !!waitlistEntry,
    wasCurrentDj,
    wasPlaying,
    slotPosition: leavingSlot?.position ?? null,
  };
}

export async function processInactiveDjs(
  supabase: SupabaseClient,
  roomId: string
): Promise<number> {
  const { data: inactiveSlots } = await supabase
    .from("dj_slots")
    .select("user_id")
    .eq("room_id", roomId)
    .gte("missed_turns", 3);

  if (!inactiveSlots?.length) return 0;

  let removed = 0;
  for (const slot of inactiveSlots) {
    const { data: user } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", slot.user_id)
      .single();

    await postSystemMessage(
      supabase,
      roomId,
      `${user?.display_name || "A DJ"} was removed from the booth after missing 3 turns.`
    );

    await removeDjFromBooth(supabase, roomId, slot.user_id);
    removed++;
  }

  return removed;
}
```

- [ ] **Step 2: Run existing tests**

Run: `npm test -- src/lib/dj-booth.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/dj-booth.ts
git commit -m "feat: add async DJ booth promotion and removal helpers"
```

---

### Task 3: Refactor `advancePlayback`

**Files:**
- Modify: `src/lib/playback.ts`

- [ ] **Step 1: Import `processInactiveDjs`**

At top of `src/lib/playback.ts`, add:

```ts
import { processInactiveDjs } from "@/lib/dj-booth";
```

- [ ] **Step 2: Always increment missed_turns on empty turn**

Replace the block at lines 207–224:

```ts
    } else if (slots.length > 1) {
      await supabase
        .from("dj_slots")
        .update({ missed_turns: (slot.missed_turns || 0) + 1 })
        .eq("id", slot.id);
      // ...
    }
```

With:

```ts
    } else {
      await supabase
        .from("dj_slots")
        .update({ missed_turns: (slot.missed_turns || 0) + 1 })
        .eq("id", slot.id);

      const { data: djUser } = await supabase
        .from("users")
        .select("display_name")
        .eq("id", slot.user_id)
        .single();

      await postSystemMessage(
        supabase,
        roomId,
        `${djUser?.display_name || "A DJ"} had no track queued — skipping their turn.`
      );
    }
```

- [ ] **Step 3: Replace inline waitlist block with `processInactiveDjs`**

Delete lines 243–288 (the entire `// Rotate out DJs with 3+ missed turns` block).

After the `room_playback` upsert inside `if (!played) { ... }`, add:

```ts
    await processInactiveDjs(supabase, roomId);
```

Also call `processInactiveDjs` at end when `played === true` (after the rotation loop, before `return`):

```ts
  if (played) {
    await processInactiveDjs(supabase, roomId);
  }

  return { advanced: played, reason };
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/playback.ts
git commit -m "feat: use dj-booth inactive processing in advancePlayback"
```

---

### Task 4: Update DJ API route

**Files:**
- Modify: `src/app/api/rooms/[slug]/dj/route.ts`

- [ ] **Step 1: Update imports**

```ts
import { removeDjFromBooth, shouldJoinWaitlist } from "@/lib/dj-booth";
```

Remove direct `postSystemMessage` import only if DELETE no longer uses it inline — keep it for POST paths.

- [ ] **Step 2: Update POST — waitlist priority + duplicate check**

After the `existingSlot` check, add waitlist duplicate check:

```ts
  const { data: existingWaitlist } = await admin
    .from("dj_waitlist")
    .select("id, position")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingWaitlist) {
    return NextResponse.json({ error: "Already on waitlist" }, { status: 400 });
  }

  const { count: waitlistCount } = await admin
    .from("dj_waitlist")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
```

Replace the condition `if ((slotCount || 0) < room.max_djs)` with:

```ts
  if (!shouldJoinWaitlist(slotCount || 0, room.max_djs, waitlistCount || 0)) {
    // ... existing direct join logic unchanged ...
    return NextResponse.json({ slot, waitlisted: false });
  }

  // waitlist join (existing waitlist insert logic)
```

Update waitlist success response to include position for client toast:

```ts
  return NextResponse.json({
    entry,
    waitlisted: true,
    waitlistPosition: nextPosition + 1,
  });
```

Note: `nextPosition` is 0-based index; return 1-based `waitlistPosition` for UI (`nextPosition + 1` after insert — use `entry.position + 1` from DB).

Preferred:

```ts
  return NextResponse.json({
    entry,
    waitlisted: true,
    waitlistPosition: entry.position + 1,
  });
```

- [ ] **Step 3: Update DELETE — use `removeDjFromBooth`**

Replace inline slot/waitlist/queue/role deletes and the old `advancePlayback` guard with:

```ts
  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const result = await removeDjFromBooth(admin, room.id, user.id);

  if (!result.wasOnDeck && !result.wasWaitlisted) {
    return NextResponse.json({ error: "Not on deck or waitlist" }, { status: 400 });
  }

  if (result.wasOnDeck) {
    await postSystemMessage(
      admin,
      room.id,
      result.wasPlaying
        ? `🚪 ${profile?.display_name || "The DJ"} stepped off — track cut short.`
        : `${profile?.display_name || "Someone"} left the booth.`
    );
  }

  if (result.wasCurrentDj) {
    const { advancePlayback } = await import("@/lib/playback");
    await advancePlayback(admin, room.id, result.wasPlaying ? "skipped" : "ended", {
      afterDepartedDjPosition: result.slotPosition ?? undefined,
    });
  }

  return NextResponse.json({ left: true });
```

Remove the old `leavingSlot`, `playback`, and inline delete blocks — `removeDjFromBooth` handles them.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/dj-booth.ts src/app/api/rooms/[slug]/dj/route.ts
git commit -m "feat: enforce waitlist priority and shared booth removal in DJ API"
```

---

### Task 5: RoomClient — toasts and derived state

**Files:**
- Modify: `src/components/room/RoomClient.tsx`

- [ ] **Step 1: Derive waitlist UI state**

After `isUserWaitlisted`, add:

```ts
  const waitlistCount = waitlist.length;
  const waitlistPosition = isUserWaitlisted
    ? waitlist.findIndex((w) => w.user_id === currentUserId) + 1
    : null;
  const deckJoinMode: "deck" | "waitlist" =
    djSlots.length >= room.max_djs || waitlistCount > 0 ? "waitlist" : "deck";
  const canJoinDeck = !isUserDj && !isUserWaitlisted && !!currentUserId;
```

- [ ] **Step 2: Fix join toast**

Update `handleJoinDeck`:

```ts
      if (res.ok) {
        if (data.waitlisted) {
          const pos = data.waitlistPosition ?? waitlistCount + 1;
          showToast(`You're #${pos} in line for the booth`);
        } else {
          showToast("You're on the deck — line up a track");
          flingBurst("★", "#ffd166", 3);
        }
        await refresh();
      }
```

- [ ] **Step 3: Add leave waitlist handler**

```ts
  const handleLeaveWaitlist = async () => {
    setDeckLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.slug}/dj`, { method: "DELETE" });
      if (res.ok) {
        showToast("Left the waitlist");
        await refresh();
      }
    } finally {
      setDeckLoading(false);
    }
  };
```

- [ ] **Step 4: Pass props to VenueCanvas**

Add to `<VenueCanvas ...>`:

```tsx
              waitlistCount={waitlistCount}
              waitlistPosition={waitlistPosition}
              deckJoinMode={deckJoinMode}
              onLeaveWaitlist={handleLeaveWaitlist}
```

- [ ] **Step 5: Pass waitlist to RoomSidePanel**

Add prop `waitlist={waitlist}` to `<RoomSidePanel ...>`.

- [ ] **Step 6: Commit**

```bash
git add src/components/room/RoomClient.tsx
git commit -m "feat: wire waitlist state and toasts in RoomClient"
```

---

### Task 6: VenueCanvas waitlist UI

**Files:**
- Modify: `src/components/venue/VenueCanvas.tsx`

- [ ] **Step 1: Extend `DeckSlotProps` and `VenueCanvasProps`**

Add to `DeckSlotProps`:

```ts
  joinLabel?: string;
```

Use in empty slot button text — replace hardcoded `JOIN DECK` with `{joinLabel ?? "JOIN DECK"}`.

Add to `VenueCanvasProps`:

```ts
  waitlistCount: number;
  waitlistPosition: number | null;
  deckJoinMode: "deck" | "waitlist";
  onLeaveWaitlist: () => void;
```

- [ ] **Step 2: Destructure new props in `VenueCanvas`**

```ts
  waitlistCount,
  waitlistPosition,
  deckJoinMode,
  onLeaveWaitlist,
```

Compute: `const joinLabel = deckJoinMode === "waitlist" ? "JOIN WAITLIST" : "JOIN DECK";`

Pass `joinLabel={joinLabel}` to both `DeckSlot` components.

- [ ] **Step 3: Add waitlist count pill**

Below the center DJ block (after `{/* Center DJ */}` section, before `{/* Right deck */}`), add when `waitlistCount > 0`:

```tsx
      {waitlistCount > 0 && (
        <div
          className="absolute z-[12] pointer-events-none"
          style={{
            top: "33%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <span
            className="px-2.5 py-1 rounded-full font-bold text-[10px] tracking-wide"
            style={{
              background: "rgba(123, 92, 255, 0.18)",
              border: "1px solid rgba(123, 92, 255, 0.35)",
              color: "var(--neon)",
            }}
          >
            {waitlistCount} waiting
          </span>
        </div>
      )}
```

- [ ] **Step 4: Add waitlist chip for current user**

When `waitlistPosition != null`, render near bottom of venue scene (above crowd, pointer-events-auto):

```tsx
      {waitlistPosition != null && (
        <div
          className="absolute z-[15] flex items-center gap-2 pointer-events-auto"
          style={{
            bottom: "18%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <span
            className="px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{
              background: "#ffffff10",
              border: "1px solid var(--line)",
              color: "var(--txt)",
            }}
          >
            You&apos;re #{waitlistPosition} in line
          </span>
          <button
            type="button"
            onClick={onLeaveWaitlist}
            disabled={deckLoading}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold disabled:opacity-50"
            style={{
              border: "1px solid var(--line)",
              background: "#ffffff10",
              color: "var(--sub)",
            }}
          >
            Leave waitlist
          </button>
        </div>
      )}
```

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/components/venue/VenueCanvas.tsx
git commit -m "feat: show waitlist count and join/leave UI in venue"
```

---

### Task 7: Room Info tab waitlist list

**Files:**
- Modify: `src/components/venue/RoomSidePanel.tsx`

- [ ] **Step 1: Add prop**

Import `DjWaitlistEntry` from `@/lib/types`. Add to `RoomSidePanelProps`:

```ts
  waitlist?: DjWaitlistEntry[];
```

Default `waitlist = []` in destructuring.

- [ ] **Step 2: Render waitlist in info tab**

After the decks-filled stat block, before `ON THE FLOOR`:

```tsx
          {waitlist.length > 0 && (
            <div>
              <div className="text-[11px] text-muted tracking-wide mb-2">
                DJ WAITLIST ({waitlist.length})
              </div>
              <ol className="flex flex-col gap-1">
                {[...waitlist]
                  .sort((a, b) => a.position - b.position)
                  .map((entry, index) => (
                    <li
                      key={entry.id}
                      className="text-[12.5px] text-[var(--txt)]"
                    >
                      {index + 1}. {entry.user?.display_name || "Anonymous"}
                    </li>
                  ))}
              </ol>
            </div>
          )}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/venue/RoomSidePanel.tsx
git commit -m "feat: show ordered DJ waitlist in Room Info tab"
```

---

### Task 8: Manual verification checklist

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run dev server and verify manually**

Run: `npm run dev`

| Scenario | Expected |
|----------|----------|
| Fill 3 DJ slots, crowd user taps JOIN WAITLIST | Toast `#N in line`, pill shows `N waiting` |
| DJ steps off | Next present waiter promoted, system chat message |
| Waitlisted user taps Leave waitlist | Removed from list, pill updates |
| DJ with no queue skipped 3 rotations | Removed to crowd, waiter promoted |
| Open slot + empty waitlist | JOIN DECK works as before |
| Room Info tab | Ordered waitlist names when non-empty |

- [ ] **Step 3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address waitlist manual test findings"
```

(Skip if no fixups.)

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Join waitlist when full | Task 4 POST |
| Waitlist priority over open slots | Task 1 `shouldJoinWaitlist`, Task 4 POST |
| Visible waitlist count | Task 6 pill |
| Room Info ordered list | Task 7 |
| Promote on step-off | Task 2 `removeDjFromBooth`, Task 4 DELETE |
| 5-minute presence on promote | Task 2 `promoteFromWaitlist` |
| Remove stale absent waitlist entries | Task 2 `promoteFromWaitlist` |
| 3 missed turns → demote + promote | Task 2 `processInactiveDjs`, Task 3 |
| Increment missed_turns on all empty skips | Task 3 |
| Join/leave toasts | Task 5 |
| Realtime (no new tables) | Existing hooks unchanged |
