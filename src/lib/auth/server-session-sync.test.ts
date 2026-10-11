import { describe, expect, it } from "vitest";
import { shouldRefreshServerSession } from "./server-session-sync";

describe("shouldRefreshServerSession", () => {
  it("refreshes when the browser has a session the server did not render", () => {
    expect(
      shouldRefreshServerSession({
        event: "INITIAL_SESSION",
        hasSession: true,
        serverHasSession: false,
      })
    ).toBe(true);
  });

  it("leaves a matching signed-in render alone", () => {
    expect(
      shouldRefreshServerSession({
        event: "INITIAL_SESSION",
        hasSession: true,
        serverHasSession: true,
      })
    ).toBe(false);
    expect(
      shouldRefreshServerSession({
        event: "TOKEN_REFRESHED",
        hasSession: true,
        serverHasSession: true,
      })
    ).toBe(false);
  });

  it("refreshes after sign-out", () => {
    expect(
      shouldRefreshServerSession({
        event: "SIGNED_OUT",
        hasSession: false,
        serverHasSession: true,
      })
    ).toBe(true);
  });
});
