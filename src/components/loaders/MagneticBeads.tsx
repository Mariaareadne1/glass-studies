import { useRef, useSyncExternalStore } from 'react';
import type { PointerEvent } from 'react';
import type { EnvironmentKind } from '../../glass/types';
import { LoaderStage } from './LoaderStage';
import { LOADER } from './loopController';
import { MAG } from './magnetSim';
import { MagneticLoader } from './magneticLoader';

function MagnetOptions({ ctrl }: { ctrl: MagneticLoader }) {
  const state = useSyncExternalStore(
    (l) => ctrl.subscribe(l),
    () => `${ctrl.polarity}|${ctrl.sim.strength}|${ctrl.completeState}`,
  );
  const [pol, strength, complete] = state.split('|');
  return (
    <>
      <div className="transport__row">
        <button type="button" className="chip" onClick={() => ctrl.togglePolarity()} data-testid="magnet-polarity">
          Polarity {Number(pol) > 0 ? '+' : '−'}
        </button>
        <button type="button" className="chip" aria-pressed={complete === 'true'} onClick={() => ctrl.setComplete(complete !== 'true')} data-testid="magnet-complete">
          {complete === 'true' ? 'Release' : 'Complete'}
        </button>
      </div>
      <label className="transport__progress">
        <span>Force strength</span>
        <input type="range" min={20} max={200} step={5} value={Math.round(Number(strength) * 100)} onChange={(e) => ctrl.setStrength(Number(e.target.value) / 100)} data-testid="magnet-strength" />
        <output>{Number(strength).toFixed(2)}×</output>
      </label>
    </>
  );
}

/** Press anywhere in the track to hold a magnet there; it follows the hand until release. */
function MagnetHand({ ctrl }: { ctrl: MagneticLoader }) {
  const dragging = useRef(false);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: MAG.cx - MAG.trackHW + ((e.clientX - r.left) / r.width) * MAG.trackHW * 2, y: MAG.cy - MAG.trackHH + ((e.clientY - r.top) / r.height) * MAG.trackHH * 2 };
  };
  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    ctrl.releaseMagnet();
  };
  return (
    <div
      aria-hidden="true"
      className="hit"
      data-testid="magnet-track"
      style={{ left: MAG.cx - MAG.trackHW, top: MAG.cy - MAG.trackHH, width: MAG.trackHW * 2, height: MAG.trackHH * 2, borderRadius: MAG.trackRadius, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = at(e);
        ctrl.grabMagnet(p.x, p.y);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const p = at(e);
        ctrl.grabMagnet(p.x, p.y);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}

export function MagneticBeads({ env }: { env: EnvironmentKind }) {
  return (
    <LoaderStage
      env={env}
      create={() => new MagneticLoader()}
      label="Magnetic Beads loader"
      testid="loader-magnet"
      extra={(c) => <MagnetOptions ctrl={c} />}
      overlay={(c) => (
        <>
          <MagnetHand ctrl={c} />
          <p className="stage-caption" style={{ top: LOADER.cy + MAG.trackHH + 40 }}>
            Press the track to hold a magnet
          </p>
        </>
      )}
    />
  );
}
