function absoluteOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAppOrigin(
  envUrl: string | undefined,
  requestOrigin: string
): string {
  return (
    absoluteOrigin(envUrl ?? "") ??
    absoluteOrigin(requestOrigin) ??
    requestOrigin.replace(/\/+$/, "")
  );
}

export function fediverseRedirectUri(origin: string): string {
  return `${origin}/auth/fediverse/callback`;
}

export function fediverseAppStorageKey(host: string, redirectUri: string): string {
  return `${host} ${redirectUri}`;
}
