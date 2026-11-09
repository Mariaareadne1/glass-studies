import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { IRIS_STOPS, irisStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { detentAfterRelease, formatStop, IRIS, IrisController, lightAdmitted, stopFromRotation } from './irisController';

const LAST = IRIS_STOPS.length - 1;
const angleOf = (x: number, y: number) => (Math.atan2(y - IRIS.cy, x - IRIS.cx) * 180) / Math.PI;
/** Shortest signed difference between two angles in degrees. */
const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export function IrisDial({ env }: { env: EnvironmentKind }) {
  const stop = useStore(irisStore);
  const [ctrl] = useState(() => new IrisController(irisStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const turn = useRef({ angle: 0, total: 0, from: 0, t: 0, vel: 0 });
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.setStop(stop), [ctrl, stop]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p, e) {
      if (!ctrl.hitDial(p.x, p.y)) return false;
      ctrl.setDragging(true);
      sliderRef.current?.focus({ preventScroll: true });
      turn.current = { angle: angleOf(p.x, p.y), total: 0, from: ctrl.display.x, t: e.timeStamp, vel: 0 };
      ctrl.touch(0.4);
      return true;
    },
    onMove(p, e) {
      const tr = turn.current;
      // the angle is unstable at the very centre
      if (Math.hypot(p.x - IRIS.cx, p.y - IRIS.cy) < 24) return;
      const a = angleOf(p.x, p.y);
      const d = wrapDeg(a - tr.angle);
      const dt = Math.max((e.timeStamp - tr.t) / 1000, 1 / 240);
      tr.vel = tr.vel * 0.6 + (d / dt) * 0.4;
      tr.angle = a;
      tr.t = e.timeStamp;
      tr.total += d;
      const raw = stopFromRotation(tr.from, tr.total);
      ctrl.turnTo(raw);
      irisStore.set(Math.round(Math.min(LAST, Math.max(0, raw))));
    },
    onEnd(_p, cancelled) {
      ctrl.setDragging(false);
      const target = cancelled ? irisStore.get() : detentAfterRelease(ctrl.display.x, turn.current.vel);
      irisStore.set(target);
      ctrl.setStop(target);
      ctrl.touch(0.3);
    },
  });

  // Wheel turns the ring only while it has focus, so page scrolling is never hijacked.
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      irisStore.set((v) => v + Math.sign(e.deltaY || e.deltaX));
      ctrl.touch(0.3);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ctrl]);

  const onKey = (e: KeyboardEvent) => {
    // up/right closes down (higher f-number), like stepping a lens ring
    const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 2, PageDown: -2 };
    let next: number | null = null;
    if (e.key in steps) next = irisStore.get() + steps[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = LAST;
    if (next === null) return;
    e.preventDefault();
    irisStore.set(Math.min(LAST, Math.max(0, next)));
    ctrl.touch(0.3);
  };

  const light = Math.round(lightAdmitted(stop) * 100);
  return (
    <GlassStage controller={ctrl} width={IRIS.W} height={IRIS.H} env={env} label="Iris aperture dial" scaleRef={scaleRef} overlayRef={overlayRef}>
      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label="Aperture"
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={stop}
        aria-valuetext={`${formatStop(stop)}, ${light} percent of the light`}
        data-testid="iris"
        className="hit"
        style={{ left: IRIS.cx - IRIS.ring, top: IRIS.cy - IRIS.ring, width: IRIS.ring * 2, height: IRIS.ring * 2, borderRadius: '50%' }}
        onKeyDown={onKey}
      />
      <div className="readout readout--side" aria-hidden="true" style={{ left: 450, top: 150 }}>
        <span className="readout__eyebrow">Aperture</span>
        <span className="readout__big" data-testid="iris-readout">{formatStop(stop)}</span>
        <span className="readout__meta">{light}% of the light</span>
      </div>
    </GlassStage>
  );
}
