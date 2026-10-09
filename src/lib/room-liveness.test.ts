import { describe, expect, it } from "vitest";
import type { Track } from "@/lib/types";
import { partitionRooms, roomLiveness } from "./room-liveness";

const track = { id: "t1" } as Track;

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

  it("is open when a DJ is on deck, nobody is listening, and nothing is playing", () => {
    expect(
      roomLiveness({ listener_count: 0, dj_count: 1, current_track: null })
    ).toBe("open");
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

  it("sorts quiet rooms by name", () => {
    const rooms = [
      { name: "Zed", listener_count: 0, dj_count: 0, current_track: null },
      { name: "Ada", listener_count: 0, dj_count: 0, current_track: null },
      { name: "Mia", listener_count: 0, dj_count: 0, current_track: null },
    ];
    expect(partitionRooms(rooms).quiet.map((room) => room.name)).toEqual([
      "Ada",
      "Mia",
      "Zed",
    ]);
  });

  it("breaks a listener_count tie by name", () => {
    const rooms = [
      { name: "Zed", listener_count: 3, dj_count: 0, current_track: track },
      { name: "Ada", listener_count: 3, dj_count: 0, current_track: track },
    ];
    expect(partitionRooms(rooms).spinning.map((room) => room.name)).toEqual([
      "Ada",
      "Zed",
    ]);
  });
});
