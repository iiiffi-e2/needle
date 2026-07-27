const ADJECTIVES = [
  "Void", "Neon", "Cryptic", "Savage", "Ghost", "Toxic", "Chrome", "Feral",
  "Hollow", "Lucid", "Rogue", "Silent", "Brutal", "Cosmic", "Wicked", "Ashen",
  "Frozen", "Iron", "Phantom", "Vivid", "Cursed", "Electric", "Noir", "Wild",
  "Obsidian", "Crimson", "Solar", "Noirish", "Haunted", "Radiant",
] as const;

const NOUNS = [
  "Moth", "Reaper", "Viper", "Wraith", "Fox", "Raven", "Blade", "Echo",
  "Wolf", "Specter", "Drifter", "Spark", "Shade", "Hawk", "Cipher", "Pulse",
  "Serpent", "Mirage", "Crow", "Nomad", "Ember", "Fang", "Orbit", "Thorn",
  "Golem", "Siren", "Comet", "Dagger", "Phantom", "Storm",
] as const;

/** Fun/scary/cool display name. Pass rng for tests (returns 0..1). */
export function generateStressDisplayName(rng: () => number = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)]!;
  return `${adj}${noun}`;
}

/** If taken, append 2–4 digit suffix until unique. */
export function ensureUniqueDisplayName(
  candidate: string,
  taken: Set<string>,
  rng: () => number = Math.random
): string {
  const lowerTaken = new Set([...taken].map((s) => s.toLowerCase()));
  if (!lowerTaken.has(candidate.toLowerCase())) return candidate;
  for (let i = 0; i < 50; i++) {
    const suffix = String(Math.floor(rng() * 9000) + 1000);
    const next = `${candidate}${suffix}`;
    if (!lowerTaken.has(next.toLowerCase())) return next;
  }
  return `${candidate}${Date.now().toString(36)}`;
}
