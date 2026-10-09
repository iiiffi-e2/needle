import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkTrackPlayBadges } from "@/lib/badges";
import { advancePlayback, shouldRotateToNextDj } from "./playback";

vi.mock("@/lib/badges", () => ({
  checkTrackPlayBadges: vi.fn(),
  awardStatBadges: vi.fn(),
}));

describe("shouldRotateToNextDj", () => {
  it("does not rotate when there is only one DJ", () => {
    expect(
      shouldRotateToNextDj(["dj-a"], ["dj-a", "dj-b"], "dj-a")
    ).toBe(false);
  });

  it("does not rotate when only the current DJ has queued tracks", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b", "dj-c"], ["dj-a"], "dj-a")
    ).toBe(false);
  });

  it("rotates when another booth DJ has queued tracks", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b"], ["dj-a", "dj-b"], "dj-a")
    ).toBe(true);
  });

  it("ignores queued tracks from DJs not in the booth", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b"], ["dj-a", "dj-c"], "dj-a")
    ).toBe(false);
  });

  it("does not rotate without a current DJ", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b"], ["dj-b"], null)
    ).toBe(false);
  });
});

const ROOM_ID = "room-1";

const FIXTURE_TRACK_TITLE = "Night Drive";

interface FakeFilter {
  op: "eq" | "gte" | "lt";
  column: string;
  value: unknown;
}

interface FakeCall {
  table: string;
  op: "select" | "insert" | "update" | "upsert";
  payload?: unknown;
  filters: FakeFilter[];
}

interface FakeReply {
  data: unknown;
  error: { message: string } | null;
}

function fakeSupabase(reply: (call: FakeCall) => FakeReply) {
  const calls: FakeCall[] = [];

  function from(table: string) {
    let op: FakeCall["op"] = "select";
    let payload: unknown;
    const filters: FakeFilter[] = [];

    const execute = () => {
      const call: FakeCall = { table, op, payload, filters: [...filters] };
      calls.push(call);
      return reply(call);
    };

    const chain = {
      select: () => chain,
      insert: (value: unknown) => {
        op = "insert";
        payload = value;
        return chain;
      },
      update: (value: unknown) => {
        op = "update";
        payload = value;
        return chain;
      },
      upsert: (value: unknown) => {
        op = "upsert";
        payload = value;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ op: "eq", column, value });
        return chain;
      },
      gte: (column: string, value: unknown) => {
        filters.push({ op: "gte", column, value });
        return chain;
      },
      lt: (column: string, value: unknown) => {
        filters.push({ op: "lt", column, value });
        return chain;
      },
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => Promise.resolve(execute()),
      maybeSingle: () => Promise.resolve(execute()),
      then: (
        resolve: (value: FakeReply) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(execute()).then(resolve, reject),
    };

    return chain;
  }

  return {
    calls,
    client: { from } as unknown as SupabaseClient,
  };
}

function houseRoom(options: {
  playback: {
    current_track_id: string | null;
    current_queue_item_id: string | null;
    current_dj_user_id?: string | null;
  };
  played?: { track_id: string; played_at: string }[];
  insert?: FakeReply;
  liveQueueItemId?: string | null;
  djSlots?: {
    id: string;
    user_id: string;
    position: number;
    missed_turns: number;
    user?: { display_name: string };
  }[];
  queued?: {
    id: string;
    dj_user_id: string;
    track_id: string;
    track?: { title: string };
    is_house?: boolean;
  };
}) {
  let playbackReads = 0;
  const fake = fakeSupabase((call) => {
    if (call.table === "rooms") {
      return { data: { id: ROOM_ID }, error: null };
    }
    if (call.table === "room_playback" && call.op === "select") {
      playbackReads += 1;
      if (playbackReads > 1 && options.liveQueueItemId !== undefined) {
        return {
          data: { current_queue_item_id: options.liveQueueItemId },
          error: null,
        };
      }
      return { data: options.playback, error: null };
    }
    if (call.table === "dj_slots" && call.op === "select") {
      const inactiveOnly = call.filters.some(
        (filter) => filter.op === "gte" && filter.column === "missed_turns"
      );
      if (inactiveOnly) return { data: [], error: null };
      return { data: options.djSlots ?? [], error: null };
    }
    if (call.table === "queue_items" && call.op === "select") {
      const status = call.filters.find(
        (filter) => filter.op === "eq" && filter.column === "status"
      )?.value;
      if (status === "queued") {
        if (!options.queued) return { data: null, error: null };
        const forDj = call.filters.some((filter) => filter.column === "dj_user_id");
        return {
          data: forDj ? options.queued : [{ dj_user_id: options.queued.dj_user_id }],
          error: null,
        };
      }
      return { data: options.played ?? [], error: null };
    }
    if (call.table === "users") {
      return { data: { display_name: "Ada" }, error: null };
    }
    if (call.table === "queue_items" && call.op === "update") {
      const id = call.filters.find((filter) => filter.column === "id")?.value;
      if (options.queued && id === options.queued.id) {
        return { data: options.queued, error: null };
      }
      return { data: { id: options.playback.current_queue_item_id }, error: null };
    }
    if (call.table === "queue_items" && call.op === "insert") {
      return options.insert ?? { data: { id: "house-1" }, error: null };
    }
    if (call.table === "tracks") {
      return { data: { title: FIXTURE_TRACK_TITLE }, error: null };
    }
    return { data: null, error: null };
  });

  return fake;
}

