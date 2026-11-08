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
  bevel: 20,
  thickness: 22,
  frost: 0.2,
  aberration: 0.45,
  specular: 1,
  tint: [0.72, 0.72, 0.84, 0.4],
  glow: [1, 1, 1, 0],
  shadow: 0.38,
  exposure: 1.0,
  milk: 0.7,
  halo: 0,
};

export function material(patch: Partial<MaterialParams> = {}): MaterialParams {
  return { ...base, ...patch };
}

/** V2 "Pearl Optics" palette (sampled from the reference sheet). */
export const PEARL = {
  lavender: [0.70, 0.71, 0.84] as const,
  silver: [0.77, 0.80, 0.87] as const,
  cream: [0.975, 0.96, 0.945] as const,
  pearl: [0.985, 0.98, 0.99] as const,
};

/** Tracks: lavender-grey body, thick milky wall – a calm vessel darker than the studio. */
export const TRACK = material({ bevel: 26, thickness: 14, frost: 0.3, aberration: 0.5, shadow: 0.34, tint: [...PEARL.lavender, 0.46], milk: 0.8 });
/** Thumbs/tiles: thicker, creamier, shinier – optically heavier than the track. */
export const THUMB = material({ bevel: 26, thickness: 32, frost: 0.42, aberration: 0.55, specular: 1.2, shadow: 0.5, tint: [...PEARL.cream, 0.42], milk: 0.9 });
/** Panels carrying text: frosted lavender-blue so light type reads. */
export const CARD = material({ bevel: 28, thickness: 18, frost: 0.62, aberration: 0.35, shadow: 0.32, tint: [0.64, 0.67, 0.84, 0.5], milk: 0.72 });
/** Small spheres. */
export const BEAD = material({ bevel: 14, thickness: 22, frost: 0.05, aberration: 0.6, specular: 1.4, shadow: 0.5, tint: [...PEARL.pearl, 0.25], milk: 0.6 });

/** Dark-environment variant: smoked body, lifted rim light. */
export function smoked(m: MaterialParams, amount = 1): MaterialParams {
  return {
    ...m,
    tint: [0.16, 0.17, 0.23, Math.max(m.tint[3], 0.45) * amount],
    exposure: m.exposure * (1 - 0.08 * amount),
    specular: m.specular * (1 + 0.25 * amount),
    milk: m.milk * (1 - 0.45 * amount),
  };
}

export function withTint(m: MaterialParams, rgb: RGB, a: number): MaterialParams {
  return { ...m, tint: [rgb[0], rgb[1], rgb[2], a] };
}

export function withGlow(m: MaterialParams, rgb: RGB, a: number): MaterialParams {
  return { ...m, glow: [rgb[0], rgb[1], rgb[2], a] };
}
