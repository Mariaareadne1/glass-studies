import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { VelocityTracker } from './velocity';

export interface DragPoint {
  /** Position in design units relative to the stage origin. */
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface DragHandlers {
  /** Return false to ignore this press (e.g. it missed the control). */
  onStart(p: DragPoint, e: PointerEvent): boolean;
  onMove(p: DragPoint, e: PointerEvent): void;
  onEnd(p: DragPoint, cancelled: boolean): void;
}

/**
 * Pointer-capture drag handling for a stage element. Coordinates are
 * converted to design units with the live `scale`. Handles cancel, lost
 * capture and unmount so a drag can never be left stuck.
 */
export function usePointerDrag(
  ref: RefObject<HTMLElement | null>,
  scaleRef: RefObject<number>,
  handlers: DragHandlers,
): void {
  const h = useRef(handlers);
  useLayoutEffect(() => {
    h.current = handlers;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tracker = new VelocityTracker();
    let active: number | null = null;
    let lastPoint: DragPoint = { x: 0, y: 0, vx: 0, vy: 0 };

    const point = (e: PointerEvent): DragPoint => {
      const r = el.getBoundingClientRect();
      const s = scaleRef.current || 1;
      const x = (e.clientX - r.left) / s;
      const y = (e.clientY - r.top) / s;
      tracker.push(x, y, e.timeStamp || performance.now());
      const v = tracker.get();
      return { x, y, vx: v.vx, vy: v.vy };
    };

    const end = (cancelled: boolean) => {
      if (active === null) return;
      const id = active;
      active = null;
      try {
        if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
      } catch {
        // already released
      }
      h.current.onEnd(lastPoint, cancelled);
    };

    const down = (e: PointerEvent) => {
      if (active !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      tracker.reset();
      const p = point(e);
      if (!h.current.onStart(p, e)) return;
      active = e.pointerId;
      lastPoint = p;
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        // pointer already gone (or synthetic) – the drag still works without capture
      }
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      lastPoint = point(e);
      h.current.onMove(lastPoint, e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      lastPoint = point(e);
      end(false);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === active) end(true);
    };
    const lost = (e: PointerEvent) => {
      if (e.pointerId === active) end(false);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', lost);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('lostpointercapture', lost);
      end(true);
    };
  }, [ref, scaleRef]);
}
