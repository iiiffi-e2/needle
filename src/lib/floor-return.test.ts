import { describe, expect, it } from "vitest";
import type { FriendWithPresence } from "@/lib/types";
import { floorPingsFrom, friendsOnTheFloor, nextFloorPings, yourLiveRooms } from "./floor-return";

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
