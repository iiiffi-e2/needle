# Honest Front Door Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Needle's front door and empty booth tell the truth: only badge rooms that are actually spinning, stop inventing a crowd on the landing page, show friends and rooms you've joined when they are live, and keep a room audible from its own played history when no human DJ has a track.

**Architecture:** Pure classifiers in `room-liveness`, `floor-return`, and `house-crate` decide what is spinning, who to surface, and which past track the house plays. The directory, landing page, and a polled in-app toast render those results. `advancePlayback` calls the house picker only after every human deck has been given a turn. No new catalog, no push, no email, no saved-rooms table.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase (service-role writes, one SQL migration), existing Tailwind venue styles.

## Global Constraints

- A room is `spinning` only when `current_track` is non-null and (`listener_count > 0` or `dj_count > 0`). `open` means people are present and no track is playing. `quiet` means `listener_count === 0` and `dj_count === 0`.
- The word `LIVE` appears only on `spinning` rooms. `open` rooms say `OPEN`. `quiet` rooms say `QUIET`.
- Landing and directory must not render invented listener counts, room names, track titles, DJ names, quotes, or stat totals. Hero illustration blobs may stay. Named copy such as `vinyl_vera` and `Midnight Pretenders` may not.
- Listener total of zero renders as `0`. Never fall back to `1,204`.
- Public directory still lists quiet rooms, below spinning and open, so an empty venue is visible. It does not pretend they are live.
- "Come back" means: friends who are in a room you can join, and public rooms you have a `room_members` row for that are spinning while you are outside the presence window. No favorites table. No email. No web push.
- The first poll after load does not toast. Later polls toast only keys that were absent last time.
- Private rooms stay out of the public directory. Friend pings omit friends whose presence has `canJoin === false`.
- House music comes only from that room's `queue_items` with `status = 'played'`. If that history is empty, the booth stays silent. Do not seed a YouTube catalog.
- A house spin sets `queue_items.is_house = true`, `dj_user_id = null`, and `room_playback.current_dj_user_id = null`. It does not increment `tracks_played` and does not call `checkTrackPlayBadges`.
- Human decks always get the next turn before the house. House runs only when the human loop would otherwise clear playback (`no_djs`, or no human had a queued track).
- Do not rewrite `GET /api/rooms` into a single SQL join. Leave the existing per-room counts.
- Tests are Vitest. Run `npx vitest run <file>` from the repo root. No new dependencies.
- Copy stays in the existing warm venue voice. Do not add a dashboard tone.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/room-liveness.ts` | `roomLiveness`, `partitionRooms` |
| `src/lib/room-liveness.test.ts` | Classifier tests |
| `src/components/room/RoomCard.tsx` | Badge from liveness |
| `src/components/room/RoomDirectory.tsx` | Three sections: spinning, open, quiet |
| `src/lib/landing-honesty.ts` | `formatListenerCount`, `landingMarquee`, `spinningRooms` |
| `src/lib/landing-honesty.test.ts` | Landing truth tests |
| `src/components/landing/LandingPage.tsx` | Real count, pass spinning rooms and friend data |
| `src/components/landing/LiveRoomsSection.tsx` | Real rooms only; empty state when none are spinning |
| `src/components/landing/SocialProofSection.tsx` | Two live numbers, no quotes |
| `src/components/landing/HeroVenue.tsx` | Real marquee and deck label |
| `src/components/landing/landing-data.ts` | Drop fake `STATS`, `QUOTES`, `MARQUEE`; keep visual skins |
| `src/lib/floor-return.ts` | Friends on the floor, your live rooms, ping diff |
| `src/lib/floor-return.test.ts` | Return-loop tests |
| `src/app/api/me/live/route.ts` | Auth'd snapshot for the landing strip and the toast |
| `src/components/landing/FriendsOnTheFloor.tsx` | Logged-in strip |
| `src/components/shared/FriendFloorToast.tsx` | In-app ping while the tab is open |
| `src/app/layout.tsx` | Mount the toast next to `InviteToast` |
| `src/lib/house-crate.ts` | `pickHouseTrack` |
| `src/lib/house-crate.test.ts` | House picker tests |
| `supabase/migrations/008_house_queue.sql` | Nullable DJ on house queue rows |
| `src/lib/types.ts` | `QueueItem.is_house`, nullable `dj_user_id` |
| `src/lib/playback.ts` | Call the house after the human loop fails |
| `src/components/venue/NowPlayingPanel.tsx` | "played by House" |
| `src/components/venue/VenueCanvas.tsx` | Center deck says House while a house track plays |
| `README.md` | List migration `008` |

---

### Task 1: Room liveness classifier

**Files:**
- Create: `src/lib/room-liveness.ts`
- Test: `src/lib/room-liveness.test.ts`

**Interfaces:**
- Consumes: `RoomWithStats` from `src/lib/types.ts` (`listener_count`, `dj_count`, `current_track`)
- Produces:
  - `export type RoomLiveness = "spinning" | "open" | "quiet"`
  - `export function roomLiveness(room: Pick<RoomWithStats, "listener_count" | "dj_count" | "current_track">): RoomLiveness`
  - `export function partitionRooms<T extends Pick<RoomWithStats, "listener_count" | "dj_count" | "current_track" | "name">>(rooms: T[]): { spinning: T[]; open: T[]; quiet: T[] }`
  - Sort: `spinning` and `open` by `listener_count` descending, then `name` ascending. `quiet` by `name` ascending.

- [ ] **Step 1: Write the failing test**

Create `src/lib/room-liveness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { partitionRooms, roomLiveness } from "./room-liveness";

