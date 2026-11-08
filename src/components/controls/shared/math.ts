import type { RGB } from '../../../glass/types';

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Mix across a list of evenly spaced colour stops, t in 0..1. */
export const rampRGB = (stops: readonly RGB[], t: number): RGB => {
  const x = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mixRGB(stops[i], stops[i + 1], x - i);
};
export const rgba = (c: RGB, a = 1): string =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

/** Rubber-band overshoot past an end stop: approaches `limit` asymptotically. */
export const rubber = (over: number, limit = 0.08): number => (limit * over) / (limit + Math.abs(over));
