import { getBadgeDescription } from "@/lib/badges";
import type { Badge } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BadgeCardProps {
  badge?: Badge | null;
  className?: string;
}

export function BadgeCard({ badge, className }: BadgeCardProps) {
  const description = getBadgeDescription(badge?.name, badge?.description);

  return (
    <div
      className={cn(
        "group relative text-center p-3 rounded-xl bg-surface-light",
        description && "cursor-help",
        className
      )}
      title={description ?? undefined}
      aria-label={
        description
          ? `${badge?.name ?? "Badge"}: ${description}`
          : badge?.name ?? "Badge"
      }
    >
      <span className="text-2xl" aria-hidden>
        {badge?.icon || "🏅"}
      </span>
      <p className="text-xs font-medium mt-1">{badge?.name}</p>
      {description && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 w-44 px-3 py-2 text-xs leading-snug text-foreground bg-panel rounded-lg border border-line opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-10 shadow-lg text-center"
        >
          {description}
        </div>
      )}
    </div>
  );
}
