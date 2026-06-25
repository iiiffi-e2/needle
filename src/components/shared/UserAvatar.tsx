import { cn, getInitials } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  isActive?: boolean;
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
  isActive,
}: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "User"}
        className={cn(
          "rounded-full object-cover ring-2 ring-surface-light",
          sizeClasses[size],
          isActive && "ring-accent animate-pulse-soft",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-surface-light flex items-center justify-center font-medium text-muted ring-2 ring-surface-light",
        sizeClasses[size],
        isActive && "ring-accent animate-pulse-soft",
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
