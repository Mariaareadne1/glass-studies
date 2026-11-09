import { useRef, useSyncExternalStore } from 'react';
import type { PointerEvent } from 'react';
import type { EnvironmentKind } from '../../glass/types';
import { LoaderStage } from '../loaders/LoaderStage';
import { useLoaderOption } from '../loaders/useLoaderOption';
import { LensScanController, SCAN, SCAN_CONTENTS } from './lensScanController';

function ContentPicker({ ctrl }: { ctrl: LensScanController }) {
  const [content, setContent] = useLoaderOption(ctrl, () => ctrl.content, (c) => ctrl.setContent(c));
  return (
    <div className="transport__row">
      <div className="chip-row" role="radiogroup" aria-label="Sheet under the lens">
        {SCAN_CONTENTS.map((c) => (
          <button key={c.id} type="button" role="radio" className="chip" aria-checked={content === c.id} onClick={() => setContent(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pointer layer over the track: pressing places the lens (a manual, clearly determinate demo). */
function TrackOverlay({ ctrl }: { ctrl: LensScanController }) {
  const t = useSyncExternalStore((l) => ctrl.subscribe(l), () => ctrl.transport);
  const dragging = useRef(false);
  const place = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - r.left) / r.width;
    if (ctrl.transport.mode !== 'progress') ctrl.setMode('progress');
    ctrl.setProgress(p);
  };
  const done = t.mode === 'progress' && t.progress >= 1;
  return (
    <>
      <div
        aria-hidden="true"
        className="hit lens-track"
        data-testid="lens-track"
        style={{ left: SCAN.x0, top: SCAN.sheet.y, width: SCAN.x1 - SCAN.x0, height: SCAN.sheet.h, cursor: 'ew-resize', touchAction: 'none' }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          place(e);
        }}
        onPointerMove={(e) => dragging.current && place(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onLostPointerCapture={() => (dragging.current = false)}
      />
      <p className="stage-caption" style={{ top: SCAN.sheet.y + SCAN.sheet.h + 34 }} data-testid="lens-caption">
        {done ? '✓ Scan complete' : t.mode === 'progress' ? 'Lens follows the supplied progress' : 'Scanning · indeterminate'}
      </p>
    </>
  );
}

export function LensScan({ env }: { env: EnvironmentKind }) {
  return (
    <LoaderStage
      env={env}
      create={() => new LensScanController()}
      label="Lens Scan"
      testid="lens-scan"
      extra={(c) => <ContentPicker ctrl={c} />}
      overlay={(c) => <TrackOverlay ctrl={c} />}
    />
  );
}
