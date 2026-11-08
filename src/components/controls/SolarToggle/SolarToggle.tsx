import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { solarStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { SOLAR, SolarController } from './solarController';

const TAP_SLOP = 6;

export function SolarToggle({ env }: { env: EnvironmentKind }) {
  const on = useStore(solarStore);
  const [ctrl] = useState(() => new SolarController(solarStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const press = useRef<{ x: number; mode: 'thumb' | 'track'; moved: boolean } | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.setOn(on), [ctrl, on]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (ctrl.hitThumb(p.x, p.y)) {
        press.current = { x: p.x, mode: 'thumb', moved: false };
        ctrl.beginDrag(p.x);
        return true;
      }
      if (ctrl.hitTrack(p.x, p.y)) {
        press.current = { x: p.x, mode: 'track', moved: false };
        return true;
      }
      return false;
    },
    onMove(p) {
      const pr = press.current;
      if (!pr) return;
      if (Math.abs(p.x - pr.x) > TAP_SLOP) pr.moved = true;
      if (pr.mode === 'thumb') ctrl.drag(p.x, p.vx);
    },
    onEnd(p, cancelled) {
      const pr = press.current;
      press.current = null;
      if (!pr) return;
      if (pr.mode === 'thumb') {
        if (cancelled) {
          ctrl.endDrag(0);
          ctrl.setOn(solarStore.get());
          return;
        }
        if (!pr.moved) {
          ctrl.endDrag(0);
          solarStore.set(!solarStore.get());
          ctrl.setOn(solarStore.get());
          return;
        }
        solarStore.set(ctrl.endDrag(p.vx));
        ctrl.setOn(solarStore.get());
        return;
      }
      if (!cancelled && !pr.moved) solarStore.set(p.x >= SOLAR.cx);
    },
  });

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, boolean> = { ArrowLeft: false, ArrowDown: false, Home: false, ArrowRight: true, ArrowUp: true, End: true };
    if (e.key in map) {
      e.preventDefault();
      solarStore.set(map[e.key]);
    }
  };
  // Pointer presses are handled by the drag layer; only keyboard-initiated clicks (detail 0) toggle here.
  const onClick = (e: MouseEvent) => {
    if (e.detail === 0) solarStore.set(!solarStore.get());
  };

  return (
    <GlassStage controller={ctrl} width={SOLAR.W} height={SOLAR.H} env={env} label="Solar day and night toggle" scaleRef={scaleRef} overlayRef={overlayRef}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Daylight"
        className="hit hit--pill"
        data-testid="solar-switch"
        data-state={on ? 'day' : 'night'}
        style={{ left: SOLAR.cx - SOLAR.trackHW, top: SOLAR.cy - SOLAR.trackHH, width: SOLAR.trackHW * 2, height: SOLAR.trackHH * 2, borderRadius: SOLAR.trackHH }}
        onKeyDown={onKey}
        onClick={onClick}
      />
      <p className="stage-caption" aria-hidden="true" style={{ top: SOLAR.cy + SOLAR.trackHH + 34 }}>
        <span className={on ? '' : 'is-active'}>Night</span>
        <span className={on ? 'is-active' : ''}>Day</span>
      </p>
    </GlassStage>
  );
}
