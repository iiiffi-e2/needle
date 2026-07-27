# Local Self Crowd Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the logged-in floor listener drag their avatar locally (per-room `localStorage`), always paint above other crowd members, and never sync the override to other clients.

**Architecture:** Pure clamp/validate + storage helpers in `design-tokens.ts`; a small `useLocalCrowdPosition` hook owns React state, persistence, and pointer drag; `VenueCanvas` applies the override and `CROWD_UI_MAX_Z` for self only. Shared `assignCrowdLayout` is unchanged for other viewers.

**Tech Stack:** Next.js / React client components, TypeScript, Vitest, `localStorage`, pointer events (mouse + touch via Pointer Events API).

## Global Constraints

- Local only — never POST/broadcast position.
- Drag only (no click-to-move).
- Persist key: `needle:crowd-pos:{roomSlug}`.
- Self floor z-index: exactly `CROWD_UI_MAX_Z` (25); still below player/reacts (`z-30`).
- Clamp to floor envelope + `crowdOverlapsUiChrome`.
- Floor listeners only (DJ deck unchanged).
- TDD: failing test before production code for each pure helper / behavior.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/design-tokens.ts` | Floor envelope constants, `isValidCrowdFloorPosition`, `clampCrowdFloorPosition`, `parseCrowdPos`, `crowdPosStorageKey`, `loadCrowdPos`, `saveCrowdPos` |
| `src/lib/design-tokens.test.ts` | Tests for validate/clamp/parse/self-z helper |
| `src/hooks/useLocalCrowdPosition.ts` | State, load on mount, drag handlers, save on release |
| `src/components/venue/VenueCanvas.tsx` | Accept `roomSlug`; wire hook; override self left/top/z; drag affordance |
| `src/components/room/RoomClient.tsx` | Pass `room.slug` into `VenueCanvas` |

---

### Task 1: Floor validate + clamp helpers

**Files:**
- Modify: `src/lib/design-tokens.ts`
- Test: `src/lib/design-tokens.test.ts`

**Interfaces:**
- Produces:
  - `CROWD_FLOOR` — `{ leftMin: 11, leftMax: 86, topMin: 48, topMax: 84, frontTopGate: 66, frontLeftMin: 46 }`
  - `isValidCrowdFloorPosition(leftPct: number, topPct: number, size?: number): boolean`
  - `clampCrowdFloorPosition(leftPct: number, topPct: number, size?: number): { leftPct: number; topPct: number }`
  - Default `size` = 64 (`CROWD_PLACE_SIZE` — export it as `CROWD_PLACE_SIZE` if not already exported)

- [ ] **Step 1: Write failing tests**

Add to `src/lib/design-tokens.test.ts`:

```ts
import {
  // ...existing
  CROWD_FLOOR,
  clampCrowdFloorPosition,
  isValidCrowdFloorPosition,
} from "./design-tokens";

