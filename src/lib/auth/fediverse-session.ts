import { createHash } from "node:crypto";
import { httpsAvatar } from "./fediverse-broker";

export function fediverseEmail(acct: string): string {
  const hex = createHash("sha256").update(acct, "utf8").digest("hex");
  return `fedi.${hex}@users.needle.invalid`;
}

export function publicEmailForAuthUser(
  email: string | null | undefined
): string | null {
  if (!email || email.endsWith("@users.needle.invalid")) return null;
  return email;
}

export type FediverseSessionProfile = {
  acct: string;
  displayName: string;
  avatarUrl: string | null;
};

export type SessionDeps = {
  findUserIdByAcct: (acct: string) => Promise<string | null>;
  createAuthUser: (input: {
    email: string;
    metadata: Record<string, string>;
  }) => Promise<{ ok: true } | { ok: false; duplicate: boolean }>;
  mintSession: (email: string) => Promise<void>;
};

export async function establishFediverseSession(
  profile: FediverseSessionProfile,
  deps: SessionDeps
): Promise<{ created: boolean }> {
  const email = fediverseEmail(profile.acct);
  const existing = await deps.findUserIdByAcct(profile.acct);
  if (existing) {
    await deps.mintSession(email);
    return { created: false };
  }

  const metadata: Record<string, string> = {
    display_name: profile.displayName,
    fediverse_acct: profile.acct,
  };
  const avatar = httpsAvatar(profile.avatarUrl);
  if (avatar) metadata.avatar_url = avatar;

  const created = await deps.createAuthUser({ email, metadata });
  if ("duplicate" in created) {
    if (!created.duplicate) {
      throw new Error("Could not create Fediverse account");
    }
    const again = await deps.findUserIdByAcct(profile.acct);
    if (!again) throw new Error("Could not create Fediverse account");
    await deps.mintSession(email);
    return { created: false };
  }
  await deps.mintSession(email);
  return { created: true };
}
