export function resolveAppOrigin(
  envUrl: string | undefined,
  requestOrigin: string
): string {
  const raw = envUrl?.trim() || requestOrigin;
  return raw.replace(/\/+$/, "");
}

export function fediverseRedirectUri(origin: string): string {
  return `${origin}/auth/fediverse/callback`;
}