describe("crowd floor position", () => {
  it("rejects positions over the now-playing panel", () => {
    expect(isValidCrowdFloorPosition(20, 80)).toBe(false);
  });

  it("rejects positions over the reaction rail", () => {
    expect(isValidCrowdFloorPosition(95, 60)).toBe(false);
  });

  it("accepts a mid-floor seat", () => {
    expect(isValidCrowdFloorPosition(55, 58)).toBe(true);
  });

  it("clamps into the floor envelope and out of chrome", () => {
    const pos = clampCrowdFloorPosition(5, 90);
    expect(pos.leftPct).toBeGreaterThanOrEqual(CROWD_FLOOR.leftMin);
    expect(pos.leftPct).toBeLessThanOrEqual(CROWD_FLOOR.leftMax);
    expect(pos.topPct).toBeGreaterThanOrEqual(CROWD_FLOOR.topMin);
    expect(pos.topPct).toBeLessThanOrEqual(CROWD_FLOOR.topMax);
    expect(isValidCrowdFloorPosition(pos.leftPct, pos.topPct)).toBe(true);
  });

  it("forces front-row seats right of the player zone", () => {
    const pos = clampCrowdFloorPosition(20, 72);
    expect(pos.leftPct).toBeGreaterThanOrEqual(CROWD_FLOOR.frontLeftMin);
    expect(isValidCrowdFloorPosition(pos.leftPct, pos.topPct)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/design-tokens.test.ts`

Expected: FAIL (exports missing / not a function)

- [ ] **Step 3: Implement helpers**

In `src/lib/design-tokens.ts`, export `CROWD_PLACE_SIZE` (currently private) and add:

```ts
export const CROWD_FLOOR = {
  leftMin: 11,
  leftMax: 86,
  topMin: 48,
  topMax: 84,
  frontTopGate: 66,
  frontLeftMin: 46,
} as const;

export function isValidCrowdFloorPosition(
  leftPct: number,
  topPct: number,
  size: number = CROWD_PLACE_SIZE
): boolean {
  if (
    leftPct < CROWD_FLOOR.leftMin ||
    leftPct > CROWD_FLOOR.leftMax ||
    topPct < CROWD_FLOOR.topMin ||
    topPct > CROWD_FLOOR.topMax
  ) {
    return false;
  }
  if (topPct >= CROWD_FLOOR.frontTopGate && leftPct < CROWD_FLOOR.frontLeftMin) {
    return false;
  }
  return !crowdOverlapsUiChrome(leftPct, topPct, size);
}

export function clampCrowdFloorPosition(
  leftPct: number,
  topPct: number,
  size: number = CROWD_PLACE_SIZE
): { leftPct: number; topPct: number } {
  let left = Math.min(CROWD_FLOOR.leftMax, Math.max(CROWD_FLOOR.leftMin, leftPct));
  let top = Math.min(CROWD_FLOOR.topMax, Math.max(CROWD_FLOOR.topMin, topPct));
  if (top >= CROWD_FLOOR.frontTopGate && left < CROWD_FLOOR.frontLeftMin) {
    left = CROWD_FLOOR.frontLeftMin;
  }
  if (isValidCrowdFloorPosition(left, top, size)) {
    return { leftPct: left, topPct: top };
  }
  // Spiral search for nearest valid seat (step 2%).
  for (let radius = 2; radius <= 40; radius += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      for (let dy = -radius; dy <= radius; dy += 2) {
        const cand = {
          leftPct: left + dx,
          topPct: top + dy,
        };
        let cl = Math.min(
          CROWD_FLOOR.leftMax,
          Math.max(CROWD_FLOOR.leftMin, cand.leftPct)
        );
        let ct = Math.min(
          CROWD_FLOOR.topMax,
          Math.max(CROWD_FLOOR.topMin, cand.topPct)
        );
        if (ct >= CROWD_FLOOR.frontTopGate && cl < CROWD_FLOOR.frontLeftMin) {
          cl = CROWD_FLOOR.frontLeftMin;
        }
        if (isValidCrowdFloorPosition(cl, ct, size)) {
          return { leftPct: cl, topPct: ct };
        }
      }
    }
  }
  return { leftPct: 55, topPct: 58 };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/design-tokens.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/design-tokens.ts src/lib/design-tokens.test.ts
git commit -m "feat(venue): add crowd floor position validate and clamp helpers"
```

---

### Task 2: localStorage parse / load / save

**Files:**
- Modify: `src/lib/design-tokens.ts`
- Test: `src/lib/design-tokens.test.ts`

**Interfaces:**
- Consumes: `isValidCrowdFloorPosition`, `clampCrowdFloorPosition`
- Produces:
  - `crowdPosStorageKey(roomSlug: string): string` → `needle:crowd-pos:${roomSlug}`
  - `parseCrowdPos(raw: string | null, size?: number): { leftPct: number; topPct: number } | null`
  - `loadCrowdPos(roomSlug: string, size?: number): { leftPct: number; topPct: number } | null`
  - `saveCrowdPos(roomSlug: string, pos: { leftPct: number; topPct: number }): void`

- [ ] **Step 1: Write failing tests**

```ts
import {
  crowdPosStorageKey,
  parseCrowdPos,
  saveCrowdPos,
  loadCrowdPos,
} from "./design-tokens";

describe("crowd pos storage", () => {
  it("builds the per-room storage key", () => {
    expect(crowdPosStorageKey("first-room")).toBe("needle:crowd-pos:first-room");
  });

  it("parseCrowdPos returns null for invalid JSON", () => {
    expect(parseCrowdPos("nope")).toBeNull();
    expect(parseCrowdPos(null)).toBeNull();
    expect(parseCrowdPos("{}")).toBeNull();
  });

  it("parseCrowdPos accepts valid coords and rejects chrome hits", () => {
    expect(parseCrowdPos(JSON.stringify({ leftPct: 55, topPct: 58 }))).toEqual({
      leftPct: 55,
      topPct: 58,
    });
    expect(parseCrowdPos(JSON.stringify({ leftPct: 20, topPct: 80 }))).toBeNull();
  });

  it("saveCrowdPos + loadCrowdPos round-trip in localStorage", () => {
    const slug = "test-room-pos";
    localStorage.removeItem(crowdPosStorageKey(slug));
    saveCrowdPos(slug, { leftPct: 60, topPct: 62 });
    expect(loadCrowdPos(slug)).toEqual({ leftPct: 60, topPct: 62 });
    localStorage.removeItem(crowdPosStorageKey(slug));
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/design-tokens.test.ts -t "crowd pos storage"`

Expected: FAIL (missing exports)

- [ ] **Step 3: Implement storage helpers**

```ts
export type CrowdPos = { leftPct: number; topPct: number };

export function crowdPosStorageKey(roomSlug: string): string {
  return `needle:crowd-pos:${roomSlug}`;
}

export function parseCrowdPos(
  raw: string | null,
  size: number = CROWD_PLACE_SIZE
): CrowdPos | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<CrowdPos>;
    if (
      typeof data.leftPct !== "number" ||
      typeof data.topPct !== "number" ||
      !Number.isFinite(data.leftPct) ||
      !Number.isFinite(data.topPct)
    ) {
      return null;
    }
    if (!isValidCrowdFloorPosition(data.leftPct, data.topPct, size)) {
      return null;
    }
    return { leftPct: data.leftPct, topPct: data.topPct };
  } catch {
    return null;
  }
}

export function loadCrowdPos(
  roomSlug: string,
  size: number = CROWD_PLACE_SIZE
): CrowdPos | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCrowdPos(localStorage.getItem(crowdPosStorageKey(roomSlug)), size);
  } catch {
    return null;
  }
}

export function saveCrowdPos(roomSlug: string, pos: CrowdPos): void {
  if (typeof window === "undefined") return;
  const clamped = clampCrowdFloorPosition(pos.leftPct, pos.topPct);
  try {
    localStorage.setItem(
      crowdPosStorageKey(roomSlug),
      JSON.stringify(clamped)
    );
  } catch {
    // ignore quota / private mode
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/design-tokens.test.ts`

Expected: PASS (Vitest uses happy-dom or node — if `localStorage` is missing, use Vitest `// @vitest-environment happy-dom` at top of test file OR stub:

```ts
// only if node env lacks localStorage
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});
```

Prefer stubbing only inside the round-trip test if needed.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/design-tokens.ts src/lib/design-tokens.test.ts
git commit -m "feat(venue): persist local crowd position per room in localStorage"
```

---

### Task 3: `useLocalCrowdPosition` hook

**Files:**
- Create: `src/hooks/useLocalCrowdPosition.ts`
- Test: optional thin unit coverage via pure helpers already done; manual drag verified in Task 4. No React Testing Library in repo — skip component RTL unless already present.

**Interfaces:**
- Consumes: `loadCrowdPos`, `saveCrowdPos`, `clampCrowdFloorPosition`, `CrowdPos`
- Produces:

```ts
export function useLocalCrowdPosition(
  roomSlug: string,
  enabled: boolean
): {
  override: CrowdPos | null;
  isDragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}
```

- [ ] **Step 1: Implement hook**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampCrowdFloorPosition,
  loadCrowdPos,
  saveCrowdPos,
  type CrowdPos,
} from "@/lib/design-tokens";

export function useLocalCrowdPosition(roomSlug: string, enabled: boolean) {
  const [override, setOverride] = useState<CrowdPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startLeft: number;
    startTop: number;
    venue: DOMRect;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !roomSlug) {
      setOverride(null);
      return;
    }
    setOverride(loadCrowdPos(roomSlug));
  }, [roomSlug, enabled]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      const venue = event.currentTarget
        .closest(".needle-venue-inner")
        ?.getBoundingClientRect();
      if (!venue || venue.width <= 0 || venue.height <= 0) return;

      const current =
        override ??
        // fallback read from element's % will be supplied by caller via data attrs
        null;

      // Caller must set data-left-pct / data-top-pct on the draggable node
      // for the initial assigned slot when override is null.
      const el = event.currentTarget;
      const startLeft = override?.leftPct ?? Number(el.dataset.leftPct);
      const startTop = override?.topPct ?? Number(el.dataset.topPct);
      if (!Number.isFinite(startLeft) || !Number.isFinite(startTop)) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startLeft,
        startTop,
        venue,
      };
      setIsDragging(true);

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        const dxPct = ((ev.clientX - drag.originX) / drag.venue.width) * 100;
        const dyPct = ((ev.clientY - drag.originY) / drag.venue.height) * 100;
        const next = clampCrowdFloorPosition(
          drag.startLeft + dxPct,
          drag.startTop + dyPct
        );
        setOverride(next);
      };

      const onUp = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setOverride((pos) => {
          if (pos) saveCrowdPos(roomSlug, pos);
          return pos;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [enabled, override, roomSlug]
  );

  // silence unused if current unused — remove `current` variable in real impl
  void 0;

  return { override, isDragging, onPointerDown };
}
```

Clean up the draft above when implementing: remove the unused `current` / `void 0` dead code; keep the `data-left-pct` / `data-top-pct` contract.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLocalCrowdPosition.ts
git commit -m "feat(venue): add local crowd position drag hook"
```

---

### Task 4: Wire VenueCanvas + RoomClient (self z-index + drag)

**Files:**
- Modify: `src/components/venue/VenueCanvas.tsx`
- Modify: `src/components/room/RoomClient.tsx`
- Test: extend `src/lib/design-tokens.test.ts` with a pure “self wins z-index” helper if extracted; otherwise verify manually

**Interfaces:**
- Consumes: `useLocalCrowdPosition`, `CROWD_UI_MAX_Z`
- `VenueCanvasProps` gains `roomSlug: string`

- [ ] **Step 1: Pass `roomSlug` from RoomClient**

In `RoomClient.tsx` where `<VenueCanvas` is rendered, add:

```tsx
roomSlug={room.slug}
```

- [ ] **Step 2: Apply override + z-index + drag on self crowd member**

In `VenueCanvas.tsx`:

1. Add `roomSlug: string` to props.
2. Detect whether current user is in `crowd`:

```ts
const selfOnFloor =
  !!currentUserId && crowd.some((c) => c.userId === currentUserId);

const { override, isDragging, onPointerDown } = useLocalCrowdPosition(
  roomSlug,
  selfOnFloor
);
```

3. When mapping crowd members, for self:

```tsx
const isSelf = member.user_id === currentUserId;
const leftPct = isSelf && override ? override.leftPct : c.leftPct;
const topPct = isSelf && override ? override.topPct : c.topPct;
const zIndex = isSelf ? CROWD_UI_MAX_Z : c.zIndex;

<div
  ...
  data-left-pct={c.leftPct}
  data-top-pct={c.topPct}
  onPointerDown={isSelf ? onPointerDown : undefined}
  style={{
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: "translateX(-50%)",
    zIndex,
    cursor: isSelf ? (isDragging ? "grabbing" : "grab") : undefined,
    touchAction: isSelf ? "none" : undefined,
  }}
>
```

Keep `data-left-pct` / `data-top-pct` as the **assigned** slot (`c.leftPct` / `c.topPct`) so the first drag starts from the visible position when override is null — if override is set, hook uses override; if somehow both missing, no-op.

When override is active, also set:

```tsx
data-left-pct={leftPct}
data-top-pct={topPct}
```

so continued drags start from the on-screen position.

4. Import `CROWD_UI_MAX_Z` and `useLocalCrowdPosition`.

- [ ] **Step 3: Add pure test for self z policy (optional helper)**

If useful, add:

```ts
export function crowdZIndexForMember(baseZ: number, isSelf: boolean): number {
  return isSelf ? CROWD_UI_MAX_Z : baseZ;
}
```

Test:

```ts
expect(crowdZIndexForMember(3, true)).toBe(CROWD_UI_MAX_Z);
expect(crowdZIndexForMember(3, false)).toBe(3);
```

Use it in VenueCanvas for clarity.

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: all PASS

- [ ] **Step 5: Manual smoke (dev)**

1. Open a room as a floor listener (not on deck).
2. Confirm “you” paints above overlapping neighbors.
3. Drag “you” around — stays off player/reacts; reload — position restored for that room only.
4. Second browser/incognito as another account still sees you on the assigned slot.

- [ ] **Step 6: Commit**

```bash
git add src/components/venue/VenueCanvas.tsx src/components/room/RoomClient.tsx src/lib/design-tokens.ts src/lib/design-tokens.test.ts
git commit -m "feat(venue): drag local self avatar and keep it on top of the crowd"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Self highest floor z-index | Task 4 (`CROWD_UI_MAX_Z`) |
| Drag move | Tasks 3–4 |
| Local only / no sync | Tasks 2–4 (localStorage only) |
| Per-room localStorage | Task 2 |
| Clamp to floor + chrome | Task 1 |
| Invalid saved → assigned slot | Task 2 `parseCrowdPos` null + Task 4 uses assigned when `override` null |
| DJ deck unchanged | Task 4 `enabled: selfOnFloor` |
| Pointer + touch | Task 3 Pointer Events |

## Self-review notes

- No placeholders left in steps.
- Storage key matches spec exactly: `needle:crowd-pos:{roomSlug}`.
- `CROWD_PLACE_SIZE` must be exported in Task 1 (was private).
