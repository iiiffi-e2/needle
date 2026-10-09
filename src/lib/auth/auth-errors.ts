export const AUTH_ERROR_MESSAGES = {
  google: "Google sign-in didn't complete. Try again.",
  apple: "Apple sign-in didn't complete. Try again.",
  auth: "Sign-in didn't complete. Try again.",
  link: "That link expired. Request a new one.",
  rate: "Wait a moment and try again.",
  email: "Enter a valid email.",
  handle: "Enter your handle as name@server.",
  fedi_refused: "That server can't be used.",
  fedi_unsupported: "That server doesn't support this sign-in.",
  fedi_canceled: "Approval was canceled.",
  fedi_expired: "That sign-in expired. Enter your handle again.",
  fedi_mismatch: "That account doesn't match the handle you entered.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorCode];
  }
  return AUTH_ERROR_MESSAGES.auth;
}

export function emailSendError(message: string): "rate" | "email" {
  return message.toLowerCase().includes("rate") ? "rate" : "email";
}

export function callbackErrorCode(input: {
  provider: string | null;
  hasCode: boolean;
}): "google" | "apple" | "link" | "auth" {
  if (input.provider === "google") return "google";
  if (input.provider === "apple") return "apple";
  if (!input.provider) return "link";
  return "auth";
}
