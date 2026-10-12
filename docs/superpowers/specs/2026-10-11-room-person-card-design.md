# In-room person card

**Date:** 2026-10-11  
**Status:** Approved

## Problem

Viewing someone who is in the room navigates this tab to `/profile/[id]`. That unmounts the room. The room's presence cleanup sends `DELETE /api/rooms/[slug]/presence`, which removes the member and, if they are the active DJ, steps them off the booth and cuts the track.

This happens from a double-click on the floor, and from a single click on chat names and avatars, the current DJ, a side-deck DJ, the side-panel floor list, and the waitlist.

## Goals

1. Every profile control inside the room opens a short card over the room. The room stays mounted, presence keeps heartbeating, and a DJ stays on the booth with the track playing.
2. The card shows the person's avatar and name, and a link to the full profile. For someone else, it also shows the same friend actions as the profile page.
3. "View full profile" opens `/profile/[id]` in a new tab. This tab stays on the room.
4. Profile links outside the room still open `/profile/[id]` in this tab.

## Non-goals

- Stats, badges, recently played, or avatar color settings on the card. Those stay on the full profile page.
- Changing what happens when someone actually leaves the room page.
- Changing floor single-click, which still only brings that person forward.
- A browser or component test harness. Tests stay Vitest unit tests on pure decisions.

## Approach

One card owned by the room. In-room profile controls report the person upward and do not navigate. The card reads the name and avatar from that click, then loads the relationship with a new `GET`. Friend actions keep calling the endpoints they already use.

## Interaction

`RoomClient` holds the open person, or nothing:

```ts
{
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
}
```

| Control | Gesture | Result |
| --- | --- | --- |
| Floor avatar, someone else | Click | Bring forward, as today |
| Floor avatar, someone else | Double-click | Open the card |
| Floor avatar, you | Click or drag | Unchanged. No card |
| Chat name, chat avatar, current DJ, side-deck DJ, floor-list dot, waitlist name | Click | Open the card |
| Your own name in those lists | Click | Open the card |
| Navbar, friends page, and any other profile link outside the room | Click | Navigate to `/profile/[id]` in this tab |

Opening a different person replaces the card. A close button, the backdrop, or Escape dismisses it. The room does not reload.

"View full profile" is an anchor to `/profile/[id]` with `target="_blank"` and `rel="noopener noreferrer"`. Opening it leaves the card as it is. This tab does not navigate, including when a request comes back unauthorized.

System chat lines have no user id and stay plain text.

## Card

A fixed, centered glass dialog on phone and desktop, above the venue, top bar, side panel, and mobile drawer. It is `role="dialog"` and `aria-modal="true"`, labelled by the person's name.

Contents, top to bottom:

1. Close button.
2. Avatar and display name from the click. A missing name shows as "Anonymous."
3. Friend actions, only when the open person is not you. Same actions and labels as the profile page: Add Friend, cancel a sent request, accept or decline an incoming request, unfriend, and block, plus Request Sent, Friends, Blocked, and Not Available.
4. "View full profile."

Your own card skips friend actions and does not look up a relationship. Color settings stay on the full profile page.

## Data flow

The click already carries `userId`, `displayName`, `avatarUrl`, and `avatarColor` from a room member, chat message, DJ, or waitlist entry. The card does not load the profile page.

`GET /api/friends/[userId]` returns the relationship between the signed-in user and that person:

```ts
{ relationship: Relationship | null }
```

It uses the existing `getRelationship` helper. `null` means no row. The route is authenticated. A missing id, or an id equal to the signed-in user, is a 400. The existing `DELETE` on this path stays the unfriend action.

The name is visible immediately. The action row waits on the lookup. Each lookup is tied to the open `userId`; a result applies only while that person is still open. Your own card skips the lookup.

Add, cancel, accept, decline, unfriend, and block keep using their current endpoints.

## Errors

- A failed lookup leaves the card open with the name, avatar, and full-profile link. The action row shows the error and a Retry button that repeats the `GET`.
- A failed friend action keeps the previous relationship and shows the error under the buttons, as the profile page does.
- If the person leaves the room, the card stays. It is a snapshot, and friendship is not tied to presence.
- An unauthorized response is shown in the card. The room does not navigate away.

## Components

- `RoomClient` holds the open person and renders `RoomPersonCard`.
- `ProfileLink` accepts an optional `onPick`. When `onPick` is set, it renders a button that calls `onPick` with the person and does not navigate. When `onPick` is absent and there is a user id, it stays a link to `/profile/[id]`. When there is no user id, it renders its children only.
- Floor double-click, DJ blobs, and side-deck blobs call the same `onPick` path. Floor single-click still only focuses.
- Chat, the floor list, and the waitlist pass `onPick` into `ProfileLink`.
- `FriendActions` gains `layout?: "card" | "plain"`, defaulting to `"card"`. `"plain"` omits the glass card and the "Friend Actions" heading and renders the action row and the error, so the room dialog does not nest a second card. The profile page keeps the default.

In-room picks must not use `router.push` or a `Link` to the profile. Either one unmounts the room and runs the presence `DELETE`.

## Pure decisions

One small module exports:

- `showsFriendActions(currentUserId, personUserId)` — true only when the ids differ.
- `relationshipApplies(resultUserId, openUserId)` — true only when `openUserId` is that result's user.
- `personDisplayName(displayName)` — the trimmed name, or `"Anonymous"` when it is null, missing, or blank.
- `profileLink(userId)` — `{ href: "/profile/[id]", target: "_blank", rel: "noopener noreferrer" }`.
- `profileControl(userId, hasOnPick)` — `"button"` when `hasOnPick` is set and there is a user id, `"link"` when there is a user id and no `onPick`, `"static"` when there is no user id. `"button"` does not navigate this tab.

## Testing

Vitest covers those five functions, including a blank name, a stale `openUserId` of `null`, and both control kinds for the same user id.

## Files

- `src/components/room/RoomPersonCard.tsx` — the dialog
- `src/components/room/RoomClient.tsx` — open-person state
- `src/components/shared/ProfileLink.tsx` — optional `onPick`
- `src/components/venue/VenueCanvas.tsx` — floor double-click and DJ blobs
- `src/components/venue/RoomSidePanel.tsx` — chat, floor list, waitlist
- `src/components/profile/FriendActions.tsx` — plain layout
- `src/app/api/friends/[userId]/route.ts` — add `GET`
- A small pure module under `src/lib/`, with a matching `*.test.ts`, for the decisions above
