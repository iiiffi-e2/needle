import { getAuthCallbackUrl } from "@/lib/utils";

export function safeRedirectPath(input: string | null | undefined): string {
  if (typeof input !== "string" || input.length === 0) return "/rooms";
  if (!input.startsWith("/")) return "/rooms";
  if (input.startsWith("//") || input.startsWith("/\\")) return "/rooms";
  if (
    input.includes("://") ||
    input.includes("\\") ||
    input.includes("\n") ||
    input.includes("\r") ||
    input.includes("\0")
  ) {
    return "/rooms";
  }
  return input;
}

export function oauthRedirectTo(next: string | null | undefined): string {
  return getAuthCallbackUrl(safeRedirectPath(next));
}
