# In-room Person Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a short person card over the room for every in-room profile control, with the same friend actions as the profile page, without unmounting the room or stepping a DJ off the booth.

**Architecture:** Pure decisions live in `src/lib/room-person.ts`. `RoomClient` holds the open `RoomPerson`. In-room controls call `onPickPerson` and never navigate. `RoomPersonCard` paints the snapshot immediately, loads `GET /api/friends/[userId]` for someone else, and reuses `FriendActions` in a plain layout. "View full profile" is a new-tab anchor.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, existing Supabase friend helpers.

## Global Constraints

- In-room picks must not use `router.push` or a `Link` to `/profile/[id]`. Either unmounts the room and sends `DELETE /api/rooms/[slug]/presence`.
- Floor single-click still only brings that person forward. Floor double-click opens the card. Your own floor avatar does not open the card.
- Chat names, chat avatars, the current DJ, side-deck DJs, the floor list, and the waitlist open the card on click, including your own name.
- Profile links outside the room stay links to `/profile/[id]` in this tab.
- "View full profile" is an anchor with `target="_blank"` and `rel="noopener noreferrer"`. Opening it leaves the card and this tab alone.
- Friend actions render only when the open person is not the current user. Your own card skips the relationship lookup.
- `GET /api/friends/[userId]` returns `{ relationship: Relationship | null }`. Missing id or self is 400. No session is 401. Existing `DELETE` on that path stays unfriend.
- A relationship result applies only while that user id is still open. A failed lookup shows the error and a Retry button. The card stays open.
- A missing, blank, or whitespace-only display name shows as `Anonymous`.
- `FriendActions` `layout` defaults to `"card"`. The profile page keeps that default.
- The dialog is fixed, centered, `role="dialog"`, `aria-modal="true"`, labelled by the person's name, above the mobile drawer (`z-index: 100`).
- Close by the close button, the backdrop, or Escape. Do not navigate on an unauthorized response.
- Tests are Vitest unit tests on pure functions. Do not add a browser or component harness.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/room-person.ts` | `RoomPerson`, display name, friend-action gate, stale-result gate, profile link, profile control, lookup guard, snapshot helper |
| `src/lib/room-person.test.ts` | Vitest coverage for those functions |
| `src/app/api/friends/[userId]/route.ts` | Add `GET` beside the existing `DELETE` |
| `src/components/profile/FriendActions.tsx` | `layout?: "card" \| "plain"` |
| `src/components/shared/ProfileLink.tsx` | Optional `onPick`; button vs link vs static via `profileControl` |
| `src/components/room/RoomPersonCard.tsx` | The dialog, lookup, retry, full-profile link |
| `src/components/venue/VenueCanvas.tsx` | Floor double-click and DJ blobs call `onPickPerson`; remove `router.push` |
| `src/components/venue/RoomSidePanel.tsx` | Chat, floor list, and waitlist pass `onPickPerson` |
| `src/components/room/RoomClient.tsx` | Holds the open person and renders the card |

---

### Task 1: Room-person decisions

**Files:**
- Create: `src/lib/room-person.ts`
- Test: `src/lib/room-person.test.ts`

**Interfaces:**
- Produces:
  - `export interface RoomPerson { userId: string; displayName: string | null; avatarUrl: string | null; avatarColor: string | null }`
  - `showsFriendActions(currentUserId: string, personUserId: string): boolean`
  - `relationshipApplies(resultUserId: string, openUserId: string | null): boolean`
  - `personDisplayName(displayName: string | null | undefined): string`
  - `profileLink(userId: string): { href: string; target: "_blank"; rel: "noopener noreferrer" }`
  - `profileControl(userId: string | null | undefined, hasOnPick: boolean): "button" | "link" | "static"`
  - `relationshipLookupGuard(sessionUserId: string | null, otherUserId: string | null | undefined): { status: 401 | 400; error: string } | null`
  - `toRoomPerson(userId: string, user?: { display_name?: string | null; avatar_url?: string | null; avatar_color?: string | null } | null): RoomPerson`

- [ ] **Step 1: Write the failing test**

Create `src/lib/room-person.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  personDisplayName,
  profileControl,
  profileLink,
  relationshipApplies,
  relationshipLookupGuard,
  showsFriendActions,
  toRoomPerson,
} from "./room-person";

