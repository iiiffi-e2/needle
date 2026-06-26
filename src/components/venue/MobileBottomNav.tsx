"use client";

import { cn } from "@/lib/utils";
import type { TabId } from "@/components/venue/RoomSidePanel";

interface MobileBottomNavProps {
  activeDrawer: TabId | null;
  queueCount: number;
  onOpenDrawer: (tab: TabId) => void;
  onDrop: () => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "queue", label: "Queue", icon: "☰" },
  { id: "crate", label: "Crate", icon: "♪" },
  { id: "info", label: "Info", icon: "ℹ" },
];

export function MobileBottomNav({
  activeDrawer,
  queueCount,
  onOpenDrawer,
  onDrop,
}: MobileBottomNavProps) {
  return (
    <nav
      className="needle-mobile-nav lg:hidden"
      aria-label="Room navigation"
    >
      <button
        type="button"
        onClick={() => onOpenDrawer("chat")}
        className={cn(
          "needle-mobile-nav-item",
          activeDrawer === "chat" && "needle-mobile-nav-item-active"
        )}
      >
        <span className="text-[17px] leading-none">💬</span>
        <span>Chat</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenDrawer("queue")}
        className={cn(
          "needle-mobile-nav-item",
          activeDrawer === "queue" && "needle-mobile-nav-item-active"
        )}
      >
        <span className="text-[17px] leading-none relative">
          ☰
          {queueCount > 0 && (
            <span className="absolute -top-1.5 -right-2 text-[9px] font-bold px-1 rounded-full bg-[rgba(255,157,60,0.35)] text-[var(--glow2)]">
              {queueCount}
            </span>
          )}
        </span>
        <span>Queue</span>
      </button>

      <div className="needle-mobile-nav-fab-slot">
        <button
          type="button"
          onClick={onDrop}
          className="needle-mobile-nav-fab"
          aria-label="Drop a track"
        >
          Drop
        </button>
      </div>

      {NAV_ITEMS.slice(2).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpenDrawer(item.id)}
          className={cn(
            "needle-mobile-nav-item",
            activeDrawer === item.id && "needle-mobile-nav-item-active"
          )}
        >
          <span className="text-[17px] leading-none">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
