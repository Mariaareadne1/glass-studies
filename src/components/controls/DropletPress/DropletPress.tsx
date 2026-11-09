import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { GlassStage } from '../../../glass/GlassStage';
import type { EnvironmentKind } from '../../../glass/types';
import { usePointerDrag } from '../../../motion/usePointerDrag';
import { dropletStore } from '../../../state/controls';
import { useStore } from '../../../state/persistence';
import { useReducedMotion } from '../../../state/reducedMotion';
import { DROP, DropletController } from './dropletController';

const HOLD_KEYS = new Set([' ', 'Enter']);

export function DropletPress({ env }: { env: EnvironmentKind }) {
  const count = useStore(dropletStore);
  const [ctrl] = useState(() => new DropletController());
  const [status, setStatus] = useState<'ready' | 'holding' | 'released'>('ready');
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scaleRef = useRef(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => ctrl.setReducedMotion(reducedMotion), [ctrl, reducedMotion]);
  useEffect(() => {
    ctrl.onConfirm = () => {
      dropletStore.set((n) => n + 1);
      setStatus('released');
    };
  }, [ctrl]);
  // the status line returns to its prompt once the gesture has fully rested
  useEffect(() => {
    if (status !== 'released') return;
    const id = window.setTimeout(() => setStatus('ready'), (ctrl.hold.restSeconds + 0.4) * 1000);
    return () => window.clearTimeout(id);
  }, [ctrl, status]);

  const start = () => {
    ctrl.press();
    if (ctrl.hold.phase === 'holding') setStatus('holding');
  };
  const stop = () => {
    ctrl.release();
    setStatus((s) => (s === 'holding' ? 'ready' : s));
  };

  usePointerDrag(overlayRef, scaleRef, {
    onStart(p) {
      if (!ctrl.hitDrop(p.x, p.y)) return false;
      buttonRef.current?.focus({ preventScroll: true });
      start();
      return true;
    },
    onMove() {},
    onEnd() {
      stop();
    },
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    stop();
  };

  const line = status === 'released' ? 'Released' : status === 'holding' ? 'Keep holding…' : 'Press and hold';
  return (
    <GlassStage controller={ctrl} width={DROP.W} height={DROP.H} env={env} label="Droplet press-and-hold button" scaleRef={scaleRef} overlayRef={overlayRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Release a drop"
        aria-describedby="droplet-hint"
        data-testid="droplet"
        data-state={status}
        className="hit"
        style={{ left: DROP.cx - DROP.r - 14, top: DROP.cy - DROP.r - 14, width: (DROP.r + 14) * 2, height: (DROP.r + 14) * 2, borderRadius: '50%' }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={stop}
        onContextMenu={(e) => e.preventDefault()}
      />
      <p className="stage-caption stage-caption--stack" style={{ top: DROP.dishY + 50 }}>
        <span id="droplet-hint" className="is-active">{line}</span>
        <span data-testid="droplet-count">{count === 1 ? '1 drop released' : `${count} drops released`}</span>
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {status === 'released' ? `Drop released. ${count} in total.` : ''}
      </p>
    </GlassStage>
  );
}
