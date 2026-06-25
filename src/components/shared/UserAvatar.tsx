import { cn, getInitials } from "@/lib/utils";
import { crowdColorForUser } from "@/lib/design-tokens";

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  userId?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  isActive?: boolean;
}

const sizePx = {
  sm: 28,
  md: 36,
  lg: 48,
};

export function UserAvatar({
  name,
  avatarUrl,
  userId,
  size = "md",
  className,
  isActive,
}: UserAvatarProps) {
  const px = sizePx[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "User"}
        className={cn(
          "rounded-full object-cover shadow-[0_0_0_2px_var(--ndl-bg1)]",
          isActive && "ring-2 ring-glow animate-ndl-glow",
          className
        )}
        style={{ width: px, height: px }}
      />
    );
  }

  const color = userId ? crowdColorForUser(userId) : "#8a7bff";

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-[#1c1414] shadow-[0_0_0_2px_var(--ndl-bg1)] shrink-0",
        isActive && "ring-2 ring-glow",
        className
      )}
      style={{
        width: px,
        height: px,
        fontSize: px * 0.32,
        background: `radial-gradient(circle at 38% 26%, #ffffff8c, #ffffff00 46%), ${color}`,
        boxShadow: "0 4px 10px #0006, inset 0 -3px 6px #00000038",
      }}
    >
      {getInitials(name)}
    </div>
  );
}
