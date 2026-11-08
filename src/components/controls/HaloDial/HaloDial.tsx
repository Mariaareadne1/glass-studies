import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { haloStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { HALO, HaloController, valueFromAngle } from './haloController';

const angleOf = (x: number, y: number) => (Math.atan2(y - HALO.cy, x - HALO.cx) * 180) / Math.PI;

export function HaloDial({ env }: { env: EnvironmentKind }) {
  const value = useStore(haloStore);
  const [ctrl] = useState(() => new HaloController(haloStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => {
    // while dragging the display follows the pointer continuously; the store holds whole percents
    if (!ctrl.dragging) ctrl.setValue(value);
  }, [ctrl, value]);

  const dragTo = (x: number, y: number) => {
    // the angle is unstable near the centre; ignore it there
    if (Math.hypot(x - HALO.cx, y - HALO.cy) < 36) return;
    const raw = valueFromAngle(angleOf(x, y), ctrl.display.x);
    ctrl.setValue(raw, true);
    haloStore.set(Math.round(raw));
  };

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (!ctrl.hitDial(p.x, p.y)) return false;
      ctrl.dragging = true;
      sliderRef.current?.focus({ preventScroll: true });
      dragTo(p.x, p.y);
      ctrl.touch(0.8);
      return true;
    },
    onMove(p) {
      dragTo(p.x, p.y);
    },
    onEnd() {
      ctrl.dragging = false;
      ctrl.setValue(haloStore.get());
      ctrl.touch(0.4);
    },
  });

  // Wheel adjusts the dial only while it has focus, so page scrolling is never hijacked.
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      haloStore.set((v) => Math.round(v - Math.sign(e.deltaY || -e.deltaX) * step));
      ctrl.touch(0.5);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ctrl]);

  const onKey = (e: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    let next: number | null = null;
    if (e.key in steps) next = haloStore.get() + steps[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    haloStore.set(next);
    ctrl.touch(0.5);
  };

  const shown = Math.round(value);
  return (
    <GlassStage controller={ctrl} width={HALO.W} height={HALO.H} env={env} label="Halo brightness dial" scaleRef={scaleRef} overlayRef={overlayRef}>
      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label="Brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-valuetext={`${shown} percent`}
        data-testid="halo"
        className="hit"
        style={{ left: HALO.cx - HALO.radius, top: HALO.cy - HALO.radius, width: HALO.radius * 2, height: HALO.radius * 2, borderRadius: '50%' }}
        onKeyDown={onKey}
      />
      <p className="readout readout--halo on-glass" aria-hidden="true" style={{ top: HALO.cy - 4 }} data-testid="halo-readout">
        {shown}
        <span>%</span>
      </p>
      <p className="readout readout--label on-glass" aria-hidden="true" style={{ top: HALO.cy + 62 }}>
        Brightness
      </p>
    </GlassStage>
  );
}
