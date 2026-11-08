import { useState } from 'react';
import { setTuning, tuning, TUNING_DEFAULTS } from '../../glass/tuning';
import type { Tuning } from '../../glass/tuning';

const ROWS: { key: keyof Tuning; label: string; max: number }[] = [
  { key: 'refraction', label: 'Refraction', max: 3 },
  { key: 'bevel', label: 'Bevel width', max: 2.5 },
  { key: 'thickness', label: 'Thickness', max: 3 },
  { key: 'frost', label: 'Frost', max: 4 },
  { key: 'aberration', label: 'Chromatic aberration', max: 4 },
  { key: 'specular', label: 'Specular', max: 3 },
  { key: 'milk', label: 'Rim milkiness (edge thickness)', max: 2.5 },
  { key: 'bloom', label: 'Bloom / halo', max: 3 },
  { key: 'edgeLight', label: 'Edge light', max: 3 },
  { key: 'shadowSoftness', label: 'Shadow softness', max: 3 },
  { key: 'stiffness', label: 'Spring stiffness', max: 3 },
  { key: 'damping', label: 'Spring damping', max: 3 },
  { key: 'deformation', label: 'Deformation', max: 3 },
];

/** Development-only material inspector. Edits the live renderer multipliers. */
export default function Inspector() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  if (!open) {
    return (
      <button type="button" className="inspector chip" style={{ width: 'auto' }} onClick={() => setOpen(true)}>
        Material inspector
      </button>
    );
  }
  return (
    <aside className="inspector" aria-label="Material inspector">
      <h2>Material inspector (dev)</h2>
      {ROWS.map((r) => (
        <label key={r.key}>
          <span>{r.label}</span>
          <output>{tuning[r.key].toFixed(2)}</output>
          <input
            type="range"
            min={0}
            max={r.max}
            step={0.01}
            value={tuning[r.key]}
            onChange={(e) => {
              setTuning({ [r.key]: Number(e.target.value) });
              force((n) => n + 1);
            }}
          />
        </label>
      ))}
      <button type="button" className="text-button" onClick={() => { setTuning({ ...TUNING_DEFAULTS }); force((n) => n + 1); }}>Defaults</button>
      <button type="button" className="text-button" onClick={() => setOpen(false)}>Close</button>
    </aside>
  );
}