const track = { id: "t1" } as const;

describe("roomLiveness", () => {
  it("is spinning when a track is playing and someone is listening", () => {
    expect(
      roomLiveness({ listener_count: 2, dj_count: 0, current_track: track })
    ).toBe("spinning");
  });

  it("is spinning when a track is playing and a DJ is on deck even with zero listeners", () => {
    expect(
      roomLiveness({ listener_count: 0, dj_count: 1, current_track: track })
    ).toBe("spinning");
  });

  it("is open when people are there and nothing is playing", () => {
    expect(
      roomLiveness({ listener_count: 3, dj_count: 1, current_track: null })
    ).toBe("open");
  });

  it("is quiet when a track is set but nobody is present", () => {
    expect(
      roomLiveness({ listener_count: 0, dj_count: 0, current_track: track })
    ).toBe("quiet");
  });

  it("is quiet when the room is empty", () => {
    expect(
      roomLiveness({ listener_count: 0, dj_count: 0, current_track: null })
    ).toBe("quiet");
  });
});

describe("partitionRooms", () => {
  it("orders spinning by listeners, then name, and parks empty rooms last", () => {
    const rooms = [
      { name: "Zebra", listener_count: 1, dj_count: 0, current_track: track },
      { name: "Alpha", listener_count: 4, dj_count: 0, current_track: track },
      { name: "Booth", listener_count: 2, dj_count: 0, current_track: null },
      { name: "Muted", listener_count: 9, dj_count: 0, current_track: null },
      { name: "Empty", listener_count: 0, dj_count: 0, current_track: null },
    ];
    const parts = partitionRooms(rooms);
    expect(parts.spinning.map((r) => r.name)).toEqual(["Alpha", "Zebra"]);
    expect(parts.open.map((r) => r.name)).toEqual(["Muted", "Booth"]);
    expect(parts.quiet.map((r) => r.name)).toEqual(["Empty"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/room-liveness.test.ts`

Expected: FAIL with cannot find module `./room-liveness`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/room-liveness.ts`:

```ts
import type { RoomWithStats } from "@/lib/types";

export type RoomLiveness = "spinning" | "open" | "quiet";

type LivenessInput = Pick<
  RoomWithStats,
  "listener_count" | "dj_count" | "current_track"
>;

export function roomLiveness(room: LivenessInput): RoomLiveness {
  const people = room.listener_count > 0 || room.dj_count > 0;
  if (!people) return "quiet";
  if (room.current_track) return "spinning";
  return "open";
}

export function partitionRooms<T extends LivenessInput & { name: string }>(
  rooms: T[]
): { spinning: T[]; open: T[]; quiet: T[] } {
  const spinning: T[] = [];
  const open: T[] = [];
  const quiet: T[] = [];

  for (const room of rooms) {
    const state = roomLiveness(room);
    if (state === "spinning") spinning.push(room);
    else if (state === "open") open.push(room);
    else quiet.push(room);
  }

  const byCrowd = (a: T, b: T) =>
    b.listener_count - a.listener_count || a.name.localeCompare(b.name);

  spinning.sort(byCrowd);
  open.sort(byCrowd);
  quiet.sort((a, b) => a.name.localeCompare(b.name));

  return { spinning, open, quiet };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/room-liveness.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/room-liveness.ts src/lib/room-liveness.test.ts
git commit -m "feat: classify rooms as spinning, open, or quiet"
```

---

### Task 2: Directory badges and sections

**Files:**
- Modify: `src/components/room/RoomCard.tsx`
- Modify: `src/components/room/RoomDirectory.tsx`

**Interfaces:**
- Consumes: `roomLiveness`, `partitionRooms` from Task 1
- Produces: directory UI. Spinning section heading `Spinning right now`. Open heading `Booth is open`. Quiet heading `Quiet rooms`. Omit a section when its array is empty. If all three are empty, keep the existing empty state (create room / seed).

- [ ] **Step 1: Update RoomCard**

In `src/components/room/RoomCard.tsx`, import `roomLiveness` and replace the hardcoded LIVE badge.

The badge span must branch:

- `spinning`: label `LIVE`, classes stay the current green badge classes (`border-[color-mix(in_srgb,#36e07f_40%,transparent)] bg-[color-mix(in_srgb,#36e07f_15%,transparent)] text-[#36e07f]`)
- `open`: label `OPEN`, classes `border-[color-mix(in_srgb,var(--ndl-glow)_40%,transparent)] bg-[color-mix(in_srgb,var(--ndl-glow)_15%,transparent)] text-glow-soft`
- `quiet`: label `QUIET`, classes `border-[var(--ndl-line)] bg-[#ffffff08] text-muted`

Keep the track block, listener count, and dj count as they are. Do not invent a listener count.

- [ ] **Step 2: Update RoomDirectory**

Replace the single grid at the bottom of `src/components/room/RoomDirectory.tsx` (the `return` that maps every room into `RoomCard`) with three sections built from `partitionRooms(rooms)`.

Each section is a `div` with an `h2` (`font-display text-xl font-extrabold mb-4`) and the existing `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`. Render spinning, then open, then quiet. Wrap them in `className="space-y-10"`.

Leave the loading skeleton and the zero-room empty state unchanged.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/room/RoomCard.tsx src/components/room/RoomDirectory.tsx
git commit -m "feat: split the directory into spinning, open, and quiet rooms"
```

---

### Task 3: Landing page stops inventing a crowd

**Files:**
- Create: `src/lib/landing-honesty.ts`
- Create: `src/lib/landing-honesty.test.ts`
- Modify: `src/components/landing/LandingPage.tsx`
- Modify: `src/components/landing/LiveRoomsSection.tsx`
- Modify: `src/components/landing/SocialProofSection.tsx`
- Modify: `src/components/landing/HeroVenue.tsx`
- Modify: `src/components/landing/landing-data.ts`

**Interfaces:**
- Consumes: `partitionRooms` from Task 1. `RoomWithStats`.
- Produces:
  - `export function formatListenerCount(total: number): string` — finite values below 0 become `"0"`. Otherwise `Math.floor(total).toLocaleString("en-US")`.
  - `export function landingMarquee(room: { name: string; current_track?: { title: string; artist?: string | null } | null } | null): string`
    - No room: `"THE BOOTH IS OPEN · "`
    - Room with a track: `"NOW SPINNING · {title} — {artist} · {room name} · "` when artist is non-empty, otherwise `"NOW SPINNING · {title} · {room name} · "`
  - `export function heroDeckLabel(room: { current_dj?: { display_name: string | null } | null; current_track?: unknown | null } | null): string | null`
    - `null` room or no track: `null` (caller hides the pill)
    - track and a display name: `"{name} · ON DECK"`
    - track and no DJ: `"House · SPINNING"`

- [ ] **Step 1: Write the failing test**

Create `src/lib/landing-honesty.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatListenerCount,
  heroDeckLabel,
  landingMarquee,
} from "./landing-honesty";

describe("formatListenerCount", () => {
  it("renders zero as 0", () => {
    expect(formatListenerCount(0)).toBe("0");
  });

  it("renders a real total with separators", () => {
    expect(formatListenerCount(1204)).toBe("1,204");
  });

  it("rejects a missing total", () => {
    expect(formatListenerCount(Number.NaN)).toBe("0");
    expect(formatListenerCount(-3)).toBe("0");
  });
});

describe("landingMarquee", () => {
  it("does not invent a song when nothing is spinning", () => {
    expect(landingMarquee(null)).toBe("THE BOOTH IS OPEN · ");
  });

  it("uses the room's real track", () => {
    expect(
      landingMarquee({
        name: "Late Night Indie Funeral",
        current_track: { title: "Nightswimming", artist: "R.E.M." },
      })
    ).toBe("NOW SPINNING · Nightswimming — R.E.M. · Late Night Indie Funeral · ");
  });
});

describe("heroDeckLabel", () => {
  it("hides the deck pill when the booth is empty", () => {
    expect(heroDeckLabel(null)).toBeNull();
  });

  it("names the real DJ", () => {
    expect(
      heroDeckLabel({
        current_track: { title: "x" },
        current_dj: { display_name: "mossy" },
      })
    ).toBe("mossy · ON DECK");
  });

  it("says House when a track is playing with no DJ", () => {
    expect(
      heroDeckLabel({ current_track: { title: "x" }, current_dj: null })
    ).toBe("House · SPINNING");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/landing-honesty.test.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/landing-honesty.ts` with the three functions specified in Interfaces. Use `toLocaleString("en-US")`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/landing-honesty.test.ts`

Expected: PASS.

- [ ] **Step 5: Remove the fake catalog from landing data**

In `src/components/landing/landing-data.ts`:

- Delete `export const STATS`, `export const QUOTES`, and `export const MARQUEE`.
- Keep `LANDING_ROOMS` only as visual skins. Remove `slug`, `name`, `track`, `count`, and `tag` from each object so those fields cannot be rendered. Keep `bg`, `glow`, `stage`, `dj`, `blobs`.
- Rename the export to `ROOM_SKINS`. Update the only importer (`LiveRoomsSection`) in the next step. Delete `LANDING_ROOMS`.

- [ ] **Step 6: Render only real spinning rooms**

`LiveRoomsSection` props stay `{ rooms?: RoomWithStats[] }`.

- Call `partitionRooms(rooms ?? [])` and render `spinning` only, sliced to 4.
- Map each room onto `ROOM_SKINS[i % ROOM_SKINS.length]` for `bg`, `glow`, `stage`, `dj`, `blobs` only.
- Track line: `room.current_track.title`, plus ` — ${artist}` when artist is set. If `current_track` is missing, skip the card (a spinning room always has one; do not substitute a fake title).
- Count badge: `String(room.listener_count)`.
- Tag: `room.tags[0] ?? "live"`.
- When `spinning.length === 0`, do not render cards. Render a centered block: heading `Nothing is spinning yet` and body `Open a room, take a deck, and the floor will show up here.` Link `Create a room` to `/rooms/create` using the existing glow link style (`text-[15px] font-bold text-[var(--glow2)]`).

- [ ] **Step 7: Honest hero count, marquee, and deck label**

`LandingPage.tsx`:

- Initial `liveCount` state is `"0"`, not `"1,204"`.
- After a successful `/api/rooms` fetch, `setLiveCount(formatListenerCount(sum of listener_count))` even when the sum is 0.
- On fetch failure, leave the count at `"0"`.
- Compute `const headline = partitionRooms(rooms).spinning[0] ?? null` and pass `marquee={landingMarquee(headline)}` and `deckLabel={heroDeckLabel(headline)}` into `HeroVenue`. `HeroStatement` does not show a marquee; only pass `liveCount` there, which is already real.

`HeroVenue.tsx`:

- Replace the `MARQUEE` import and both `{MARQUEE}` renders with the `marquee` prop, rendered twice so the ticker still loops.
- Replace the `vinyl_vera · ON DECK` span: if `deckLabel` is null, do not render that pill. Otherwise render `deckLabel`.
- Replace the hero description sentence `Someone's always on deck, the crowd reacts in real time, and you're already on the floor.` with `Take a deck, drop a song, and everyone in the room hears it with you.`

- [ ] **Step 8: Replace fake social proof**

`SocialProofSection` props: `{ spinningCount: number; listenerTotal: number }`.

Delete the `QUOTES` grid and the `STATS` import. Render two figures:

- value `formatListenerCount(listenerTotal)`, label `on the floor`
- value `formatListenerCount(spinningCount)`, label `rooms spinning`

When both are 0, under the figures render: `No rooms spinning yet. The numbers show up when someone is actually here.`

Replace the heading `People are losing it.` with `Right now.` Delete the subtitle `(affectionately)`.

`LandingPage` passes `spinningCount={partitionRooms(rooms).spinning.length}` and `listenerTotal` equal to the same sum used for the hero.

- [ ] **Step 9: Tests and typecheck**

Run: `npx vitest run src/lib/landing-honesty.test.ts src/lib/room-liveness.test.ts`

Run: `npx tsc --noEmit`

Expected: PASS and exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/lib/landing-honesty.ts src/lib/landing-honesty.test.ts src/components/landing/LandingPage.tsx src/components/landing/LiveRoomsSection.tsx src/components/landing/SocialProofSection.tsx src/components/landing/HeroVenue.tsx src/components/landing/landing-data.ts
git commit -m "fix: show real listener counts and only rooms that are spinning"
```

---

### Task 4: Friends and your rooms on the front door

**Files:**
- Create: `src/lib/floor-return.ts`
- Create: `src/lib/floor-return.test.ts`
- Create: `src/app/api/me/live/route.ts`
- Create: `src/components/landing/FriendsOnTheFloor.tsx`
- Modify: `src/components/landing/LandingPage.tsx`

**Interfaces:**
- Consumes: `FriendWithPresence` (`presence.canJoin`, `presence.roomSlug`, `presence.roomName`, `presence.roomId`, `user.display_name`, `user.id`). `PRESENCE_WINDOW_MS` from `src/lib/dj-booth.ts` (`5 * 60 * 1000`). `listFriends` from `src/lib/friends.ts`. `list` pattern in `src/app/api/rooms/route.ts` `GET` (public rooms, not private, with `listener_count`, `dj_count`, `current_track`).
- Produces:
  - `export function friendsOnTheFloor(friends: FriendWithPresence[]): FriendWithPresence[]` — keep rows where `presence.canJoin && presence.roomSlug && presence.roomId`. Stable order: room name, then display name.
  - `export function yourLiveRooms<T extends { id: string; name: string }>(spinning: T[], memberships: { roomId: string; lastSeen: string }[], nowMs: number, presenceWindowMs?: number): T[]` — default window `PRESENCE_WINDOW_MS`. Include a spinning room when the user has a membership and `Date.parse(lastSeen)` is older than `nowMs - presenceWindowMs` (they are not currently in it). Sort by `name`.
  - `GET /api/me/live` returns `401` when logged out. When logged in:

```ts
{
  friends: FriendWithPresence[]; // friendsOnTheFloor only
  yourRooms: { id: string; name: string; slug: string }[];
}
```

  - `FriendsOnTheFloor` renders nothing when both arrays are empty. Otherwise a section titled `Where people you know are`. Friend rows link to `/rooms/${presence.roomSlug}` with text `{display_name} is in {roomName}`. Your-room rows link to `/rooms/${slug}` with text `{name} is spinning`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/floor-return.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FriendWithPresence } from "@/lib/types";
import { friendsOnTheFloor, yourLiveRooms } from "./floor-return";

function friend(
  name: string,
  presence: Partial<FriendWithPresence["presence"]>
): FriendWithPresence {
  return {
    user: {
      id: name,
      email: null,
      display_name: name,
      avatar_url: null,
      avatar_color: null,
      created_at: "",
    },
    presence: {
      roomId: null,
      roomName: null,
      roomSlug: null,
      isPrivate: false,
      canJoin: false,
      ...presence,
    },
  };
}

describe("friendsOnTheFloor", () => {
  it("keeps friends in rooms you can join", () => {
    const rows = friendsOnTheFloor([
      friend("Ada", {
        roomId: "r1",
        roomName: "Booth",
        roomSlug: "booth",
        canJoin: true,
      }),
      friend("Bea", {
        roomId: "r2",
        roomName: "Locked",
        roomSlug: null,
        canJoin: false,
        isPrivate: true,
      }),
      friend("Cy", {}),
    ]);
    expect(rows.map((r) => r.user.display_name)).toEqual(["Ada"]);
  });
});

describe("yourLiveRooms", () => {
  const spinning = [
    { id: "live", name: "Live" },
    { id: "other", name: "Other" },
  ];
  const now = Date.parse("2026-10-08T22:00:00.000Z");
  const windowMs = 5 * 60 * 1000;

  it("includes a spinning room you have left", () => {
    const rows = yourLiveRooms(
      spinning,
      [{ roomId: "live", lastSeen: "2026-10-08T21:00:00.000Z" }],
      now,
      windowMs
    );
    expect(rows.map((r) => r.id)).toEqual(["live"]);
  });

  it("hides a room you are still inside", () => {
    const rows = yourLiveRooms(
      spinning,
      [{ roomId: "live", lastSeen: "2026-10-08T21:58:00.000Z" }],
      now,
      windowMs
    );
    expect(rows).toEqual([]);
  });

  it("ignores spinning rooms you have never joined", () => {
    const rows = yourLiveRooms(spinning, [], now, windowMs);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/floor-return.test.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/floor-return.ts` implementing the two functions. Import `PRESENCE_WINDOW_MS` from `@/lib/dj-booth` and `FriendWithPresence` from `@/lib/types`.

Sort friends with:

```ts
rows.sort((a, b) => {
  const room = (a.presence.roomName ?? "").localeCompare(b.presence.roomName ?? "");
  if (room !== 0) return room;
  return (a.user.display_name ?? "").localeCompare(b.user.display_name ?? "");
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/floor-return.test.ts`

Expected: PASS.

- [ ] **Step 5: Add GET /api/me/live**

Follow `src/app/api/friends/route.ts` for auth (`createClient` + `getUser`) and `createServiceClient`.

1. If no user, `401` `{ error: "Unauthorized" }`.
2. Load public rooms the same way as `GET` in `src/app/api/rooms/route.ts` (copy that per-room listener, dj, and playback lookup; do not extract a shared helper in this task). Run `partitionRooms` and keep `spinning`.
3. Load `room_members` for `user.id` selecting `room_id, last_seen`.
4. `yourLiveRooms(spinning, memberships mapped to { roomId, lastSeen }, Date.now())`.
5. `friendsOnTheFloor(await listFriends(admin, user.id))`. If `listFriends` throws a missing-table error, treat friends as `[]` the same way `/api/friends` does.
6. Return `{ friends, yourRooms: yourLive mapped to { id, name, slug } }`.

- [ ] **Step 6: Render the strip**

Create `src/components/landing/FriendsOnTheFloor.tsx` as a client component. Props:

```ts
{
  friends: FriendWithPresence[];
  yourRooms: { id: string; name: string; slug: string }[];
}
```

Return `null` when both arrays are empty. Otherwise a `<section>` with heading `Where people you know are` and a list of links. Place it in `LandingPage` immediately above `LiveRoomsSection`, only when `isLoggedIn`. Fetch `/api/me/live` in the existing `useEffect` when `isLoggedIn` is true. Store the JSON. Ignore a non-OK response and render nothing.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/floor-return.ts src/lib/floor-return.test.ts src/app/api/me/live/route.ts src/components/landing/FriendsOnTheFloor.tsx src/components/landing/LandingPage.tsx
git commit -m "feat: lead the front door with friends and rooms you have joined"
```

---

### Task 5: In-app ping when a friend or your room goes live

**Files:**
- Modify: `src/lib/floor-return.ts`
- Modify: `src/lib/floor-return.test.ts`
- Create: `src/components/shared/FriendFloorToast.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/me/live` from Task 4. `FriendWithPresence`.
- Produces:
  - `export interface FloorPing { id: string; href: string; label: string }`
  - `export function floorPingsFrom(friends: FriendWithPresence[], yourRooms: { id: string; name: string; slug: string }[]): FloorPing[]`
    - Friend id: `friend:{user.id}`. href: `/rooms/{roomSlug}`. label: `{display_name || "A friend"} is in {roomName}`.
    - Room id: `room:{id}`. href: `/rooms/{slug}`. label: `{name} is spinning`.
    - Friends first, then your rooms. Skip a your-room ping when a friend ping already uses that same `href` (the friend line is enough).
  - `export function nextFloorPings(previousIds: string[] | null, next: FloorPing[]): FloorPing[]`
    - `previousIds === null` returns `[]` (first snapshot).
    - Otherwise return `next` entries whose `id` is not in `previousIds`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/floor-return.test.ts`:

Add `floorPingsFrom` and `nextFloorPings` to the existing import from `./floor-return`. Then append:

```ts
describe("nextFloorPings", () => {
  const ada = {
    id: "friend:ada",
    href: "/rooms/booth",
    label: "Ada is in Booth",
  };

  it("does not toast the first snapshot", () => {
    expect(nextFloorPings(null, [ada])).toEqual([]);
  });

  it("toasts only ids that were not in the previous snapshot", () => {
    expect(nextFloorPings(["friend:ada"], [ada, { ...ada, id: "room:live", label: "Live is spinning", href: "/rooms/live" }])).toEqual([
      { id: "room:live", href: "/rooms/live", label: "Live is spinning" },
    ]);
  });
});

describe("floorPingsFrom", () => {
  it("skips a room ping when a friend is already announcing that room", () => {
    const pings = floorPingsFrom(
      [
        friend("Ada", {
          roomId: "r1",
          roomName: "Booth",
          roomSlug: "booth",
          canJoin: true,
        }),
      ],
      [{ id: "r1", name: "Booth", slug: "booth" }]
    );
    expect(pings.map((p) => p.id)).toEqual(["friend:Ada"]);
  });
});
```

`friend()` is already defined in this file from Task 4. User id is the name, so the ping id is `friend:Ada`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/floor-return.test.ts`

Expected: FAIL, `floorPingsFrom` is not exported.

- [ ] **Step 3: Implement the ping helpers**

Add `FloorPing`, `floorPingsFrom`, and `nextFloorPings` to `src/lib/floor-return.ts`. Build friend pings from `friendsOnTheFloor(friends)` so private rooms stay out. Dedupe your rooms by href.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/floor-return.test.ts`

Expected: PASS.

- [ ] **Step 5: Toast component**

Create `src/components/shared/FriendFloorToast.tsx`.

- On mount, `createClient()` from `@/lib/supabase/client` and `getUser()`. If no user, render null and do not poll.
- Poll `GET /api/me/live` immediately, then every 30 seconds. Clear the interval on unmount.
- Keep `previousIds` in a ref. First successful response: set the ref to the ping ids and show nothing (`nextFloorPings(null, ...)`).
- Later responses: `nextFloorPings(previous, pings)`. If any, show the first one. Update the ref to the full current id list after computing the diff.
- UI: fixed bottom-right card, above the invite toast (`bottom-24 right-4 z-50`, max width 320). Text is `ping.label`. Link button `Join` goes to `ping.href` via `useRouter`. Button `Dismiss` clears local state. Do not call a dismiss API. There is no server row.
- If `/api/me/live` returns non-OK, skip that tick.

Mount `<FriendFloorToast />` in `src/app/layout.tsx` directly after `<InviteToast />`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/floor-return.ts src/lib/floor-return.test.ts src/components/shared/FriendFloorToast.tsx src/app/layout.tsx
git commit -m "feat: ping when a friend or a room you joined starts spinning"
```

---

### Task 6: House track picker

**Files:**
- Create: `src/lib/house-crate.ts`
- Create: `src/lib/house-crate.test.ts`
- Create: `supabase/migrations/008_house_queue.sql`
- Modify: `src/lib/types.ts`
- Modify: `README.md` (add `008_house_queue.sql` to the migration list in Getting Started)

**Interfaces:**
- Produces:
  - `export interface HouseHistoryEntry { trackId: string; playedAt: string }`
  - `export function pickHouseTrack(history: HouseHistoryEntry[], excludeTrackId: string | null): string | null`
  - Collapse history to the latest `playedAt` per `trackId`.
  - Candidates are every track except `excludeTrackId`.
  - Return the candidate with the oldest latest-played time. Tie-break by `trackId` ascending.
  - If the only known track is `excludeTrackId`, return that id (replay it).
  - If history is empty, or exclude is set and it was never in history and nothing else exists, return `null`.

Migration `supabase/migrations/008_house_queue.sql`:

```sql
ALTER TABLE public.queue_items
  ALTER COLUMN dj_user_id DROP NOT NULL;

ALTER TABLE public.queue_items
  ADD COLUMN IF NOT EXISTS is_house BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.queue_items
  DROP CONSTRAINT IF EXISTS queue_items_dj_or_house;

ALTER TABLE public.queue_items
  ADD CONSTRAINT queue_items_dj_or_house
  CHECK (
    (is_house = TRUE AND dj_user_id IS NULL)
    OR (is_house = FALSE AND dj_user_id IS NOT NULL)
  );
```

In `QueueItem`, set `dj_user_id: string | null` and add `is_house?: boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/house-crate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickHouseTrack } from "./house-crate";

describe("pickHouseTrack", () => {
  it("returns null when the room has never played anything", () => {
    expect(pickHouseTrack([], null)).toBeNull();
  });

  it("picks the track that has been quiet the longest", () => {
    const id = pickHouseTrack(
      [
        { trackId: "new", playedAt: "2026-10-08T21:00:00.000Z" },
        { trackId: "old", playedAt: "2026-10-08T18:00:00.000Z" },
        { trackId: "old", playedAt: "2026-10-08T19:00:00.000Z" },
      ],
      "new"
    );
    expect(id).toBe("old");
  });

  it("does not immediately replay the track that just finished when another exists", () => {
    const id = pickHouseTrack(
      [
        { trackId: "just", playedAt: "2026-10-08T21:00:00.000Z" },
        { trackId: "other", playedAt: "2026-10-08T20:00:00.000Z" },
      ],
      "just"
    );
    expect(id).toBe("other");
  });

  it("replays the only track the room has", () => {
    expect(
      pickHouseTrack(
        [{ trackId: "only", playedAt: "2026-10-08T21:00:00.000Z" }],
        "only"
      )
    ).toBe("only");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/house-crate.test.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement the picker**

Create `src/lib/house-crate.ts` with `pickHouseTrack` matching the interface. Latest-played map, then sort candidates by `playedAt` ascending, then `trackId` ascending.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/house-crate.test.ts`

Expected: PASS.

- [ ] **Step 5: Migration, type, README**

Write the SQL file exactly as specified. Update `QueueItem`. In `README.md` Getting Started step 4, add a bullet `008_house_queue.sql` after `007_stress_bot_write_guard.sql`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/house-crate.ts src/lib/house-crate.test.ts supabase/migrations/008_house_queue.sql src/lib/types.ts README.md
git commit -m "feat: pick a house track from a room's own played history"
```

---

### Task 7: Play the house when the booth would go silent

**Files:**
- Modify: `src/lib/playback.ts`
- Modify: `src/components/venue/NowPlayingPanel.tsx`
- Modify: `src/components/venue/VenueCanvas.tsx`
- Modify: `src/components/room/RoomClient.tsx` (the `<VenueCanvas` call near line 517)

**Interfaces:**
- Consumes: `pickHouseTrack` from Task 6. Existing `advancePlayback` in `src/lib/playback.ts`. `postSystemMessage`.
- Produces: when the human loop is about to clear playback, a house spin if history exists.

House start procedure, used in both the `djSlots.length === 0` branch and the `if (!played)` branch, before either one clears `room_playback`:

1. Read `queue_items` for this `roomId` where `status = 'played'` and `played_at` is not null. Select `track_id, played_at`. Map to `{ trackId, playedAt }`. Ignore rows with a null `played_at`.
2. `const trackId = pickHouseTrack(history, playback?.current_track_id ?? null)`.
3. If `trackId` is null: keep today's clear-playback behavior. If `playback?.current_track_id` was non-null, also `postSystemMessage(supabase, roomId, "The booth is open.")`. If it was already null, do not post again.
4. If `trackId` is set:
   - Insert `queue_items` `{ room_id, dj_user_id: null, track_id: trackId, position: 0, status: "playing", is_house: true }`. Select the inserted id.
   - Upsert `room_playback` with `current_track_id: trackId`, `current_queue_item_id: inserted id`, `current_dj_user_id: null`, `started_at: now`, `is_paused: false`, `updated_at: now`.
   - Load the track title. `postSystemMessage` `The house is spinning: {title}`.
   - Do not call `incrementUserStat`. Do not call `checkTrackPlayBadges`.
   - Return `{ advanced: true, reason }` from `advancePlayback` (same `reason` argument the caller passed).

Do not run the house procedure when a human queue item was claimed (`played === true`). That path stays as it is.

The early `no_djs` return currently clears playback and returns `{ advanced: false, reason: "no_djs" }`. Replace that clear with the house procedure. If the house plays something, return `{ advanced: true, reason }`. If it does not, return `{ advanced: false, reason: "no_djs" }`.

UI:

- `NowPlayingPanel`: when `track` is set and `dj` is null, render the same "played by" row with the name `House` instead of hiding it.
- `VenueCanvas`: the center-deck `else` that says `Booth open` must say `House` with a second line `SPINNING` when a new prop `houseSpinning` is true. When `houseSpinning` is false, keep `Booth open`.
- In `RoomClient.tsx`, `track` and `dj` are already in scope above the `<VenueCanvas` element (around line 517). Add `houseSpinning={Boolean(track && !dj)}`.
- The `marquee` string just above that (around line 473) uses `played by ${dj?.display_name || "DJ"}`. When `track` is set and `dj` is null, use `played by House` instead of `played by DJ`.

Skip route stays unchanged: only `current_dj_user_id === user.id` can hit skip, so a house track is not skipped from the DJ button. Lame-skip still calls `advancePlayback`, which may start the next house or human track.

- [ ] **Step 1: Implement the two call sites in `advancePlayback`**

Add a local async function `startHouseOrSilence` inside `advancePlayback` (not exported) so both branches share it. Use the procedure above. Replace the `no_djs` clear and the `if (!played)` clear.

- [ ] **Step 2: House labels**

Apply the `NowPlayingPanel`, `VenueCanvas`, and `RoomClient` changes from the UI list above. `RoomClient.tsx` is the only `<VenueCanvas` call site.

- [ ] **Step 3: Existing playback tests still pass**

Run: `npx vitest run src/lib/playback.test.ts src/lib/house-crate.test.ts`

Expected: PASS. `shouldRotateToNextDj` tests must stay green. Do not change that function.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/playback.ts src/components/venue/NowPlayingPanel.tsx src/components/venue/VenueCanvas.tsx src/components/room/RoomClient.tsx
git commit -m "feat: keep a room spinning from its own played history"
```

`RoomClient.tsx` is the only `<VenueCanvas` call site. Include it in the commit.

---

## Self-review

- Dead rooms look live: Tasks 1–2. `LIVE` only when spinning. Quiet rooms remain listed, unlabeled as live.
- Landing invents a crowd: Task 3. Zero stays `0`. Fake stats, quotes, marquee song, and `vinyl_vera` are removed. Cards render API rooms only.
- No reason to come back: Tasks 4–5. Friends you can join, rooms you have a membership for, in-app ping after the first poll. No email, no push, no favorites table.
- Silence when the decks empty: Tasks 6–7. House uses played history only. Empty history stays silent and says the booth is open once. Humans still go first. House does not earn play stats.

## Execution note

Apply migration `008_house_queue.sql` in the Supabase SQL editor before expecting house spins to insert. The picker tests do not need a database. The app insert will fail the `dj_user_id` NOT NULL constraint until that migration is applied.
