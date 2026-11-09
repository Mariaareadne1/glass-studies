import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { RANGE_GAP, RANGE_MAX, RANGE_MIN, RANGE_STEP, rangeStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { hourToX, RANGE, RangeController, xToHour } from './rangeController';
import { formatHour, formatSpan, moveBead, nearestBead, snapHour } from './rangeMath';
import type { BeadId } from './rangeMath';

export function RangeBeads({ env }: { env: EnvironmentKind }) {
  const range = useStore(rangeStore);
  const [ctrl] = useState(() => new RangeController(rangeStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const refs = { start: useRef<HTMLDivElement>(null), end: useRef<HTMLDivElement>(null) };
  const scaleRef = useRef(1);
  const grab = useRef(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.setRange(range), [ctrl, range]);

  const commit = (id: BeadId, hour: number) => {
    const cur = rangeStore.get();
    const next = moveBead(cur, id, snapHour(hour));
    if (next.start !== cur.start || next.end !== cur.end) rangeStore.set(next);
  };

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (!ctrl.hitTrack(p.x, p.y)) return false;
      const id = nearestBead(rangeStore.get(), xToHour(p.x));
      ctrl.dragging = id;
      // grabbing a bead keeps the offset under the finger; a press on the track pulls it there
      const dx = p.x - ctrl.beadX(id);
      grab.current = Math.abs(dx) <= RANGE.bead + 6 ? dx : 0;
      refs[id].current?.focus({ preventScroll: true });
      ctrl.touch(0.4);
      onDrag(id, p.x);
      return true;
    },
    onMove(p) {
      if (ctrl.dragging) onDrag(ctrl.dragging, p.x);
    },
    onEnd() {
      ctrl.dragging = null;
      ctrl.setRange(rangeStore.get());
      ctrl.touch(0.3);
    },
  });

  function onDrag(id: BeadId, x: number) {
    // continuous under the hand, clamped against the other bead; the store keeps half hours
    const hour = moveBead(rangeStore.get(), id, xToHour(x - grab.current))[id];
    ctrl.dragBead(id, hour);
    commit(id, hour);
  }

  const onKey = (id: BeadId) => (e: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: RANGE_STEP, ArrowUp: RANGE_STEP, ArrowLeft: -RANGE_STEP, ArrowDown: -RANGE_STEP, PageUp: 2, PageDown: -2 };
    const cur = rangeStore.get()[id];
    let next: number | null = null;
    if (e.key in steps) next = cur + steps[e.key];
    else if (e.key === 'Home') next = RANGE_MIN;
    else if (e.key === 'End') next = RANGE_MAX;
    if (next === null) return;
    e.preventDefault();
    commit(id, next);
    ctrl.touch(0.3);
  };

  const bead = (id: BeadId, label: string, min: number, max: number) => {
    const x = id === 'start' ? range.start : range.end;
    const left = hourToX(x);
    return (
      <div
        ref={refs[id]}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={x}
        aria-valuetext={formatHour(x)}
        data-testid={`beads-${id}`}
        className="hit"
        style={{ left: left - RANGE.bead - 4, top: RANGE.cy - RANGE.bead - 4, width: (RANGE.bead + 4) * 2, height: (RANGE.bead + 4) * 2, borderRadius: '50%' }}
        onKeyDown={onKey(id)}
      />
    );
  };

  return (
    <GlassStage controller={ctrl} width={RANGE.W} height={RANGE.H} env={env} label="Active hours range" scaleRef={scaleRef} overlayRef={overlayRef}>
      <div role="group" aria-label="Active hours" data-testid="beads" data-value={`${range.start}-${range.end}`}>
        {bead('start', 'Start of active hours', RANGE_MIN, range.end - RANGE_GAP)}
        {bead('end', 'End of active hours', range.start + RANGE_GAP, RANGE_MAX)}
      </div>
      <div className="readout readout--center" aria-hidden="true" style={{ top: 96 }}>
        <span className="readout__eyebrow">Active hours</span>
        <span className="readout__big" data-testid="beads-readout">
          {formatHour(range.start)} – {formatHour(range.end)}
        </span>
        <span className="readout__meta">{formatSpan(range)} window</span>
      </div>
    </GlassStage>
  );
}
