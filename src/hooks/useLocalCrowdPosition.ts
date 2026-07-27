"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadCrowdPos,
  saveCrowdPos,
  slideCrowdFloorPosition,
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
  lastValid: CrowdPos;
  onMove: (ev: PointerEvent) => void;
  onUp: (ev: PointerEvent) => void;
};

export function useLocalCrowdPosition(roomSlug: string, enabled: boolean) {
  const [override, setOverride] = useState<CrowdPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const overrideRef = useRef<CrowdPos | null>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<CrowdPos | null>(null);

  useEffect(() => {
    overrideRef.current = override;
  }, [override]);

  useEffect(() => {
    if (!enabled || !roomSlug) {
      setOverride(null);
      return;
    }
    setOverride(loadCrowdPos(roomSlug));
  }, [roomSlug, enabled]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

      const el = event.currentTarget;
      const startLeft =
        overrideRef.current?.leftPct ?? Number(el.dataset.leftPct);
      const startTop =
        overrideRef.current?.topPct ?? Number(el.dataset.topPct);
      if (!Number.isFinite(startLeft) || !Number.isFinite(startTop)) return;

      event.preventDefault();
      el.setPointerCapture(event.pointerId);

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        const dxPct = ((ev.clientX - drag.originX) / drag.venue.width) * 100;
        const dyPct = ((ev.clientY - drag.originY) / drag.venue.height) * 100;
        const next = slideCrowdFloorPosition(
          drag.startLeft + dxPct,
          drag.startTop + dyPct,
          drag.lastValid
        );
        drag.lastValid = next;
        pendingRef.current = next;
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const pending = pendingRef.current;
          if (pending) setOverride(pending);
        });
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
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        const finalPos = pendingRef.current ?? drag.lastValid;
        pendingRef.current = null;
        dragRef.current = null;
        setIsDragging(false);
        setOverride(finalPos);
        saveCrowdPos(roomSlug, finalPos);
      };

      dragRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startLeft,
        startTop,
        venue,
        element: el,
        lastValid: { leftPct: startLeft, topPct: startTop },
        onMove,
        onUp,
      };
      setIsDragging(true);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [enabled, roomSlug]
  );

  return { override, isDragging, onPointerDown };
}
