"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { profileControl, type RoomPerson } from "@/lib/room-person";

interface ProfileLinkProps {
  userId: string | null | undefined;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  onPick?: (person: RoomPerson) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function ProfileLink({
  userId,
  displayName = null,
  avatarUrl = null,
  avatarColor = null,
  onPick,
  children,
  className,
  style,
  title = "View profile",
}: ProfileLinkProps) {
  const control = profileControl(userId, onPick !== undefined);

  if (control === "static" || !userId) {
    return <>{children}</>;
  }

  if (control === "button") {
    return (
      <button
        type="button"
        className={className}
        style={style}
        title={title}
        onClick={() =>
          onPick?.({
            userId,
            displayName,
            avatarUrl,
            avatarColor,
          })
        }
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={`/profile/${userId}`}
      className={className}
      style={style}
      title={title}
    >
      {children}
    </Link>
  );
}
