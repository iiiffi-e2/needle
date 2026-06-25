"use client";

import { cn } from "@/lib/utils";

export type VinylBlobVariant = "crowd" | "dj" | "you";

export interface VinylBlobProps {
  color?: string;
  size?: number;
  variant?: VinylBlobVariant;
  initials?: string;
  dance?: boolean;
  showRing?: boolean;
  showReact?: boolean;
  reactGlyph?: string;
  reactColor?: string;
  reactDelay?: number;
  animDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function VinylBlob({
  color = "#ffd166",
  size = 50,
  variant = "crowd",
  initials,
  dance = false,
  showRing = false,
  showReact = false,
  reactGlyph = "♥",
  reactColor,
  reactDelay = 0,
  animDuration,
  className,
  style,
}: VinylBlobProps) {
  const height = Math.round(size * 1.06);
  const eye = Math.max(5, Math.round(size * 0.11));
  const eyeH = Math.max(6, Math.round(size * 0.14));
  const eyeGap = Math.round(size * 0.18);
  const animClass = dance ? "animate-ndl-wobble" : "animate-ndl-bob";
  const resolvedDuration =
    animDuration ??
    (dance ? 1.7 + (size % 5) * 0.1 : 3 + (size % 4) * 0.2);

  const isDj = variant === "dj";
  const isYou = variant === "you";

  const colorGradient = `radial-gradient(circle at 38% 26%, #ffffff8c, #ffffff00 46%), ${color}`;

  const bodyBg = isDj || isYou
    ? `radial-gradient(circle at 40% 28%, #ffffff88, #ffffff00 46%), ${color}`
    : colorGradient;

  const borderRadius = isDj || isYou
    ? "48% 48% 44% 44% / 56% 56% 44% 44%"
    : "46% 46% 42% 42% / 54% 54% 46% 46%";

  const ringColor = isDj || isYou
    ? `${color}55`
    : `${color}38`;

  return (
    <div className={cn("relative", className)} style={style}>
      {showReact && (
        <span
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-[5] leading-none"
          style={{
            top: -Math.round(size * 0.5),
            fontSize: Math.round(size * 0.42),
            color: reactColor || color,
            textShadow: `0 0 12px ${reactColor || color}`,
            animation: `ndl-rise ${(2.4 + reactDelay).toFixed(2)}s ease-out infinite ${reactDelay.toFixed(2)}s`,
          }}
        >
          {reactGlyph}
        </span>
      )}

      <div
        className={animClass}
        style={{
          position: "relative",
          width: size,
          height,
          transformOrigin: "center bottom",
          animationDuration: `${resolvedDuration.toFixed(2)}s`,
        }}
      >
        {(showRing || dance) && (
          <div
            className={dance ? "animate-ndl-glow" : undefined}
            style={{
              position: "absolute",
              inset: isDj || isYou ? -10 : -7,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${ringColor}, transparent 66%)`,
            }}
          />
        )}

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius,
            background: bodyBg,
            boxShadow: "0 8px 16px #0007, inset 0 -5px 10px #00000038",
            display: isYou ? "flex" : undefined,
            alignItems: isYou ? "center" : undefined,
            justifyContent: isYou ? "center" : undefined,
            color: isYou ? "#fff" : undefined,
            fontSize: isYou ? 11 : undefined,
            fontWeight: isYou ? 800 : undefined,
          }}
        >
          {(isDj || isYou) && (
            <div
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: isDj ? size * 0.94 : size * 0.9,
                height: isDj ? size * 0.48 : size * 0.46,
                border: "5px solid #1d1d24",
                borderBottom: "none",
                borderRadius: isDj ? "34px 34px 0 0" : "30px 30px 0 0",
              }}
            />
          )}

          {isDj && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: size * 0.26,
                  left: -7,
                  width: 13,
                  height: 22,
                  borderRadius: 5,
                  background: "#1d1d24",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: size * 0.26,
                  right: -7,
                  width: 13,
                  height: 22,
                  borderRadius: 5,
                  background: "#1d1d24",
                }}
              />
            </>
          )}

          {isYou ? (
            initials
          ) : (
            <div
              style={{
                position: "absolute",
                top: "34%",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: eyeGap,
              }}
            >
              <span
                style={{
                  width: eye,
                  height: eyeH,
                  borderRadius: "50%",
                  background: isDj ? "#231a16" : "#1c1414",
                }}
              />
              <span
                style={{
                  width: eye,
                  height: eyeH,
                  borderRadius: "50%",
                  background: isDj ? "#231a16" : "#1c1414",
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: -7,
          left: "50%",
          transform: "translateX(-50%)",
          width: Math.round(size * 0.82),
          height: Math.round(size * 0.2),
          borderRadius: "50%",
          background: "radial-gradient(ellipse, #000000aa, transparent 70%)",
          zIndex: -1,
        }}
      />
    </div>
  );
}
