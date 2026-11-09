import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { driftStore } from '../../../state/controls';
import type { DriftValue } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { DRIFT, DriftController, moodOf } from './driftController';

const same = (a: DriftValue, b: DriftValue) => Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
const round = (v: DriftValue): DriftValue => ({ x: Math.round(v.x), y: Math.round(v.y) });

export function DriftPad({ env }: { env: EnvironmentKind }) {
  const value = useStore(driftStore);
  const [ctrl] = useState(() => new DriftController(driftStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const grab = useRef({ dx: 0, dy: 0 });
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => {
    ctrl.onSettle = (v) => driftStore.set(round(v));
  }, [ctrl]);
  // external changes (keyboard, reset) glide the puck; its own throws already match
  useEffect(() => {
    if (!same(ctrl.value, value)) ctrl.glideTo(value);
  }, [ctrl, value]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (!ctrl.hitPad(p.x, p.y)) return false;
      puckRef.current?.focus({ preventScroll: true });
      // grabbing the puck keeps the offset; pressing the pad pulls the puck to the finger
      const onPuck = ctrl.hitPuck(p.x, p.y);
      grab.current = onPuck ? { dx: ctrl.body.x - p.x, dy: ctrl.body.y - p.y } : { dx: 0, dy: 0 };
      ctrl.beginDrag();
      ctrl.dragTo(p.x + grab.current.dx, p.y + grab.current.dy, 0, 0);
      return true;
    },
    onMove(p) {
      ctrl.dragTo(p.x + grab.current.dx, p.y + grab.current.dy, p.vx, p.vy);
      const v = round(ctrl.value);
      if (!same(v, driftStore.get())) driftStore.set(v);
    },
    onEnd(p, cancelled) {
      ctrl.release(cancelled ? 0 : p.vx, cancelled ? 0 : p.vy);
    },
  });

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    let next: DriftValue | null = null;
    const cur = driftStore.get();
    if (e.key in d) next = { x: cur.x + d[e.key][0], y: cur.y + d[e.key][1] };
    else if (e.key === 'Home') next = { x: 50, y: 50 };
    if (!next) return;
    e.preventDefault();
    driftStore.set({ x: Math.min(100, Math.max(0, next.x)), y: Math.min(100, Math.max(0, next.y)) });
  };

  const mood = moodOf(value);
  const x = Math.round(value.x);
  const y = Math.round(value.y);
  return (
    <GlassStage controller={ctrl} width={DRIFT.W} height={DRIFT.H} env={env} label="Drift two-axis mood pad" scaleRef={scaleRef} overlayRef={overlayRef}>
      <div
        ref={puckRef}
        role="slider"
        tabIndex={0}
        aria-label="Mood: warmth and energy"
        aria-roledescription="two-axis pad"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={x}
        aria-valuetext={`Warmth ${x}, energy ${y}. ${mood.label}`}
        aria-describedby="drift-hint"
        data-testid="drift"
        data-value={`${x},${y}`}
        className="hit"
        style={{ left: DRIFT.cx - DRIFT.padHalf, top: DRIFT.cy - DRIFT.padHalf, width: DRIFT.padHalf * 2, height: DRIFT.padHalf * 2, borderRadius: DRIFT.padRadius }}
        onKeyDown={onKey}
      />
      <span id="drift-hint" className="sr-only">Left and right change warmth, up and down change energy. Home returns to the centre.</span>
      <div className="readout readout--side" aria-hidden="true" style={{ left: 450, top: 140 }}>
        <span className="readout__eyebrow">Mood</span>
        <span className="readout__big readout__big--sm" data-testid="drift-mood">{mood.label}</span>
        <span className="readout__meta">Warmth {x} · Energy {y}</span>
      </div>
      <p className="axis-label axis-label--x" aria-hidden="true" style={{ left: DRIFT.cx - DRIFT.padHalf, top: DRIFT.cy + DRIFT.padHalf + 12, width: DRIFT.padHalf * 2 }}>
        <span>Cool</span>
        <span>Warm</span>
      </p>
    </GlassStage>
  );
}
