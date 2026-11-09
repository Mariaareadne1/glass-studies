import { useEffect, useState } from 'react';
import { GlassStage } from '../../glass/GlassStage';
import type { EnvironmentKind } from '../../glass/types';
import { useReducedMotion } from '../../state/reducedMotion';
import { LOADER } from './loopController';
import type { LoopController } from './loopController';

interface LoaderStageProps {
  env: EnvironmentKind;
  create: () => LoopController;
  label: string;
  testid: string;
}

/** A loader stage: a live region announcing "Loading" for assistive technology; the glass is decorative. */
export function LoaderStage({ env, create, label, testid }: LoaderStageProps) {
  const [ctrl] = useState(create);
  const reducedMotion = useReducedMotion();
  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  return (
    <GlassStage controller={ctrl} width={LOADER.W} height={LOADER.H} env={env} label={label}>
      <p role="status" className="sr-only" data-testid={testid}>
        Loading
      </p>
    </GlassStage>
  );
}
