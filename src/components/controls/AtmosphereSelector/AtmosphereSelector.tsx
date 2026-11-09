import { useEffect, useRef, useState } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { atmosphereStore, WEATHER } from '../../../state/controls';
import type { Weather } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { RadioSlots } from '../shared/RadioSlots';
import { SlotLabels } from '../shared/SlotLabels';
import { ATMO, ATMO_SLOTS, AtmosphereController } from './atmosphereController';

const LABELS: Record<Weather, string> = { sun: 'Sun', rain: 'Rain', wind: 'Wind', snow: 'Snow' };

export function AtmosphereSelector({ env }: { env: EnvironmentKind }) {
  const value = useStore(atmosphereStore);
  const [ctrl] = useState(() => new AtmosphereController(atmosphereStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.select(value), [ctrl, value]);

  return (
    <GlassStage controller={ctrl} width={ATMO.W} height={ATMO.H} env={env} label="Atmosphere weather selector" scaleRef={scaleRef} overlayRef={overlayRef}>
      <RadioSlots
        options={WEATHER}
        labels={LABELS}
        value={value}
        onChange={(w) => atmosphereStore.set(w)}
        core={ctrl.core}
        slotHW={ATMO.spacing / 2 - 4}
        slotHH={ATMO.trackHH - 4}
        slotRadius={ATMO.trackRadius - 4}
        name="Weather"
        testid="atmosphere"
        overlayRef={overlayRef}
        scaleRef={scaleRef}
        invalidate={() => ctrl.wake()}
      />
      <SlotLabels xs={ATMO_SLOTS} labels={WEATHER.map((w) => LABELS[w])} active={WEATHER.indexOf(value)} top={ATMO.cy + ATMO.trackHH + 30} />
      <p className="sr-only" aria-live="polite">
        Selected weather: {LABELS[value]}
      </p>
    </GlassStage>
  );
}
