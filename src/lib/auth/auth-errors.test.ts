import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  callbackErrorCode,
  emailSendError,
} from "./auth-errors";

describe("authErrorMessage", () => {
  it("returns every spec sentence", () => {
    expect(authErrorMessage("google")).toBe(AUTH_ERROR_MESSAGES.google);
    expect(authErrorMessage("apple")).toBe(
      "Apple sign-in didn't complete. Try again."
    );
    expect(authErrorMessage("auth")).toBe(
      "Sign-in didn't complete. Try again."
    );
    expect(authErrorMessage("link")).toBe(
      "That link expired. Request a new one."
    );
    expect(authErrorMessage("rate")).toBe("Wait a moment and try again.");
    expect(authErrorMessage("email")).toBe("Enter a valid email.");
    expect(authErrorMessage("handle")).toBe(
      "Enter your handle as name@server."
    );
    expect(authErrorMessage("fedi_refused")).toBe("That server can't be used.");
    expect(authErrorMessage("fedi_unsupported")).toBe(
      "That server doesn't support this sign-in."
    );
    expect(authErrorMessage("fedi_canceled")).toBe("Approval was canceled.");
    expect(authErrorMessage("fedi_expired")).toBe(
      "That sign-in expired. Enter your handle again."
    );
    expect(authErrorMessage("fedi_mismatch")).toBe(
      "That account doesn't match the handle you entered."
    );
  });

  it("hides unknown codes and empty input", () => {
    expect(authErrorMessage("server_error")).toBe(AUTH_ERROR_MESSAGES.auth);
    expect(authErrorMessage(null)).toBeNull();
  });
});

describe("emailSendError", () => {
  it("detects a rate limit", () => {
    expect(emailSendError("Email rate limit exceeded")).toBe("rate");
    expect(emailSendError("Unable to validate email address")).toBe("email");
  });
});

describe("callbackErrorCode", () => {
  it("names the provider when the cookie is present", () => {
    expect(callbackErrorCode({ provider: "google", hasCode: false })).toBe(
      "google"
    );
    expect(callbackErrorCode({ provider: "apple", hasCode: true })).toBe(
      "apple"
    );
  });

  it("treats a missing provider as an expired link", () => {
    expect(callbackErrorCode({ provider: null, hasCode: false })).toBe("link");
  });

  it("uses the generic sentence for an unknown provider cookie", () => {
    expect(callbackErrorCode({ provider: "github", hasCode: false })).toBe(
      "auth"
    );
  });
});
