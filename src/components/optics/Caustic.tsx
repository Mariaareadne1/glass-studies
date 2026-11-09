import { useRef, useSyncExternalStore } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { EnvironmentKind } from '../../glass/types';
import { LoaderStage } from '../loaders/LoaderStage';
import { useLoaderOption } from '../loaders/useLoaderOption';
import { LOADER } from '../loaders/loopController';
import { CausticController } from './causticController';

function CausticOptions({ ctrl }: { ctrl: CausticController }) {
  const [shape, setShape] = useLoaderOption(ctrl, () => ctrl.shape, (s) => ctrl.setShape(s));
  const [look, setLook] = useLoaderOption(ctrl, () => ctrl.look, (l) => ctrl.setLook(l));
  const mode = useSyncExternalStore((l) => ctrl.subscribe(l), () => ctrl.lightMode);
  return (
    <div className="transport__row">
      <div className="chip-row" role="radiogroup" aria-label="Lens geometry">
        {(['sphere', 'capsule'] as const).map((s) => (
          <button key={s} type="button" role="radio" className="chip" aria-checked={shape === s} onClick={() => setShape(s)}>
            {s === 'sphere' ? 'Sphere' : 'Capsule'}
          </button>
        ))}
      </div>
      <div className="chip-row" role="radiogroup" aria-label="Presentation">
        <button type="button" role="radio" className="chip" aria-checked={look === 'muted'} onClick={() => setLook('muted')}>
          Muted
        </button>
        <button type="button" role="radio" className="chip" aria-checked={look === 'contrast'} onClick={() => setLook('contrast')}>
          High contrast
        </button>
      </div>
      {mode === 'hand' && (
        <button type="button" className="chip" onClick={() => ctrl.resumeOrbit()}>
          Resume orbit
        </button>
      )}
    </div>
  );
}

/** The light handle: drag it (it stays outside the glass) or move it with the arrow keys. */
function LightHandle({ ctrl }: { ctrl: CausticController }) {
  useSyncExternalStore((l) => ctrl.subscribe(l), () => ctrl.lightMode);
  const dragging = useRef(false);
  const toDesign = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * LOADER.W, y: ((e.clientY - r.top) / r.height) * LOADER.H };
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 2 : 10;
    const l = ctrl.light;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!(e.key in d)) return;
    e.preventDefault();
    ctrl.placeLight(l.x + d[e.key][0], l.y + d[e.key][1]);
  };
  const l = ctrl.light;
  return (
    <>
      <div
        aria-hidden="true"
        className="hit"
        data-testid="caustic-surface"
        style={{ left: 0, top: 0, width: LOADER.W, height: LOADER.H, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={(e) => {
          const p = toDesign(e);
          if (!ctrl.hitHandle(p.x, p.y)) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          ctrl.placeLight(p.x, p.y);
        }}
        onPointerMove={(e) => dragging.current && ctrl.placeLight(toDesign(e).x, toDesign(e).y)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onLostPointerCapture={() => (dragging.current = false)}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Light position"
        aria-valuemin={0}
        aria-valuemax={LOADER.W}
        aria-valuenow={Math.round(l.x)}
        aria-valuetext={`Light at ${Math.round(l.x)}, ${Math.round(l.y)}${ctrl.lightMode === 'orbit' ? ', orbiting' : ''}`}
        data-testid="caustic-light"
        data-x={l.x.toFixed(1)}
        data-y={l.y.toFixed(1)}
        className="hit"
        style={{ left: l.x - 22, top: l.y - 22, width: 44, height: 44, borderRadius: '50%', pointerEvents: 'none' }}
        onKeyDown={onKey}
      />
    </>
  );
}

export function Caustic({ env }: { env: EnvironmentKind }) {
  return (
    <LoaderStage
      env={env}
      create={() => new CausticController()}
      label="Caustic study"
      testid="caustic"
      extra={(c) => <CausticOptions ctrl={c} />}
      overlay={(c) => <LightHandle ctrl={c} />}
    />
  );
}