const SEATED_DJ = {
  id: "slot-1",
  user_id: "dj-a",
  position: 0,
  missed_turns: 0,
  user: { display_name: "Ada" },
};

describe("advancePlayback house", () => {
  beforeEach(() => {
    vi.mocked(checkTrackPlayBadges).mockClear();
  });

  it("clears playback and posts that the booth is open only when a track had been current", async () => {
    const quiet = houseRoom({
      playback: { current_track_id: null, current_queue_item_id: null },
    });
    const spinning = houseRoom({
      playback: {
        current_track_id: "track-current",
        current_queue_item_id: "queue-current",
      },
    });

    await expect(advancePlayback(quiet.client, ROOM_ID)).resolves.toEqual({
      advanced: false,
      reason: "no_djs",
    });
    await expect(advancePlayback(spinning.client, ROOM_ID)).resolves.toEqual({
      advanced: false,
      reason: "no_djs",
    });

    const cleared = {
      room_id: ROOM_ID,
      current_track_id: null,
      current_queue_item_id: null,
      current_dj_user_id: null,
      started_at: null,
      is_paused: false,
    };
    expect(quiet.calls.filter((call) => call.op === "upsert").map((call) => call.payload)).toEqual([
      expect.objectContaining(cleared),
    ]);
    expect(spinning.calls.filter((call) => call.op === "upsert").map((call) => call.payload)).toEqual([
      expect.objectContaining(cleared),
    ]);
    expect(boothOpenMessages(quiet.calls)).toEqual([]);
    expect(boothOpenMessages(spinning.calls)).toEqual(["The booth is open."]);
  });

  it("spins one played track as house without writing user stats", async () => {
    const fake = houseRoom({
      playback: { current_track_id: null, current_queue_item_id: null },
      played: [{ track_id: "track-9", played_at: "2026-01-01T00:00:00.000Z" }],
    });

    await expect(advancePlayback(fake.client, ROOM_ID)).resolves.toEqual({
      advanced: true,
      reason: "ended",
    });

    expect(fake.calls.filter((call) => call.table === "queue_items" && call.op === "insert").map((call) => call.payload)).toEqual([
      {
        room_id: ROOM_ID,
        dj_user_id: null,
        track_id: "track-9",
        position: 0,
        status: "playing",
        is_house: true,
      },
    ]);
    expect(fake.calls.filter((call) => call.table === "room_playback" && call.op === "upsert").map((call) => call.payload)).toEqual([
      expect.objectContaining({
        current_track_id: "track-9",
        current_queue_item_id: "house-1",
        current_dj_user_id: null,
        is_paused: false,
      }),
    ]);
    expect(fake.calls.filter((call) => call.table === "user_stats")).toEqual([]);
    expect(fake.calls.filter((call) => call.table === "tracks" && call.op !== "select")).toEqual([]);
  });

  it("clears playback instead of throwing when the house insert fails", async () => {
    const fake = houseRoom({
      playback: {
        current_track_id: "track-current",
        current_queue_item_id: "queue-current",
      },
      played: [{ track_id: "track-9", played_at: "2026-01-01T00:00:00.000Z" }],
      insert: { data: null, error: { message: "dj_user_id null" } },
    });

    await expect(advancePlayback(fake.client, ROOM_ID)).resolves.toEqual({
      advanced: false,
      reason: "no_djs",
    });

    expect(fake.calls.filter((call) => call.table === "room_playback" && call.op === "upsert").map((call) => call.payload)).toEqual([
      expect.objectContaining({
        current_track_id: null,
        current_queue_item_id: null,
        current_dj_user_id: null,
        started_at: null,
      }),
    ]);
  });

  it("does not insert when another player already started a track", async () => {
    const fake = houseRoom({
      playback: { current_track_id: null, current_queue_item_id: null },
      played: [{ track_id: "track-9", played_at: "2026-01-01T00:00:00.000Z" }],
      liveQueueItemId: "someone-else",
    });

    await expect(advancePlayback(fake.client, ROOM_ID)).resolves.toEqual({
      advanced: false,
      reason: "no_djs",
    });

    expect(fake.calls.filter((call) => call.op === "insert")).toEqual([]);
    expect(fake.calls.filter((call) => call.op === "upsert")).toEqual([]);
  });

  it("spins house when a seated DJ has no queued track", async () => {
    const fake = houseRoom({
      playback: {
        current_track_id: null,
        current_queue_item_id: null,
        current_dj_user_id: SEATED_DJ.user_id,
      },
      played: [{ track_id: "track-9", played_at: "2026-01-01T00:00:00.000Z" }],
      djSlots: [SEATED_DJ],
    });

    await expect(advancePlayback(fake.client, ROOM_ID)).resolves.toMatchObject({
      advanced: true,
    });

    expect(
      fake.calls
        .filter((call) => call.table === "queue_items" && call.op === "insert")
        .map((call) => call.payload)
    ).toEqual([
      {
        room_id: ROOM_ID,
        dj_user_id: null,
        track_id: "track-9",
        position: 0,
        status: "playing",
        is_house: true,
      },
    ]);
    expect(
      fake.calls
        .filter((call) => call.table === "room_playback" && call.op === "upsert")
        .map((call) => call.payload)
    ).toEqual([
      expect.objectContaining({
        current_track_id: "track-9",
        current_queue_item_id: "house-1",
        current_dj_user_id: null,
      }),
    ]);
    expect(chatBodies(fake.calls)).toContain(
      `The house is spinning: ${FIXTURE_TRACK_TITLE}`
    );
    expect(checkTrackPlayBadges).not.toHaveBeenCalled();
    expect(fake.calls.filter((call) => call.table === "user_stats")).toEqual([]);
  });

  it("clears playback when a seated DJ has no queue and no played history", async () => {
    const fake = houseRoom({
      playback: {
        current_track_id: "track-current",
        current_queue_item_id: "queue-current",
        current_dj_user_id: SEATED_DJ.user_id,
      },
      djSlots: [SEATED_DJ],
    });

    await expect(advancePlayback(fake.client, ROOM_ID)).resolves.toMatchObject({
      advanced: false,
    });

    expect(
      fake.calls
        .filter((call) => call.table === "room_playback" && call.op === "upsert")
        .map((call) => call.payload)
    ).toEqual([
      expect.objectContaining({
        room_id: ROOM_ID,
        current_track_id: null,
        current_queue_item_id: null,
        started_at: null,
        is_paused: false,
      }),
    ]);
    expect(chatBodies(fake.calls)).toContain("The booth is open.");
  });

  it("does not insert a house track when a seated DJ has one queued", async () => {
    const fake = houseRoom({
      playback: {
        current_track_id: null,
        current_queue_item_id: null,
        current_dj_user_id: SEATED_DJ.user_id,
      },
      played: [{ track_id: "track-9", played_at: "2026-01-01T00:00:00.000Z" }],
      djSlots: [SEATED_DJ],
      queued: {
        id: "queue-next",
        dj_user_id: SEATED_DJ.user_id,
        track_id: "track-queued",
        track: { title: "Queued Song" },
      },
    });

    await advancePlayback(fake.client, ROOM_ID);

    expect(
      fake.calls
        .filter((call) => call.table === "queue_items" && call.op === "insert")
        .map((call) => call.payload)
    ).not.toContainEqual(expect.objectContaining({ is_house: true }));
  });
});

function chatBodies(calls: FakeCall[]) {
  return calls
    .filter((call) => call.table === "chat_messages" && call.op === "insert")
    .map((call) => (call.payload as { body?: string }).body);
}

function boothOpenMessages(calls: FakeCall[]) {
  return calls
    .filter((call) => call.table === "chat_messages" && call.op === "insert")
    .map((call) => (call.payload as { body?: string }).body)
    .filter((body) => body === "The booth is open.");
}
