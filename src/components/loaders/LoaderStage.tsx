import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useIsFocused } from '../../app/presentation';
import { GlassStage } from '../../glass/GlassStage';
import type { EnvironmentKind } from '../../glass/types';
import { useReducedMotion } from '../../state/reducedMotion';
import { LoaderTransport, PauseToggle } from './LoaderTransport';
import { LOADER } from './loopController';
import type { LoopController } from './loopController';

interface LoaderStageProps<C extends LoopController> {
  env: EnvironmentKind;
  create: () => C;
  label: string;
  testid: string;
  /** Extra focused-view controls (icon choice, geometry switch…). */
  extra?: (ctrl: C) => ReactNode;
  /** Overlay content inside the stage (completion marks, readouts). */
  overlay?: (ctrl: C) => ReactNode;
}

/**
 * A loader stage. Indeterminate loaders announce "Loading"; determinate ones
 * expose a progressbar whose value is the supplied fraction, never a timer.
 */
export function LoaderStage<C extends LoopController>({ env, create, label, testid, extra, overlay }: LoaderStageProps<C>) {
  const [ctrl] = useState(create);
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const t = useSyncExternalStore((l) => ctrl.subscribe(l), () => ctrl.transport);
  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  const determinate = t.mode === 'progress';
  const pct = Math.round(t.progress * 100);
  return (
    <div className="loader-stage">
      <GlassStage controller={ctrl} width={LOADER.W} height={LOADER.H} env={env} label={label}>
        {determinate ? (
          <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="sr-only" data-testid={testid} data-progress={pct}>
            {pct >= 100 ? 'Complete' : `${pct}%`}
          </div>
        ) : (
          <p role="status" className="sr-only" data-testid={testid} data-playing={t.playing}>
            {t.playing ? 'Loading' : 'Loading, paused'}
          </p>
        )}
        {overlay?.(ctrl)}
      </GlassStage>
      {!focused && <PauseToggle ctrl={ctrl} title={label} />}
      {focused && <LoaderTransport ctrl={ctrl} title={label}>{extra?.(ctrl)}</LoaderTransport>}
    </div>
  );
}
