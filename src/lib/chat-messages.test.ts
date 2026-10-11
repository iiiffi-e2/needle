import { describe, expect, it } from "vitest";
import type { ChatMessage, User } from "@/lib/types";
import { hydrateChatAuthor, mergeChatMessage } from "./chat-messages";

function user(displayName: string): User {
  return {
    id: "user-1",
    email: null,
    display_name: displayName,
    avatar_url: null,
    avatar_color: "#ff9d3c",
    created_at: "",
  };
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    room_id: "room-1",
    user_id: "user-1",
    body: "hello",
    is_system: false,
    created_at: "2026-10-11T17:00:00.000Z",
    ...overrides,
  };
}

describe("mergeChatMessage", () => {
  it("keeps one row when the live insert arrives before the send response", () => {
    const fromRealtime = message();
    const fromSend = message({ user: user("OpenIntro") });

    const merged = mergeChatMessage(
      mergeChatMessage([], fromRealtime),
      fromSend
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.user?.display_name).toBe("OpenIntro");
    expect(merged[0]?.body).toBe("hello");
  });

  it("keeps the username when the send response arrives first", () => {
    const fromSend = message({ user: user("OpenIntro") });
    const fromRealtime = message();

    const merged = mergeChatMessage(mergeChatMessage([], fromSend), fromRealtime);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.user?.display_name).toBe("OpenIntro");
  });
});

describe("hydrateChatAuthor", () => {
  it("fills the author from room members when the live row has none", () => {
    const hydrated = hydrateChatAuthor(message(), [
      { user_id: "user-1", user: user("OpenIntro") },
    ]);

    expect(hydrated.user?.display_name).toBe("OpenIntro");
  });
});
