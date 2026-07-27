# Local self crowd position + top z-index

**Date:** 2026-07-26  
**Status:** Approved for implementation (pending spec file review)

## Problem

In crowded rooms, other listeners can paint over the logged-in user’s floor avatar. Users also cannot reposition themselves on the dance floor. Any server-synced position would let others track and “stalk” moves.

## Goals

1. The logged-in user’s floor avatar is always the highest z-index **on the crowd floor** (never covered by another listener).
2. The logged-in user can **drag** their avatar anywhere on the allowed floor.
3. The overridden position is **local only** (this browser); other clients keep seeing the assigned layout slot.
4. Remember the local position **per room** in `localStorage`.

## Non-goals

- Broadcasting or persisting position to the server / other users.
- Click-to-move (drag only for v1).
- Moving while on the DJ deck (deck avatars stay as today; floor override applies only when the user is a floor listener).
- Reset-position UI chrome (can clear via storage or by not saving invalid spots).

## Approach

Client overlay on the existing crowd layout:

- Shared `assignCrowdLayout` still assigns every listener a slot (including self) for other viewers.
- On the current user’s client only, override that member’s `leftPct` / `topPct` from local state.
- Force self `zIndex = CROWD_UI_MAX_Z` (25), still below now-playing / quick-reacts (`z-30`).

## Interaction

- Pointer and touch drag on the “you” blob.
- Cursor: `grab` / `grabbing`.
- While dragging, clamp continuously to the allowed floor region.
- On pointer up, persist the clamped position.

## Placement constraints

Reuse the same rules as crowd layout chrome clearance:

- Floor envelope (percent of venue): roughly `leftPct` 11–86, `topPct` 48–84; when `topPct >= 66`, keep `leftPct >= 46` so the blob clears the now-playing panel.
- Must not overlap UI exclusions (now-playing panel, reaction rail) — use `crowdOverlapsUiChrome` (or a shared clamp helper built on it).
- If a saved position fails validation on load (zones tightened, etc.), discard it and use the assigned layout slot.

## Persistence

- Key: `needle:crowd-pos:{roomSlug}`
- Value: JSON `{ leftPct: number, topPct: number }`
- Scope: this browser only; per room slug
- No sync across devices or users

## Data flow

```
assignCrowdLayout(listenerIds)
  → crowd items for VenueCanvas
  → for currentUserId: apply local override (state ← localStorage on mount)
  → self zIndex = CROWD_UI_MAX_Z
  → drag updates state → clamp → write localStorage on release
```

Others’ clients never receive the override; they render self at the assigned slot.

## Components / files (expected)

- `src/lib/design-tokens.ts` — optional clamp helper exporting floor bounds + chrome check for drag
- `src/components/venue/VenueCanvas.tsx` (or small hook/helper next to it) — local position state, drag handlers, z-index override
- `src/lib/design-tokens.test.ts` (and/or a small clamp/drag pure-fn test) — clamp + self z-index rules

Room slug must be available where the override is stored (pass into `VenueCanvas` if not already).

## Testing

- Self z-index is always `CROWD_UI_MAX_Z` when current user is in the crowd layout.
- Clamp rejects positions inside UI exclusion rects.
- Clamp keeps positions within the floor envelope.
- Invalid stored JSON / out-of-bounds saved coords fall back to assigned slot (no crash).

## Privacy note

Because position is never sent to the server, other users cannot follow your local moves. They only see the deterministic layout slot for your user id.
