import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { SPEEDS } from './loopController';
import type { LoopController } from './loopController';

const useTransport = (ctrl: LoopController) =>
  useSyncExternalStore(
    (l) => ctrl.subscribe(l),
    () => ctrl.transport,
  );

/** Compact pause / play toggle shown on gallery cards (WCAG 2.2.2: moving content can be paused). */
export function PauseToggle({ ctrl, title }: { ctrl: LoopController; title: string }) {
  const t = useTransport(ctrl);
  return (
    <button
      type="button"
      className="plinth__pause"
      aria-label={`${t.playing ? 'Pause' : 'Play'} ${title}`}
      aria-pressed={!t.playing}
      onClick={() => ctrl.setPlaying(!t.playing)}
    >
      {t.playing ? (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2v8M8.5 2v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6L9.8 6z" fill="currentColor" /></svg>
      )}
    </button>
  );
}

interface TransportProps {
  ctrl: LoopController;
  title: string;
  /** Label for the determinate slider; it always says it is a simulation unless a real task drives it. */
  progressLabel?: string;
  children?: ReactNode;
}

/**
 * Focused-view controls for a loader: play / pause, restart, speed and, for
 * determinate loaders, a clearly labelled manual progress control. The loop
 * itself never displays a percentage.
 */
export function LoaderTransport({ ctrl, title, progressLabel = 'Simulated progress', children }: TransportProps) {
  const t = useTransport(ctrl);
  const pct = Math.round(t.progress * 100);
  return (
    <div className="transport" role="group" aria-label={`${title} controls`}>
      <div className="transport__row">
        <button type="button" className="chip" aria-pressed={!t.playing} onClick={() => ctrl.setPlaying(!t.playing)} data-testid="transport-play">
          {t.playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="chip" onClick={() => ctrl.restart()} data-testid="transport-restart">
          Restart
        </button>
        <div className="chip-row" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" className="chip" aria-checked={t.speed === s} onClick={() => ctrl.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        {ctrl.supportsProgress && (
          <div className="chip-row" role="radiogroup" aria-label="Mode">
            <button type="button" role="radio" className="chip" aria-checked={t.mode === 'loop'} onClick={() => ctrl.setMode('loop')}>
              Indeterminate
            </button>
            <button type="button" role="radio" className="chip" aria-checked={t.mode === 'progress'} onClick={() => ctrl.setMode('progress')} data-testid="transport-progress-mode">
              Determinate
            </button>
          </div>
        )}
      </div>
      {ctrl.supportsProgress && t.mode === 'progress' && (
        <label className="transport__progress">
          <span>{progressLabel}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => ctrl.setProgress(Number(e.target.value) / 100)}
            data-testid="transport-progress"
          />
          <output>{pct}%</output>
        </label>
      )}
      {children}
    </div>
  );
}
