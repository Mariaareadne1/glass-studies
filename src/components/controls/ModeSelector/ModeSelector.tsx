import { useEffect, useRef, useState } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { modeStore, MODES } from '../../../state/controls';
import type { Mode } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { RadioSlots } from '../shared/RadioSlots';
import { SlotLabels } from '../shared/SlotLabels';
import { MODE, MODE_SLOTS, ModeController } from './modeController';

const LABELS: Record<Mode, string> = { nature: 'Nature', energy: 'Energy', rest: 'Rest', bloom: 'Bloom' };
const LINES: Record<Mode, string> = {
  nature: 'A leaf unfurls and bends from its stem.',
  energy: 'The bolt charges; a pulse runs its length.',
  rest: 'A moon rises and stars drift into place.',
  bloom: 'A bud opens, petal by petal.',
};
const INK: Record<Mode, string> = { nature: '#2f8a4c', energy: '#b57a00', rest: '#5b4cd8', bloom: '#c4467d' };

export function ModeSelector({ env }: { env: EnvironmentKind }) {
  const value = useStore(modeStore);
  const [ctrl] = useState(() => new ModeController(modeStore.get()));
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => ctrl.select(value), [ctrl, value]);

  const inks = env === 'midnight' ? undefined : MODES.map((m) => INK[m]);
  return (
    <GlassStage controller={ctrl} width={MODE.W} height={MODE.H} env={env} label="Modes selector" scaleRef={scaleRef} overlayRef={overlayRef}>
      <RadioSlots
        options={MODES}
        labels={LABELS}
        value={value}
        onChange={(m) => modeStore.set(m)}
        core={ctrl.core}
        slotHW={MODE.spacing / 2 - 4}
        slotHH={MODE.trackHH - 4}
        name="Mode"
        testid="modes"
        overlayRef={overlayRef}
        scaleRef={scaleRef}
        invalidate={() => ctrl.wake()}
      />
      <SlotLabels xs={MODE_SLOTS} labels={MODES.map((m) => LABELS[m])} active={MODES.indexOf(value)} top={MODE.cy + MODE.trackHH + 28} colors={inks} />
      <p className="stage-line" aria-live="polite" data-testid="mode-line" style={{ top: MODE.cy + MODE.trackHH + 74 }}>
        {LINES[value]}
      </p>
    </GlassStage>
  );
}
