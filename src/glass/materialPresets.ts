import type { MaterialParams, RGB } from './types';

/**
 * Tuned material baselines. Values were chosen by comparing renders over the
 * Pearl, Midnight and Optics environments (see docs/DESIGN_SYSTEM.md):
 *  - tracks: wide bevel, low thickness – a quiet, clear vessel
 *  - thumbs: thick slab with a strong rim so the backdrop visibly bends
 *  - beads: tiny spheres, bevel = radius
 */
const base: MaterialParams = {
  refraction: 1,
  bevel: 18,
  thickness: 22,
  frost: 0.12,
  aberration: 0.35,
  specular: 0.8,
  tint: [1, 1, 1, 0.06],
  glow: [1, 1, 1, 0],
  shadow: 0.35,
  exposure: 1.02,
};

export function material(patch: Partial<MaterialParams> = {}): MaterialParams {
  return { ...base, ...patch };
}

export const TRACK = material({ bevel: 22, thickness: 12, frost: 0.18, aberration: 0.25, shadow: 0.28, tint: [1, 1, 1, 0.08] });
export const THUMB = material({ bevel: 24, thickness: 34, frost: 0.05, aberration: 0.5, specular: 1, shadow: 0.45 });
export const CARD = material({ bevel: 26, thickness: 18, frost: 0.55, aberration: 0.2, shadow: 0.3, tint: [1, 1, 1, 0.12] });
export const BEAD = material({ bevel: 14, thickness: 22, frost: 0.0, aberration: 0.6, specular: 1.2, shadow: 0.5 });

/** Dark-environment variant: smoked body, lifted rim light. */
export function smoked(m: MaterialParams, amount = 1): MaterialParams {
  return {
    ...m,
    tint: [0.12, 0.13, 0.2, 0.18 * amount],
    exposure: m.exposure * (1 - 0.08 * amount),
    specular: m.specular * (1 + 0.25 * amount),
  };
}

export function withTint(m: MaterialParams, rgb: RGB, a: number): MaterialParams {
  return { ...m, tint: [rgb[0], rgb[1], rgb[2], a] };
}

export function withGlow(m: MaterialParams, rgb: RGB, a: number): MaterialParams {
  return { ...m, glow: [rgb[0], rgb[1], rgb[2], a] };
}
