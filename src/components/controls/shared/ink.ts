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
export const tintedInk = (tint: RGB, k = 0.22): Ink => () => mixRGB([1, 1, 1], tint, k);

/** Dark warm ink for bright cream glass (Solar's day thumb). */
export const darkWarmInk: Ink = (c) => mixRGB([0.43, 0.33, 0.25], c, 0.12);

/** Blend between two inks (state transitions). */
export const blendInk = (a: Ink, b: Ink, t: number): Ink => (c) => mixRGB(a(c), b(c), t);

/**
 * V2.1 light-mode ink. The pearl glass is now clear enough that white dots wash
 * out on pale studios, so neutral pixels and in-glass type use a deep pearl-grey
 * there (state colours such as sunlight keep their hue). Midnight keeps white.
 */
export const PEARL_INK: RGB = [0.29, 0.28, 0.42];

export const pearlInk: Ink = (c) => (isWarm(c) ? mixRGB(c, [0.9, 0.48, 0.12], 0.25) : mixRGB(PEARL_INK, c, 0.18));

/** The ink for content sitting on glass in the current environment. */
export const glassInk = (dark: boolean): Ink => (dark ? lightInk : pearlInk);

/** Mode-tinted ink for the current environment. */
export const glassTintedInk = (dark: boolean, tint: RGB, k = 0.22): Ink => (dark ? tintedInk(tint, k) : () => mixRGB(PEARL_INK, tint, Math.min(1, k * 1.25)));

/** Glow strength for LED dots: a light bloom on dark glass, almost none for dark ink. */
export const ledGlow = (dark: boolean, alpha: number): number => (dark ? alpha : alpha * 0.2);
