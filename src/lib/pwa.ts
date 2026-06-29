export const INSTALL_PROMPT_DISMISSED_KEY = "needle_install_prompt_dismissed";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isIosSafari(): boolean {
  if (!isIosDevice()) return false;
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function canShowInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplay()) return false;
  if (localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)) return false;

  return true;
}

export function dismissInstallPrompt(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
  }
}
