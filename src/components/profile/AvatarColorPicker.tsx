"use client";

import { cn } from "@/lib/utils";
import { CROWD_COLORS } from "@/lib/design-tokens";
import { VinylBlob } from "@/components/avatars/VinylBlob";

interface AvatarColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  previewSize?: number;
  showPreview?: boolean;
  className?: string;
}

export function AvatarColorPicker({
  value,
  onChange,
  previewSize = 120,
  showPreview = true,
  className,
}: AvatarColorPickerProps) {
  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      {showPreview && (
        <VinylBlob
          color={value}
          size={previewSize}
          dance
          showRing
          animDuration={2.8}
        />
      )}

      <div className="flex flex-wrap justify-center gap-3 max-w-xs">
        {CROWD_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Select color ${color}`}
            aria-pressed={value === color}
            className={cn(
              "w-10 h-10 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-glow",
              value === color && "ring-2 ring-white scale-110"
            )}
            style={{
              background: `radial-gradient(circle at 38% 26%, #ffffff8c, #ffffff00 46%), ${color}`,
              boxShadow:
                value === color
                  ? `0 0 16px ${color}88`
                  : "0 4px 10px #0006, inset 0 -3px 6px #00000038",
            }}
          />
        ))}
      </div>
    </div>
  );
}
