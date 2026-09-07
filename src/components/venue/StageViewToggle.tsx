"use client";

import { cn } from "@/lib/utils";
import type { StageViewMode } from "@/lib/stage-view";

interface StageViewToggleProps {
  value: StageViewMode;
  onChange: (mode: StageViewMode) => void;
}

const OPTIONS: {
  mode: StageViewMode;
  label: string;
  title: string;
}[] = [
  {
    mode: "full",
    label: "Full Stage",
    title: "Show the video as the main room screen.",
  },
  {
    mode: "compact",
    label: "Compact Stage",
    title: "Shrink the video into a smaller now-playing display.",
  },
];

export function StageViewToggle({ value, onChange }: StageViewToggleProps) {
  return (
    <div className="stage-view-toggle" role="radiogroup" aria-label="Stage view">
      {OPTIONS.map((option) => {
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.mode)}
            className={cn(
              "stage-view-toggle__btn",
              active && "stage-view-toggle__btn--active"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
