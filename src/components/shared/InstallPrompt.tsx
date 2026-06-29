"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  type BeforeInstallPromptEvent,
  canShowInstallPrompt,
  dismissInstallPrompt,
  isIosSafari,
} from "@/lib/pwa";

export function InstallPrompt() {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isMobile || !canShowInstallPrompt()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode("android");
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (isIosSafari()) {
      const timer = window.setTimeout(() => {
        if (canShowInstallPrompt()) {
          setMode("ios");
          setVisible(true);
        }
      }, 3000);

      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.clearTimeout(timer);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [isMobile]);

  const close = () => {
    dismissInstallPrompt();
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        dismissInstallPrompt();
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  if (!visible || !mode) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[80] px-3 pointer-events-none"
      style={{ top: "max(12px, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg glass-panel rounded-2xl p-3.5 shadow-2xl border border-[var(--ndl-line)]">
        <div className="flex items-start gap-3">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="rounded-xl shrink-0"
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-extrabold text-foreground leading-tight">
              Install Needle
            </p>
            <p className="mt-1 text-xs text-muted leading-snug">
              {mode === "android"
                ? "Add Needle to your home screen for quick access to live rooms."
                : "Add Needle to your home screen for the full app experience."}
            </p>

            {mode === "ios" ? (
              <ol className="mt-2.5 space-y-1.5 text-xs text-foreground/90">
                <li className="flex items-center gap-2">
                  <Share className="size-3.5 shrink-0 text-glow-soft" aria-hidden />
                  Tap <span className="font-semibold">Share</span> in Safari
                </li>
                <li className="flex items-center gap-2">
                  <Download className="size-3.5 shrink-0 text-glow-soft" aria-hidden />
                  Choose <span className="font-semibold">Add to Home Screen</span>
                </li>
              </ol>
            ) : null}
          </div>

          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg p-1 text-muted hover:text-foreground transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="btn-secondary px-3 py-1.5 rounded-full text-xs font-semibold"
          >
            Not now
          </button>
          {mode === "android" ? (
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing || !deferredPrompt}
              className="btn-primary px-3.5 py-1.5 rounded-full text-xs font-bold disabled:opacity-60"
            >
              {installing ? "Installing…" : "Install app"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
