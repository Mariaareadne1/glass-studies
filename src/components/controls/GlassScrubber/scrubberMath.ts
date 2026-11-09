export const SCRUB = {
  W: 640,
  H: 440,
  /** Main frame (16:9). */
  frame: { x: 80, y: 18, w: 480, h: 270 },
  /** Thumbnail strip the lens rides along. */
  strip: { x: 64, y: 312, w: 512, h: 40 },
  thumbs: 12,
  lensHalf: 30,
  lensRadius: 18,
} as const;

/** Strip x → media time, clamped to [0, duration]. */
export function xToTime(x: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const k = Math.min(1, Math.max(0, (x - SCRUB.strip.x) / SCRUB.strip.w));
  return k * duration;
}

export function timeToX(t: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return SCRUB.strip.x;
  return SCRUB.strip.x + Math.min(1, Math.max(0, t / duration)) * SCRUB.strip.w;
}

/** m:ss.t — tenths, because short clips are scrubbed finely. */
export function formatTime(t: number): string {
  const v = Number.isFinite(t) && t > 0 ? t : 0;
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Times at which strip thumbnails are sampled (cell centres). */
export function thumbTimes(duration: number, n: number = SCRUB.thumbs): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * duration);
}
