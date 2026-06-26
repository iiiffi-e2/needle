"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  gapPx?: number;
  speedPxPerSec?: number;
}

const DEFAULT_GAP_PX = 40;
const DEFAULT_SPEED_PX_PER_SEC = 28;

export function MarqueeText({
  text,
  className = "",
  gapPx = DEFAULT_GAP_PX,
  speedPxPerSec = DEFAULT_SPEED_PX_PER_SEC,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [segmentWidth, setSegmentWidth] = useState(0);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const width = measure.scrollWidth;
    setSegmentWidth(width);
    setOverflows(width > container.clientWidth + 1);
  }, [text]);

  useEffect(() => {
    recompute();
    const observer = new ResizeObserver(recompute);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [recompute]);

  const loopDistance = segmentWidth + gapPx;
  const durationSec = Math.max(4, loopDistance / speedPxPerSec);

  return (
    <div ref={containerRef} className="overflow-hidden min-w-0">
      <span
        ref={measureRef}
        className={`invisible absolute whitespace-nowrap pointer-events-none ${className}`}
        aria-hidden
      >
        {text}
      </span>
      {overflows ? (
        <div
          className="flex whitespace-nowrap animate-ndl-marquee motion-reduce:animate-none"
          style={{ animationDuration: `${durationSec}s` }}
        >
          <span className={className} style={{ paddingRight: gapPx }}>
            {text}
          </span>
          <span className={className} style={{ paddingRight: gapPx }} aria-hidden>
            {text}
          </span>
        </div>
      ) : (
        <span className={`block truncate ${className}`}>{text}</span>
      )}
    </div>
  );
}
