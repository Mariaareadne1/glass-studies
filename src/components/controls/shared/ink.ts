import type { RGB } from '../../../glass/types';
import { mixRGB } from './math';

/**
 * V2 "LED" inks. The reference renders pixel art as light dots on tinted
 * glass: near-white with a memory of the original hue, warm amber for sunlight,
 * and dark warm dots on the creamy day thumb.
 */
type Ink = (c: RGB) => RGB;

const isWarm = (c: RGB) => c[0] > 0.9 && c[2] < 0.55;

export const DOT_GAP = 0.24;

/** Light ink: white dots, sunlight stays amber. */
export const lightInk: Ink = (c) => (isWarm(c) ? mixRGB(c, [1, 0.95, 0.85], 0.3) : mixRGB([1, 1, 1], c, 0.12));

/** Mode-tinted light ink: white with a whisper of the mode colour. */
export const tintedInk = (tint: RGB, k = 0.22): Ink => (c) => (isWarm(c) ? mixRGB(c, [1, 0.95, 0.85], 0.3) : mixRGB([1, 1, 1], tint, k));

/** Dark warm ink for bright cream glass (Solar's day thumb). */
export const darkWarmInk: Ink = (c) => mixRGB([0.43, 0.33, 0.25], c, 0.12);

/** Blend between two inks (state transitions). */
export const blendInk = (a: Ink, b: Ink, t: number): Ink => (c) => mixRGB(a(c), b(c), t);
