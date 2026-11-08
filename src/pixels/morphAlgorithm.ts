import type { RGB } from '../glass/types';
import type { Pixel } from './iconDefinitions';

/**
 * Pixel-morph planning. Given a source and destination pixel set, build a
 * list of particles that each travel from a start to an end state:
 *   - shared pixels are matched by approximate minimum distance (greedy over
 *     a seeded order) and glide between their positions
 *   - surplus source pixels fly outward from the icon centre and fade
 *   - new destination pixels split off a nearby source pixel and grow in
 * Every particle carries a staggered delay so the motion reads as squares
 * breaking apart, drifting and reassembling rather than a crossfade.
 */

export interface ParticleState {
  x: number;
  y: number;
  color: RGB;
  alpha: number;
  size: number;
}

export interface Particle {
  from: ParticleState;
  to: ParticleState;
  /** 0..maxDelay */
  delay: number;
  /** Perpendicular arc amplitude in cells (seeded). */
  arc: number;
  kind: 'shared' | 'exit' | 'enter';
}

export type StaggerMode = 'sweep-x' | 'radial' | 'random';

export interface PlanOptions {
  seed?: number;
  stagger?: StaggerMode;
  /** Direction for sweep stagger, +1 left→right. */
  direction?: number;
  maxDelay?: number;
  scatter?: number;
  center?: { x: number; y: number };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Greedy approximate minimum-distance matching. Returns index pairs
 * (source i → destination j) for min(|A|, |B|) pairs; deterministic for a
 * given seed.
 */
export function matchPixels(a: readonly { x: number; y: number }[], b: readonly { x: number; y: number }[], seed = 1): Array<[number, number]> {
  const rand = rng(seed);
  const order = shuffle(
    a.map((_, i) => i),
    rand,
  );
  const used = new Uint8Array(b.length);
  const pairs: Array<[number, number]> = [];
  const limit = Math.min(a.length, b.length);
  for (const i of order) {
    if (pairs.length >= limit) break;
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (used[j]) continue;
      const d = (a[i].x - b[j].x) ** 2 + (a[i].y - b[j].y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) {
      used[best] = 1;
      pairs.push([i, best]);
    }
  }
  return pairs;
}

const CENTER = { x: 5.5, y: 5.5 };

export function planMorph(from: readonly ParticleState[], to: readonly Pixel[], opts: PlanOptions = {}): Particle[] {
  const seed = opts.seed ?? 7;
  const rand = rng(seed * 9973 + 11);
  const maxDelay = opts.maxDelay ?? 0.35;
  const scatter = opts.scatter ?? 1.6;
  const c = opts.center ?? CENTER;
  const dir = opts.direction ?? 1;
  const visible = from.filter((p) => p.alpha > 0.02);
  const pairs = matchPixels(visible, to, seed);
  const usedFrom = new Set(pairs.map((p) => p[0]));
  const usedTo = new Set(pairs.map((p) => p[1]));
  const particles: Particle[] = [];

  const delayFor = (x: number, y: number): number => {
    const mode = opts.stagger ?? 'sweep-x';
    let k: number;
    if (mode === 'radial') k = Math.min(1, Math.hypot(x - c.x, y - c.y) / 7);
    else if (mode === 'random') k = rand();
    else k = dir >= 0 ? x / 11 : 1 - x / 11;
    return Math.max(0, Math.min(1, k * 0.8 + rand() * 0.2)) * maxDelay;
  };
  const arc = () => (rand() * 2 - 1) * scatter;

  for (const [i, j] of pairs) {
    const s = visible[i];
    const d = to[j];
    particles.push({
      from: s,
      to: { x: d.x, y: d.y, color: d.color, alpha: 1, size: 1 },
      delay: delayFor(s.x, s.y),
      arc: arc(),
      kind: 'shared',
    });
  }
  visible.forEach((s, i) => {
    if (usedFrom.has(i)) return;
    const ang = Math.atan2(s.y - c.y, s.x - c.x) + (rand() - 0.5) * 0.8;
    const dist = 2.5 + rand() * 3;
    particles.push({
      from: s,
      to: { x: s.x + Math.cos(ang) * dist, y: s.y + Math.sin(ang) * dist, color: s.color, alpha: 0, size: 0.3 },
      delay: delayFor(s.x, s.y) * 0.6,
      arc: arc(),
      kind: 'exit',
    });
  });
  to.forEach((d, j) => {
    if (usedTo.has(j)) return;
    // split off the nearest source pixel (or emerge from the centre)
    let src: ParticleState = { x: c.x, y: c.y, color: d.color, alpha: 0, size: 0.2 };
    let best = Infinity;
    for (const s of visible) {
      const dd = (s.x - d.x) ** 2 + (s.y - d.y) ** 2;
      if (dd < best) {
        best = dd;
        src = { ...s, alpha: 0, size: 0.25 };
      }
    }
    particles.push({
      from: src,
      to: { x: d.x, y: d.y, color: d.color, alpha: 1, size: 1 },
      delay: Math.min(maxDelay, delayFor(d.x, d.y) + maxDelay * 0.25),
      arc: arc(),
      kind: 'enter',
    });
  });
  return particles;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Evaluate one particle at global progress p (0..1). */
export function evalParticle(pt: Particle, p: number, maxDelay = 0.35): ParticleState {
  const span = Math.max(1e-3, 1 - maxDelay);
  const t = Math.max(0, Math.min(1, (p - pt.delay) / span));
  const e = easeInOut(t);
  const dx = pt.to.x - pt.from.x;
  const dy = pt.to.y - pt.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.sin(Math.PI * e) * pt.arc * Math.min(1, len / 3);
  const mid = Math.sin(Math.PI * e);
  const lerp = (a: number, b: number) => a + (b - a) * e;
  return {
    x: lerp(pt.from.x, pt.to.x) + (-dy / len) * bow,
    y: lerp(pt.from.y, pt.to.y) + (dx / len) * bow,
    color: [lerp(pt.from.color[0], pt.to.color[0]), lerp(pt.from.color[1], pt.to.color[1]), lerp(pt.from.color[2], pt.to.color[2])],
    alpha: lerp(pt.from.alpha, pt.to.alpha),
    // squares shrink slightly while in flight – they read as separate pieces
    size: lerp(pt.from.size, pt.to.size) * (1 - 0.32 * mid),
  };
}

export function toStates(pixels: readonly Pixel[]): ParticleState[] {
  return pixels.map((p) => ({ x: p.x, y: p.y, color: p.color, alpha: 1, size: 1 }));
}
