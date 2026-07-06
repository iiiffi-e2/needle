"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

interface ProfileLinkProps {
  userId: string | null | undefined;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function ProfileLink({
  userId,
  children,
  className,
  style,
  title = "View profile",
}: ProfileLinkProps) {
  if (!userId) {
    return <>{children}</>;
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
