export interface RoomPerson {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
}

export function showsFriendActions(
  currentUserId: string,
  personUserId: string
): boolean {
  return currentUserId !== personUserId;
}

export function relationshipApplies(
  resultUserId: string,
  openUserId: string | null
): boolean {
  return openUserId !== null && openUserId === resultUserId;
}

export function personDisplayName(
  displayName: string | null | undefined
): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : "Anonymous";
}

export function profileLink(userId: string): {
  href: string;
  target: "_blank";
  rel: "noopener noreferrer";
} {
  return {
    href: `/profile/${userId}`,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function profileControl(
  userId: string | null | undefined,
  hasOnPick: boolean
): "button" | "link" | "static" {
  if (!userId) return "static";
  return hasOnPick ? "button" : "link";
}

export function relationshipLookupGuard(
  sessionUserId: string | null,
  otherUserId: string | null | undefined
): { status: 401 | 400; error: string } | null {
  if (!sessionUserId) {
    return { status: 401, error: "Unauthorized" };
  }
  if (!otherUserId) {
    return { status: 400, error: "userId is required" };
  }
  if (otherUserId === sessionUserId) {
    return { status: 400, error: "Cannot load your own relationship" };
  }
  return null;
}

export function toRoomPerson(
  userId: string,
  user?: {
    display_name?: string | null;
    avatar_url?: string | null;
    avatar_color?: string | null;
  } | null
): RoomPerson {
  return {
    userId,
    displayName: user?.display_name ?? null,
    avatarUrl: user?.avatar_url ?? null,
    avatarColor: user?.avatar_color ?? null,
  };
}
