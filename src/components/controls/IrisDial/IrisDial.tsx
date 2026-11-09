import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { RotaryTracker } from '../../../motion/rotary';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { IRIS_STOPS, irisStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { detentAfterRelease, formatStop, IRIS, IrisController, lightAdmitted, stopFromRotation, tickAt } from './irisController';

const LAST = IRIS_STOPS.length - 1;

export function IrisDial({ env }: { env: EnvironmentKind }) {
  const stop = useStore(irisStore);
  const [ctrl] = useState(() => new IrisController(irisStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const rotary = useRef(new RotaryTracker(IRIS.cx, IRIS.cy));
  const turn = useRef({ from: 0, tick: null as number | null });
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.setStop(stop), [ctrl, stop]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p, e) {
      if (!ctrl.hitDial(p.x, p.y)) return false;
      ctrl.setDragging(true);
      sliderRef.current?.focus({ preventScroll: true });
      rotary.current.begin(p.x, p.y, e.timeStamp);
      turn.current = { from: ctrl.display.x, tick: tickAt(p.x, p.y, ctrl.display.x) };
      ctrl.touch(0.4);
      return true;
    },
    onMove(p, e) {
      const total = rotary.current.move(p.x, p.y, e.timeStamp);
      const raw = stopFromRotation(turn.current.from, total);
      ctrl.turnTo(raw);
      irisStore.set(Math.round(Math.min(LAST, Math.max(0, raw))));
    },
    onEnd(_p, cancelled) {
      ctrl.setDragging(false);
      const tr = turn.current;
      // a click (no real turn) on a printed number selects that stop
      const rt = rotary.current;
      const clicked = !cancelled && Math.abs(rt.total) < 2 && tr.tick !== null ? tr.tick : null;
      const target = cancelled ? irisStore.get() : clicked ?? detentAfterRelease(ctrl.display.x, rt.velocity);
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
        aria-valuetext={`${formatStop(stop)}, about ${light} percent of the light at f/1.8`}
        data-testid="iris"
        className="hit"
        style={{ left: IRIS.cx - IRIS.ring, top: IRIS.cy - IRIS.ring, width: IRIS.ring * 2, height: IRIS.ring * 2, borderRadius: '50%' }}
        onKeyDown={onKey}
      />
      <div className="readout readout--side" aria-hidden="true" style={{ left: 450, top: 150 }}>
        <span className="readout__eyebrow">Aperture</span>
        <span className="readout__big" data-testid="iris-readout">{formatStop(stop)}</span>
        <span className="readout__meta">≈ {light}% of f/1.8 light</span>
        <span className="readout__meta readout__meta--fine">Area ∝ 1/N² · not a meter</span>
      </div>
    </GlassStage>
  );
}
