const USERNAME = /^[a-z0-9_]{1,30}$/;
const HOST =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export type FediverseHandle = {
  username: string;
  host: string;
  acct: string;
};

export function parseFediverseHandle(input: string): FediverseHandle | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (!raw.toLowerCase().startsWith("https://")) return null;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.username || url.password || url.port || url.search || url.hash) {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0].startsWith("@")) {
      const username = parts[0].slice(1);
      if (!username || username.includes("@")) return null;
      return finish(username, url.hostname);
    }
    if (parts.length === 2 && parts[0] === "users") {
      return finish(parts[1], url.hostname);
    }
    return null;
  }

  const body = raw.startsWith("@") ? raw.slice(1) : raw;
  const at = body.indexOf("@");
  if (at <= 0 || at !== body.lastIndexOf("@") || at === body.length - 1) {
    return null;
  }
  return finish(body.slice(0, at), body.slice(at + 1));
}

function finish(username: string, host: string): FediverseHandle | null {
  const normalizedUser = username.trim().toLowerCase();
  const normalizedHost = host.trim().toLowerCase().replace(/\.$/, "");
  if (!USERNAME.test(normalizedUser) || !HOST.test(normalizedHost)) return null;
  return {
    username: normalizedUser,
    host: normalizedHost,
    acct: `${normalizedUser}@${normalizedHost}`,
  };
}
