"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampCrowdFloorPosition,
  loadCrowdPos,
  saveCrowdPos,
  type CrowdPos,
} from "@/lib/design-tokens";

type DragState = {
  pointerId: number;
  originX: number;
  originY: number;
  startLeft: number;
  startTop: number;
  venue: DOMRect;
  element: HTMLElement;
  onMove: (ev: PointerEvent) => void;
  onUp: (ev: PointerEvent) => void;
};

export function useLocalCrowdPosition(roomSlug: string, enabled: boolean) {
  const [override, setOverride] = useState<CrowdPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!enabled || !roomSlug) {
      setOverride(null);
      return;
    }
    setOverride(loadCrowdPos(roomSlug));
  }, [roomSlug, enabled]);

  useEffect(() => {
    return () => {
      const drag = dragRef.current;
      if (!drag) return;
      window.removeEventListener("pointermove", drag.onMove);
      window.removeEventListener("pointerup", drag.onUp);
      window.removeEventListener("pointercancel", drag.onUp);
      if (drag.element.hasPointerCapture(drag.pointerId)) {
        try {
          drag.element.releasePointerCapture(drag.pointerId);
        } catch {
          // element may be detached on unmount
        }
      }
      dragRef.current = null;
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      if (dragRef.current) return;
      const venue = event.currentTarget
        .closest(".needle-venue-inner")
        ?.getBoundingClientRect();
      if (!venue || venue.width <= 0 || venue.height <= 0) return;

      // Caller must set data-left-pct / data-top-pct on the draggable node
      // for the initial assigned slot when override is null.
      const el = event.currentTarget;
      const startLeft = override?.leftPct ?? Number(el.dataset.leftPct);
      const startTop = override?.topPct ?? Number(el.dataset.topPct);
      if (!Number.isFinite(startLeft) || !Number.isFinite(startTop)) return;

      event.preventDefault();
      el.setPointerCapture(event.pointerId);

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        const dxPct = ((ev.clientX - drag.originX) / drag.venue.width) * 100;
        const dyPct = ((ev.clientY - drag.originY) / drag.venue.height) * 100;
        const next = clampCrowdFloorPosition(
          drag.startLeft + dxPct,
          drag.startTop + dyPct
        );
        setOverride(next);
      };

      const onUp = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (drag.element.hasPointerCapture(ev.pointerId)) {
          drag.element.releasePointerCapture(ev.pointerId);
        }
        dragRef.current = null;
        setIsDragging(false);
        setOverride((pos) => {
          if (pos) saveCrowdPos(roomSlug, pos);
          return pos;
        });
      };

      dragRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startLeft,
        startTop,
        venue,
        element: el,
        onMove,
        onUp,
      };
      setIsDragging(true);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [enabled, override, roomSlug]
  );

  return { override, isDragging, onPointerDown };
}
