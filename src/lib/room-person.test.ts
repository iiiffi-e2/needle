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
