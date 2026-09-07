export type StageViewMode = "full" | "compact";

export const STAGE_VIEW_STORAGE_KEY = "needle-stage-view";

export function parseStageViewMode(value: unknown): StageViewMode {
  return value === "compact" ? "compact" : "full";
}

function getLocalStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function readStageViewMode(): StageViewMode {
  const storage = getLocalStorage();
  if (!storage) return "full";
  try {
    return parseStageViewMode(storage.getItem(STAGE_VIEW_STORAGE_KEY));
  } catch {
    return "full";
  }
}

export function writeStageViewMode(mode: StageViewMode): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(STAGE_VIEW_STORAGE_KEY, mode);
  } catch {
    // localStorage may be unavailable in private mode.
  }
}
