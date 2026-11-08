/**
 * Global multipliers over every material and spring. Production values are
 * all 1 – the per-control presets in materialPresets.ts carry the tuned look.
 * The development inspector edits this object live; the renderer reads it
 * every frame, so changes act on the real rendering parameters.
 */
export interface Tuning {
  refraction: number;
  frost: number;
  aberration: number;
  specular: number;
  edgeLight: number;
  shadowSoftness: number;
  bevel: number;
  thickness: number;
  stiffness: number;
  damping: number;
  deformation: number;
  /** V2 rim milkiness multiplier. */
  milk: number;
  /** V2 outer halo / bloom multiplier. */
  bloom: number;
}

export const TUNING_DEFAULTS: Readonly<Tuning> = Object.freeze({
  refraction: 1,
  frost: 1,
  aberration: 1,
  specular: 1,
  edgeLight: 1,
  shadowSoftness: 1,
  bevel: 1,
  thickness: 1,
  stiffness: 1,
  damping: 1,
  deformation: 1,
  milk: 1,
  bloom: 1,
});

export const tuning: Tuning = { ...TUNING_DEFAULTS };

type Listener = () => void;
const listeners = new Set<Listener>();

export function setTuning(patch: Partial<Tuning>): void {
  Object.assign(tuning, patch);
  listeners.forEach((l) => l());
}

export function onTuningChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
