"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import { resolveUserColor } from "@/lib/design-tokens";

interface UserMenuProps {
  userId: string;
  displayName: string;
  variant?: "pill" | "avatar";
  avatarColor?: string | null;
}

export function UserMenu({
  userId,
  displayName,
  variant = "pill",
  avatarColor,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  const color = resolveUserColor(userId, avatarColor);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        className={
          variant === "avatar"
            ? "w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center font-extrabold text-[13px] text-[#1c1414] cursor-pointer"
            : "text-sm font-bold px-3 py-1 rounded-full border border-[var(--ndl-line)] hover:border-glow/40 transition-colors cursor-pointer"
        }
        style={
          variant === "avatar"
            ? {
                background: `radial-gradient(circle at 38% 26%, #ffffff8c, #ffffff00 46%), ${color}`,
                boxShadow: `0 0 0 2px var(--bg1), 0 0 14px ${color}88`,
              }
            : undefined
        }
      >
        {variant === "avatar" ? getInitials(displayName) : displayName}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 min-w-[160px] py-1.5 rounded-xl border border-[var(--ndl-line)] bg-[var(--ndl-bg1)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] z-[200]"
        >
          <Link
            href={`/profile/${userId}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            View profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-left px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
