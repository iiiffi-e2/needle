"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollOnHoverTextProps {
  text: string;
  className?: string;
}

const SCROLL_SPEED_PX_PER_SEC = 35;
const SCROLL_START_DELAY_MS = 400;
const SCROLL_BACK_DURATION_MS = 600;

export function ScrollOnHoverText({ text, className = "" }: ScrollOnHoverTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);
  const [hovered, setHovered] = useState(false);

  const overflows = overflowPx > 1;

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    setOverflowPx(Math.max(0, measure.scrollWidth - container.clientWidth));
  }, [text]);

  useEffect(() => {
    recompute();
    const observer = new ResizeObserver(recompute);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [recompute]);

  const scrollDurationSec = Math.max(1.5, overflowPx / SCROLL_SPEED_PX_PER_SEC);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden min-w-0"
      onMouseEnter={() => overflows && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={measureRef}
        className={`invisible absolute whitespace-nowrap pointer-events-none ${className}`}
        aria-hidden
      >
        {text}
      </span>
      <span
        className={`block whitespace-nowrap ${className} ${
          !hovered && overflows ? "truncate" : ""
        }`}
        style={
          hovered && overflows
            ? {
                transform: `translateX(-${overflowPx}px)`,
                transition: `transform ${scrollDurationSec}s linear ${SCROLL_START_DELAY_MS}ms`,
              }
            : {
                transform: "translateX(0)",
                transition: `transform ${SCROLL_BACK_DURATION_MS}ms ease-out`,
              }
        }
      >
        {text}
      </span>
    </div>
  );
}
