import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { driftModeStore, driftStore } from '../../../state/controls';
import type { DriftValue } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { DriftController } from './driftController';
import { directionLabel, DRIFT, strengthPct } from './windMath';

const round2 = (v: DriftValue): DriftValue => ({ x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100 });
const same = (a: DriftValue, b: DriftValue) => Math.abs(a.x - b.x) < 0.005 && Math.abs(a.y - b.y) < 0.005;
const fmt = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;

export function DriftPad({ env }: { env: EnvironmentKind }) {
  const value = useStore(driftStore);
  const mode = useStore(driftModeStore);
  const [ctrl] = useState(() => new DriftController(driftStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const grab = useRef({ dx: 0, dy: 0 });
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.setMode(mode), [ctrl, mode]);
  // external changes (keyboard, reset, spring return) glide the orb; a drag already matches
  useEffect(() => {
    if (!ctrl.dragging && !same(round2(ctrl.value), value)) ctrl.glideTo(value);
  }, [ctrl, value]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (!ctrl.hitPad(p.x, p.y)) return false;
      padRef.current?.focus({ preventScroll: true });
      // grabbing the orb keeps the offset; pressing the pad brings the orb to the finger
      const onPuck = ctrl.hitPuck(p.x, p.y);
      grab.current = onPuck ? { dx: ctrl.x - p.x, dy: ctrl.y - p.y } : { dx: 0, dy: 0 };
      ctrl.beginDrag();
      ctrl.dragTo(p.x + grab.current.dx, p.y + grab.current.dy);
      driftStore.set(round2(ctrl.value));
      return true;
    },
    onMove(p) {
      ctrl.dragTo(p.x + grab.current.dx, p.y + grab.current.dy);
      driftStore.set(round2(ctrl.value));
    },
    onEnd() {
      driftStore.set(round2(ctrl.release()));
    },
  });

  const onKey = (e: KeyboardEvent) => {
    // Shift gives fine steps
    const step = e.shiftKey ? 0.01 : 0.05;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const cur = driftStore.get();
    let next: DriftValue | null = null;
    if (e.key in d) next = { x: cur.x + d[e.key][0], y: cur.y + d[e.key][1] };
    else if (e.key === 'Home') next = { x: 0, y: 0 };
    if (!next) return;
    e.preventDefault();
    driftStore.set(next);
  };

  const label = directionLabel(value);
  const pct = strengthPct(value);
  return (
    <div className="instrument">
      <GlassStage controller={ctrl} width={DRIFT.W} height={DRIFT.H} env={env} label="Drift wind pad" scaleRef={scaleRef} overlayRef={overlayRef}>
        <div
          ref={padRef}
          role="slider"
          tabIndex={0}
          aria-label="Wind: direction and strength"
          aria-roledescription="two-axis pad"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={value.x}
          aria-valuetext={`Direction ${fmt(value.x)} (${label}), strength ${pct} percent`}
          aria-describedby="drift-hint"
          data-testid="drift"
          data-value={`${value.x.toFixed(2)},${value.y.toFixed(2)}`}
          className="hit"
          style={{ left: DRIFT.cx - DRIFT.padHalf, top: DRIFT.cy - DRIFT.padHalf, width: DRIFT.padHalf * 2, height: DRIFT.padHalf * 2, borderRadius: DRIFT.padRadius, touchAction: 'none' }}
          onKeyDown={onKey}
          onDoubleClick={() => driftStore.set({ x: 0, y: 0 })}
        />
        <span id="drift-hint" className="sr-only">
          Left and right set the wind direction, up and down its strength. Shift for fine steps, Home or double-click to centre.
        </span>
        <div className="readout readout--side" aria-hidden="true" style={{ left: 450, top: 132 }}>
          <span className="readout__eyebrow">Wind</span>
          <span className="readout__big readout__big--sm" data-testid="drift-label">{label}</span>
          <span className="readout__meta">Strength {pct}%</span>
          <span className="readout__meta readout__meta--fine">dir {fmt(value.x)} · str {fmt(value.y)}</span>
        </div>
        <p className="axis-label axis-label--x" aria-hidden="true" style={{ left: DRIFT.cx - DRIFT.padHalf, top: DRIFT.cy + DRIFT.padHalf + 12, width: DRIFT.padHalf * 2 }}>
          <span>West</span>
          <span>East</span>
        </p>
        <div className="chip-row chip-row--stage" role="radiogroup" aria-label="On release" style={{ left: 450, top: 290 }}>
          <button type="button" role="radio" className="chip" aria-checked={mode === 'hold'} onClick={() => driftModeStore.set('hold')}>
            Hold
          </button>
          <button type="button" role="radio" className="chip" aria-checked={mode === 'spring'} onClick={() => driftModeStore.set('spring')}>
            Spring back
          </button>
        </div>
      </GlassStage>
    </div>
  );
}