const me = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const them = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("showsFriendActions", () => {
  it("is true for someone else", () => {
    expect(showsFriendActions(me, them)).toBe(true);
  });

  it("is false for yourself", () => {
    expect(showsFriendActions(me, me)).toBe(false);
  });
});

describe("relationshipApplies", () => {
  it("applies only while that person is still open", () => {
    expect(relationshipApplies(them, them)).toBe(true);
    expect(relationshipApplies(them, me)).toBe(false);
  });

  it("does not apply when nobody is open", () => {
    expect(relationshipApplies(them, null)).toBe(false);
  });
});

describe("personDisplayName", () => {
  it("returns a trimmed name", () => {
    expect(personDisplayName("  Ada  ")).toBe("Ada");
  });

  it("uses Anonymous for null, missing, and blank names", () => {
    expect(personDisplayName(null)).toBe("Anonymous");
    expect(personDisplayName(undefined)).toBe("Anonymous");
    expect(personDisplayName("   ")).toBe("Anonymous");
  });
});

describe("profileLink", () => {
  it("opens the profile in a new tab", () => {
    expect(profileLink(them)).toEqual({
      href: `/profile/${them}`,
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});

describe("profileControl", () => {
  it("is a button when a room pick handler is set", () => {
    expect(profileControl(them, true)).toBe("button");
  });

  it("is a link when there is a user and no pick handler", () => {
    expect(profileControl(them, false)).toBe("link");
  });

  it("is static when there is no user id", () => {
    expect(profileControl(null, true)).toBe("static");
    expect(profileControl(undefined, false)).toBe("static");
    expect(profileControl("", true)).toBe("static");
  });
});

describe("relationshipLookupGuard", () => {
  it("requires a session", () => {
    expect(relationshipLookupGuard(null, them)).toEqual({
      status: 401,
      error: "Unauthorized",
    });
  });

  it("rejects a missing id and a self lookup", () => {
    expect(relationshipLookupGuard(me, "")).toEqual({
      status: 400,
      error: "userId is required",
    });
    expect(relationshipLookupGuard(me, me)).toEqual({
      status: 400,
      error: "Cannot load your own relationship",
    });
  });

  it("allows a lookup of someone else", () => {
    expect(relationshipLookupGuard(me, them)).toBeNull();
  });
});

describe("toRoomPerson", () => {
  it("copies the snapshot fields", () => {
    expect(
      toRoomPerson(them, {
        display_name: "Ada",
        avatar_url: "https://example.com/a.png",
        avatar_color: "#ff9d3c",
      })
    ).toEqual({
      userId: them,
      displayName: "Ada",
      avatarUrl: "https://example.com/a.png",
      avatarColor: "#ff9d3c",
    });
  });

  it("uses nulls when the user payload is missing", () => {
    expect(toRoomPerson(them, null)).toEqual({
      userId: them,
      displayName: null,
      avatarUrl: null,
      avatarColor: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/room-person.test.ts`

Expected: FAIL with "Failed to resolve import" or "Cannot find module './room-person'".

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/room-person.ts`:

```ts
export interface RoomPerson {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
}

export function showsFriendActions(
  currentUserId: string,
  personUserId: string
): boolean {
  return currentUserId !== personUserId;
}

export function relationshipApplies(
  resultUserId: string,
  openUserId: string | null
): boolean {
  return openUserId !== null && openUserId === resultUserId;
}

export function personDisplayName(
  displayName: string | null | undefined
): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : "Anonymous";
}

export function profileLink(userId: string): {
  href: string;
  target: "_blank";
  rel: "noopener noreferrer";
} {
  return {
    href: `/profile/${userId}`,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function profileControl(
  userId: string | null | undefined,
  hasOnPick: boolean
): "button" | "link" | "static" {
  if (!userId) return "static";
  return hasOnPick ? "button" : "link";
}

export function relationshipLookupGuard(
  sessionUserId: string | null,
  otherUserId: string | null | undefined
): { status: 401 | 400; error: string } | null {
  if (!sessionUserId) {
    return { status: 401, error: "Unauthorized" };
  }
  if (!otherUserId) {
    return { status: 400, error: "userId is required" };
  }
  if (otherUserId === sessionUserId) {
    return { status: 400, error: "Cannot load your own relationship" };
  }
  return null;
}

export function toRoomPerson(
  userId: string,
  user?: {
    display_name?: string | null;
    avatar_url?: string | null;
    avatar_color?: string | null;
  } | null
): RoomPerson {
  return {
    userId,
    displayName: user?.display_name ?? null,
    avatarUrl: user?.avatar_url ?? null,
    avatarColor: user?.avatar_color ?? null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/room-person.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/room-person.ts src/lib/room-person.test.ts
git commit -m "Add room person card decisions."
```

---

### Task 2: Relationship lookup endpoint

**Files:**
- Modify: `src/app/api/friends/[userId]/route.ts`
- Test: `src/lib/room-person.test.ts` (guard already covered; do not add a route harness)

**Interfaces:**
- Consumes: `relationshipLookupGuard(sessionUserId, otherUserId)` and `getRelationship(admin, userId, otherUserId)` from `src/lib/friends.ts`
- Produces: `GET /api/friends/[userId]` → `200 { relationship: Relationship | null }`, or `{ error: string }` with status `401` or `400`

- [ ] **Step 1: Add GET beside the existing DELETE**

In `src/app/api/friends/[userId]/route.ts`, add `getRelationship` to the friends import and add this handler. Leave `DELETE` unchanged.

```ts
import { FriendRequestError, getRelationship, unfriend } from "@/lib/friends";
import { relationshipLookupGuard } from "@/lib/room-person";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const guard = relationshipLookupGuard(user?.id ?? null, userId);
  if (guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const admin = createServiceClient();
  try {
    const relationship = await getRelationship(admin, user!.id, userId);
    return NextResponse.json({ relationship });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

`user!` is safe because `relationshipLookupGuard` already rejected a missing session.

- [ ] **Step 2: Run the guard tests**

Run: `npx vitest run src/lib/room-person.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/friends/[userId]/route.ts
git commit -m "Add a relationship lookup for the room person card."
```

---

### Task 3: Plain friend-actions layout

**Files:**
- Modify: `src/components/profile/FriendActions.tsx`

**Interfaces:**
- Consumes: existing `FriendActions` props
- Produces: `layout?: "card" | "plain"` on `FriendActions`. Default `"card"` keeps the glass card and the "Friend Actions" heading. `"plain"` renders only the action row and the error paragraph.

- [ ] **Step 1: Add the layout prop**

Change the props and the returned tree. Do not change action handlers, labels, or endpoints.

```tsx
interface FriendActionsProps {
  profileUserId: string;
  currentUserId: string;
  initialRelationship: Relationship | null;
  layout?: "card" | "plain";
}

export function FriendActions({
  profileUserId,
  currentUserId,
  initialRelationship,
  layout = "card",
}: FriendActionsProps) {
```

Replace the `return (` block with:

```tsx
  const actions = (
    <>
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

        {relationshipHint !== "blocked" &&
          relationshipHint !== "blocked_by_them" && (
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
    </>
  );

  if (layout === "plain") {
    return actions;
  }

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        Friend Actions
      </h2>
      {actions}
    </div>
  );
```

The profile page does not pass `layout`, so it keeps the card.

- [ ] **Step 2: Run the friend unit tests**

Run: `npx vitest run src/lib/friends.test.ts src/lib/room-person.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/FriendActions.tsx
git commit -m "Let friend actions render without a nested card."
```

---

### Task 4: ProfileLink pick callback

**Files:**
- Modify: `src/components/shared/ProfileLink.tsx`

**Interfaces:**
- Consumes: `profileControl`, `RoomPerson` from `src/lib/room-person.ts`
- Produces: `onPick?: (person: RoomPerson) => void` plus optional `displayName`, `avatarUrl`, and `avatarColor` props. `"button"` calls `onPick` and has no `href`. `"link"` stays `<Link href={/profile/${userId}}>`. `"static"` renders children only.

- [ ] **Step 1: Replace ProfileLink**

Replace the whole file:

```tsx
"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { profileControl, type RoomPerson } from "@/lib/room-person";

interface ProfileLinkProps {
  userId: string | null | undefined;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  onPick?: (person: RoomPerson) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function ProfileLink({
  userId,
  displayName = null,
  avatarUrl = null,
  avatarColor = null,
  onPick,
  children,
  className,
  style,
  title = "View profile",
}: ProfileLinkProps) {
  const control = profileControl(userId, onPick !== undefined);

  if (control === "static" || !userId) {
    return <>{children}</>;
  }

  if (control === "button") {
    return (
      <button
        type="button"
        className={className}
        style={style}
        title={title}
        onClick={() =>
          onPick?.({
            userId,
            displayName,
            avatarUrl,
            avatarColor,
          })
        }
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={`/profile/${userId}`}
      className={className}
      style={style}
      title={title}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Run the control tests**

Run: `npx vitest run src/lib/room-person.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/ProfileLink.tsx
git commit -m "Let profile controls open a room card instead of navigating."
```

---

### Task 5: Room person card

**Files:**
- Create: `src/components/room/RoomPersonCard.tsx`

**Interfaces:**
- Consumes: `RoomPerson`, `showsFriendActions`, `relationshipApplies`, `personDisplayName`, `profileLink` from `src/lib/room-person.ts`; `FriendActions` with `layout="plain"`; `UserAvatar`; `Relationship` from `src/lib/types.ts`
- Produces:
  - `RoomPersonCard({ person, currentUserId, onClose }: { person: RoomPerson; currentUserId: string | null; onClose: () => void })`
  - Renders nothing navigational. Full profile uses `profileLink(person.userId)`.

- [ ] **Step 1: Create the dialog**

Create `src/components/room/RoomPersonCard.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { FriendActions } from "@/components/profile/FriendActions";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  personDisplayName,
  profileLink,
  relationshipApplies,
  showsFriendActions,
  type RoomPerson,
} from "@/lib/room-person";
import type { Relationship } from "@/lib/types";

interface RoomPersonCardProps {
  person: RoomPerson;
  currentUserId: string | null;
  onClose: () => void;
}

export function RoomPersonCard({
  person,
  currentUserId,
  onClose,
}: RoomPersonCardProps) {
  const canFriend =
    currentUserId !== null &&
    showsFriendActions(currentUserId, person.userId);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(
    canFriend ? "loading" : "ready"
  );
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [error, setError] = useState("");
  const openUserIdRef = useRef(person.userId);
  openUserIdRef.current = person.userId;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!canFriend || !currentUserId) return;
    const requestedId = person.userId;
    let cancelled = false;
    setPhase("loading");
    setError("");

    fetch(`/api/friends/${requestedId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Request failed");
        }
        return payload as { relationship: Relationship | null };
      })
      .then((payload) => {
        if (cancelled) return;
        if (!relationshipApplies(requestedId, openUserIdRef.current)) return;
        setRelationship(payload.relationship);
        setPhase("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        if (!relationshipApplies(requestedId, openUserIdRef.current)) return;
        const message =
          caught instanceof Error ? caught.message : "Something went wrong";
        setError(message);
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, canFriend, currentUserId, person.userId]);

  const name = personDisplayName(person.displayName);
  const link = profileLink(person.userId);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[120] border-none cursor-pointer"
        style={{ background: "rgba(0, 0, 0, 0.55)" }}
        aria-label="Close profile"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-person-name"
          className="glass-panel pointer-events-auto w-full max-w-[320px] rounded-2xl p-5 shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-bold cursor-pointer bg-transparent border-none"
              style={{ color: "var(--sub)" }}
            >
              Close
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <UserAvatar
              name={name}
              avatarUrl={person.avatarUrl}
              userId={person.userId}
              avatarColor={person.avatarColor}
              size="lg"
            />
            <h2
              id="room-person-name"
              className="font-display text-[17px] font-extrabold"
            >
              {name}
            </h2>
          </div>

          {canFriend && currentUserId && (
            <div className="mt-4">
              {phase === "loading" && (
                <p className="text-sm text-muted">Loading...</p>
              )}
              {phase === "error" && (
                <div>
                  <p className="text-sm text-danger">{error}</p>
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="btn-secondary mt-3 px-4 py-2 rounded-full text-sm font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}
              {phase === "ready" && (
                <FriendActions
                  layout="plain"
                  profileUserId={person.userId}
                  currentUserId={currentUserId}
                  initialRelationship={relationship}
                />
              )}
            </div>
          )}

          <a
            href={link.href}
            target={link.target}
            rel={link.rel}
            className="inline-block mt-4 text-sm font-semibold text-glow-soft hover:underline"
          >
            View full profile
          </a>
        </div>
      </div>
    </>
  );
}
```

Do not call `router.push` or render a Next.js `Link` in this file.

- [ ] **Step 2: Run the decision tests**

Run: `npx vitest run src/lib/room-person.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/room/RoomPersonCard.tsx
git commit -m "Add the in-room person card."
```

---

### Task 6: Wire the room

**Files:**
- Modify: `src/components/venue/VenueCanvas.tsx`
- Modify: `src/components/venue/RoomSidePanel.tsx`
- Modify: `src/components/room/RoomClient.tsx`

**Interfaces:**
- Consumes: `RoomPerson`, `toRoomPerson`, `RoomPersonCard`, `ProfileLink`'s `onPick`
- Produces: `onPickPerson: (person: RoomPerson) => void` on `VenueCanvas` and `RoomSidePanel`. `RoomClient` state `openPerson: RoomPerson | null`.

- [ ] **Step 1: Stop the floor from navigating**

In `src/components/venue/VenueCanvas.tsx`:

Remove this import:

```ts
import { useRouter } from "next/navigation";
```

Add this import:

```ts
import { toRoomPerson, type RoomPerson } from "@/lib/room-person";
```

Add this field to `VenueCanvasProps` and to the destructured `VenueCanvas` args, then delete `const router = useRouter();`:

```ts
onPickPerson: (person: RoomPerson) => void;
```

Add the same field to `DeckSlotProps`, destructure it in `DeckSlot`, and pass `onPickPerson={onPickPerson}` on both `<DeckSlot` calls (`sideDjs[0]` and `sideDjs[1]`).

Replace the other-user branch inside `DeckSlot` (the `ProfileLink` around the vinyl blob) with:

```tsx
<ProfileLink
  userId={occupant.user_id}
  displayName={occupant.user.display_name}
  avatarUrl={occupant.user.avatar_url}
  avatarColor={occupant.user.avatar_color}
  onPick={onPickPerson}
  title={`${occupant.user.display_name || "DJ"} — view profile`}
  className="block cursor-pointer hover:opacity-90 transition-opacity"
>
  {blob}
</ProfileLink>
```

Replace the current-DJ `ProfileLink` (the branch where `currentDj.id !== currentUserId`) with:

```tsx
<ProfileLink
  userId={currentDj.id}
  displayName={currentDj.display_name}
  avatarUrl={currentDj.avatar_url}
  avatarColor={currentDj.avatar_color}
  onPick={onPickPerson}
  title={`${currentDj.display_name || "DJ"} — view profile`}
  className="block cursor-pointer hover:opacity-90 transition-opacity"
>
  <VinylBlob
    variant="dj"
    color={resolveUserColor(currentDj.id, currentDj.avatar_color)}
    size={66}
    dance={!isDjSleeping}
    showRing
  />
</ProfileLink>
```

Replace the crowd member `onDoubleClick` and `title`. Leave `onClick` as `setFocusedCrowdUserId`. Leave the self branch `undefined`.

```tsx
onDoubleClick={
  isSelf
    ? undefined
    : () => onPickPerson(toRoomPerson(member.user_id, member.user))
}
title={
  isSelf
    ? undefined
    : `${displayName} — click to bring forward, double-click to view`
}
```

Confirm the file no longer contains `router.push` or `useRouter`.

- [ ] **Step 2: Stop the side panel from navigating**

In `src/components/venue/RoomSidePanel.tsx`:

- Add `import { type RoomPerson } from "@/lib/room-person";`
- Add `onPickPerson: (person: RoomPerson) => void` to `RoomSidePanelProps` and the destructured args.

Chat avatar:

```tsx
<ProfileLink
  userId={m.user_id}
  displayName={m.user?.display_name}
  avatarUrl={m.user?.avatar_url}
  avatarColor={m.user?.avatar_color}
  onPick={onPickPerson}
>
```

Chat name:

```tsx
<ProfileLink
  userId={m.user_id}
  displayName={m.user?.display_name}
  avatarUrl={m.user?.avatar_url}
  avatarColor={m.user?.avatar_color}
  onPick={onPickPerson}
  className="cursor-pointer hover:text-glow-soft transition-colors"
>
```

Waitlist name:

```tsx
<ProfileLink
  userId={entry.user_id}
  displayName={entry.user?.display_name}
  avatarUrl={entry.user?.avatar_url}
  avatarColor={entry.user?.avatar_color}
  onPick={onPickPerson}
  className="hover:text-glow-soft transition-colors"
>
  {entry.user?.display_name || "Anonymous"}
</ProfileLink>
```

Floor-list dot:

```tsx
<ProfileLink
  key={m.id}
  userId={m.user_id}
  displayName={m.user?.display_name}
  avatarUrl={m.user?.avatar_url}
  avatarColor={m.user?.avatar_color}
  onPick={onPickPerson}
  title={m.user?.display_name || "View profile"}
  className="w-[30px] h-[30px] rounded-full shadow-[0_0_0_2px_var(--ndl-bg1)] cursor-pointer hover:ring-2 hover:ring-glow/40 transition-shadow block"
  style={{
    background: resolveUserColor(m.user_id, m.user?.avatar_color),
  }}
/>
```

Every `ProfileLink` in this file must pass `onPick={onPickPerson}`.

- [ ] **Step 3: Hold the open person in the room**

In `src/components/room/RoomClient.tsx`:

- Import `useState` is already present. Add `import { RoomPersonCard } from "@/components/room/RoomPersonCard";` and `import type { RoomPerson } from "@/lib/room-person";`
- Add `const [openPerson, setOpenPerson] = useState<RoomPerson | null>(null);`
- Pass `onPickPerson={setOpenPerson}` to `<VenueCanvas` and `<RoomSidePanel`.
- Render the card after `<StepOffConfirmSheet`, still inside the room root:

```tsx
{openPerson && (
  <RoomPersonCard
    key={openPerson.userId}
    person={openPerson}
    currentUserId={currentUserId}
    onClose={() => setOpenPerson(null)}
  />
)}
```

`key={openPerson.userId}` resets the lookup when a different person replaces the card.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/lib/room-person.test.ts`

Expected: PASS

- [ ] **Step 5: Confirm the room no longer navigates to a profile**

Search `src/components/venue/VenueCanvas.tsx`, `src/components/venue/RoomSidePanel.tsx`, `src/components/room/RoomClient.tsx`, and `src/components/room/RoomPersonCard.tsx` for `router.push` and `` `/profile/ ``.

Expected: no `router.push` to a profile. The only profile URL in the card is the `profileLink` anchor with `target="_blank"`. Side panel and canvas profile controls pass `onPick` or `onPickPerson`.

- [ ] **Step 6: Commit**

```bash
git add src/components/venue/VenueCanvas.tsx src/components/venue/RoomSidePanel.tsx src/components/room/RoomClient.tsx
git commit -m "Open room profiles in a card so DJs stay on the booth."
```
