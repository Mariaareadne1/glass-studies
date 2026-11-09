import type { EnvironmentKind } from '../../glass/types';
import { LoaderStage } from '../loaders/LoaderStage';
import { LOADER } from '../loaders/loopController';
import { STITCH, StitchController } from './stitchController';

/** Clicking a fragment's seat highlights it (a preview of its path); the sequence is untouched. */
function FragmentPicker({ ctrl }: { ctrl: StitchController }) {
  const q = STITCH.half / 2;
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const sx = i % 2 ? 1 : -1;
        const sy = i < 2 ? -1 : 1;
        return (
          <button
            key={i}
            type="button"
            className="hit"
            aria-label={`Highlight fragment ${i + 1}`}
            data-testid={`stitch-fragment-${i}`}
            style={{ left: LOADER.cx + sx * q - q, top: LOADER.cy + sy * q - q, width: q * 2, height: q * 2, borderRadius: 12, background: 'transparent', border: 0 }}
            onPointerEnter={() => ctrl.setPreview(i)}
            onPointerLeave={() => ctrl.setPreview(null)}
            onFocus={() => ctrl.setPreview(i)}
            onBlur={() => ctrl.setPreview(null)}
          />
        );
      })}
    </>
  );
}

export function GlassStitch({ env }: { env: EnvironmentKind }) {
  return <LoaderStage env={env} create={() => new StitchController()} label="Glass Stitch" testid="stitch" overlay={(c) => <FragmentPicker ctrl={c} />} />;
}
