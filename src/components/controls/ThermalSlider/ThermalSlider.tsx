import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { THERMAL_MAX, THERMAL_MIN, THERMAL_STEP, thermalStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { iconForTemp, snapTemp, THERMAL, ThermalController } from './thermalController';

const CONDITION = { snow: 'Frost', partly: 'Mild · cloud', sun: 'Warm · sun' } as const;

export function formatTemp(t: number): string {
  return Number.isInteger(t) ? `${t}` : t.toFixed(1);
}

export function ThermalSlider({ env }: { env: EnvironmentKind }) {
  const value = useStore(thermalStore);
  const [ctrl] = useState(() => new ThermalController(thermalStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.setValue(value), [ctrl, value]);

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      const onThumb = ctrl.hitThumb(p.x, p.y);
      if (!onThumb && !ctrl.hitTrack(p.x, p.y)) return false;
      sliderRef.current?.focus({ preventScroll: true });
      thermalStore.set(snapTemp(ctrl.beginDrag(p.y, onThumb)));
      return true;
    },
    onMove(p) {
      thermalStore.set(snapTemp(ctrl.drag(p.y)));
    },
    onEnd() {
      ctrl.endDrag();
      ctrl.setValue(thermalStore.get());
    },
  });

  const onKey = (e: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowUp: THERMAL_STEP, ArrowRight: THERMAL_STEP, ArrowDown: -THERMAL_STEP, ArrowLeft: -THERMAL_STEP, PageUp: 5, PageDown: -5 };
    let next: number | null = null;
    if (e.key in steps) next = thermalStore.get() + steps[e.key];
    else if (e.key === 'Home') next = THERMAL_MIN;
    else if (e.key === 'End') next = THERMAL_MAX;
    if (next === null) return;
    e.preventDefault();
    thermalStore.set(snapTemp(next));
  };

  const text = formatTemp(value);
  return (
    <GlassStage controller={ctrl} width={THERMAL.W} height={THERMAL.H} env={env} label="Thermal temperature slider" scaleRef={scaleRef} overlayRef={overlayRef}>
      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label="Temperature"
        aria-orientation="vertical"
        aria-valuemin={THERMAL_MIN}
        aria-valuemax={THERMAL_MAX}
        aria-valuenow={value}
        aria-valuetext={`${text} degrees Celsius`}
        data-testid="thermal"
        className="hit"
        style={{ left: THERMAL.trackX - THERMAL.trackHW, top: THERMAL.cy - THERMAL.trackHH, width: THERMAL.trackHW * 2, height: THERMAL.trackHH * 2, borderRadius: THERMAL.trackRadius }}
        onKeyDown={onKey}
      />
      <div className="readout thermal-card on-glass" aria-hidden="true" style={{ left: THERMAL.cardX - 18, top: THERMAL.cy - 52 }}>
        <span className="thermal-card__label">Set point</span>
        <span className="thermal-card__value" data-testid="thermal-readout">
          {text}
          <small>°C</small>
        </span>
        <span className="thermal-card__cond">{CONDITION[iconForTemp(value)]}</span>
      </div>
      <p className="readout readout--label thermal-note" aria-hidden="true" style={{ top: THERMAL.cy + THERMAL.trackHH + 22, left: THERMAL.trackX - 80, right: 'auto', width: 160 }}>
        Demo range
      </p>
    </GlassStage>
  );
}
