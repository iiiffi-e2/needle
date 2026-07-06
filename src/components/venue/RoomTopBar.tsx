"use client";

import Link from "next/link";
import type { Room, User } from "@/lib/types";
import { NeedleLogo } from "@/components/shared/NeedleLogo";
import { UserMenu } from "@/components/shared/UserMenu";
import { InviteFriendsButton } from "./InviteFriendsButton";
import { EnergyMeter } from "./EnergyMeter";

interface RoomTopBarProps {
  room: Room;
  listenerCount: number;
  energy: number;
  currentUser?: User | null;
  memberUserIds?: Set<string>;
}

export function RoomTopBar({
  room,
  listenerCount,
  energy,
  currentUser,
  memberUserIds,
}: RoomTopBarProps) {
  return (
    <header
      className="needle-topbar shrink-0 relative z-[60] flex items-center gap-[18px] px-[22px]"
      style={{
        height: 64,
        borderBottom: "1px solid var(--line)",
        background:
          "linear-gradient(180deg, rgba(28, 18, 11, 0.92), transparent)",
      }}
    >
      <Link href="/" className="flex items-center gap-[11px] shrink-0">
        <NeedleLogo size={34} />
        <span
          className="font-display font-extrabold tracking-tight hidden lg:inline"
          style={{ fontSize: 21, letterSpacing: "-0.02em" }}
        >
          Needle
        </span>
      </Link>

      <div className="hidden lg:block w-px h-[26px] shrink-0" style={{ background: "var(--line)" }} />

      <div className="flex flex-col gap-px min-w-0 flex-1 lg:flex-none lg:shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold truncate" style={{ fontSize: 15 }}>
            {room.name}
          </span>
          {!room.is_private && (
            <span
              className="font-bold tracking-wider px-[7px] py-0.5 rounded-full shrink-0 hidden sm:inline"
              style={{
                fontSize: 10,
                letterSpacing: "0.08em",
                background: "rgba(255, 157, 60, 0.18)",
                color: "var(--glow2)",
                border: "1px solid rgba(255, 157, 60, 0.35)",
              }}
            >
              PUBLIC
            </span>
          )}
        </div>
        <div
          className="hidden lg:flex items-center gap-1.5"
          style={{ fontSize: 11.5, color: "var(--sub)" }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full shrink-0 animate-ndl-livedot"
            style={{
              background: "#36e07f",
              boxShadow: "0 0 8px #36e07f",
            }}
          />
          <span>
            <b className="font-bold" style={{ color: "var(--txt)" }}>
              {listenerCount}
            </b>{" "}
            in the room
          </span>
        </div>
      </div>

      <div className="hidden lg:block flex-1" />

      <div className="flex items-center gap-2 shrink-0 lg:hidden">
        <span
          className="w-[7px] h-[7px] rounded-full shrink-0 animate-ndl-livedot"
          style={{
            background: "#36e07f",
            boxShadow: "0 0 8px #36e07f",
          }}
        />
        <span className="font-bold tabular-nums" style={{ fontSize: 14 }}>
          {listenerCount}
        </span>
      </div>

      <div className="hidden lg:block">
        <EnergyMeter energy={energy} />
      </div>

      {currentUser && (
        <>
          <InviteFriendsButton
            roomSlug={room.slug}
            currentUserId={currentUser.id}
            memberUserIds={memberUserIds}
          />
          <UserMenu
            userId={currentUser.id}
            displayName={currentUser.display_name || "Profile"}
            variant="avatar"
            avatarColor={currentUser.avatar_color}
            roomSlug={room.slug}
          />
        </>
      )}
    </header>
  );
}
