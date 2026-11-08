import type { Pixel } from './iconDefinitions';
import { evalParticle, planMorph, toStates } from './morphAlgorithm';
import type { Particle, ParticleState, PlanOptions } from './morphAlgorithm';

/**
 * Runtime for a morphing pixel icon.
 *
 * Two driving modes:
 *  - time-driven: `morphTo()` plans from the *currently rendered* particle
 *    positions, so an interrupted morph continues from where its squares are
 *    instead of jumping.
 *  - scrubbed: `setScrub(a, b)` + `progress = p` ties the morph directly to
 *    an external value (the Solar thumb position), so dragging back and
 *    forth plays the transformation forwards and backwards.
 */
export class PixelMorpher {
  private plan: Particle[] = [];
  private maxDelay = 0.35;
  private duration = 0.6;
  private timeDriven = true;
  progress = 1;
  private settledStates: ParticleState[];

  constructor(initial: readonly Pixel[]) {
    this.settledStates = toStates(initial);
    this.plan = this.settledStates.map((s) => ({ from: s, to: s, delay: 0, arc: 0, kind: 'shared' }));
  }

  /** Current rendered state of every visible square. */
  states(): ParticleState[] {
    if (this.progress >= 1 && this.timeDriven) return this.settledStates;
    return this.plan.map((p) => evalParticle(p, this.progress, this.maxDelay)).filter((s) => s.alpha > 0.01);
  }

  morphTo(target: readonly Pixel[], opts: PlanOptions & { duration?: number } = {}): void {
    const from = this.states();
    this.maxDelay = opts.maxDelay ?? 0.35;
    this.duration = opts.duration ?? 0.62;
    this.plan = planMorph(from, target, { ...opts, maxDelay: this.maxDelay });
    this.settledStates = toStates(target);
    this.timeDriven = true;
    this.progress = 0;
  }

  /** Instantly show an icon (reduced motion / initial state). */
  show(target: readonly Pixel[]): void {
    this.settledStates = toStates(target);
    this.plan = this.settledStates.map((s) => ({ from: s, to: s, delay: 0, arc: 0, kind: 'shared' }));
    this.timeDriven = true;
    this.progress = 1;
  }

  /** Fix a reversible plan between two icons; drive it with `progress`. */
  setScrub(a: readonly Pixel[], b: readonly Pixel[], opts: PlanOptions = {}): void {
    this.maxDelay = opts.maxDelay ?? 0.35;
    this.plan = planMorph(toStates(a), b, { ...opts, maxDelay: this.maxDelay });
    this.timeDriven = false;
  }

  step(dt: number): boolean {
    if (!this.timeDriven || this.progress >= 1) return false;
    this.progress = Math.min(1, this.progress + dt / this.duration);
    return this.progress < 1;
  }

  get animating(): boolean {
    return this.timeDriven && this.progress < 1;
  }
}

export interface DrawPixelOptions {
  /** Glow radius in design units (0 = none). */
  glow?: number;
  glowAlpha?: number;
  alpha?: number;
  /** Extra per-square transform hook (idle animations). */
  map?: (s: ParticleState, i: number) => ParticleState;
  /** Rotation about the icon centre in radians. */
  rotate?: number;
  scaleX?: number;
  scaleY?: number;
  /** Fraction of each cell left empty between dots (LED dot-matrix look). */
  gap?: number;
  /** Maps each square's colour (e.g. to light LED ink). */
  ink?: (c: readonly [number, number, number]) => readonly [number, number, number];
  /** Colour of the glow halo (defaults to white). */
  glowColor?: string;
}

const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/**
 * Draw squares centred on (cx, cy) with `cell` design units per pixel.
 * `ctx` is already scaled to design units; squares are snapped to the
 * device-pixel grid when at rest so the artwork stays crisp at any DPR.
 */
export function drawPixels(
  ctx: CanvasRenderingContext2D,
  states: readonly ParticleState[],
  cx: number,
  cy: number,
  cell: number,
  dpr: number,
  opts: DrawPixelOptions = {},
): void {
  if (!scratch) return;
  const pad = Math.ceil((opts.glow ?? 0) * 2.5 + cell * 4);
  const size = cell * 12 + pad * 2;
  const pxSize = Math.ceil(size * dpr);
  if (scratch.width < pxSize || scratch.height < pxSize) {
    scratch.width = pxSize;
    scratch.height = pxSize;
  }
  const sc = scratch.getContext('2d');
  if (!sc) return;
  sc.setTransform(1, 0, 0, 1, 0, 0);
  // clear the whole scratch: bilinear sampling at the copy edge must never pick up older icons
  sc.clearRect(0, 0, scratch.width, scratch.height);
  sc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = opts.scaleX ?? 1;
  const sy = opts.scaleY ?? 1;
  const rot = opts.rotate ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  states.forEach((raw, i) => {
    const s = opts.map ? opts.map(raw, i) : raw;
    if (s.alpha <= 0.01 || s.size <= 0.01) return;
    // centre of this square relative to icon centre, in cells
    const rx = (s.x + 0.5 - 6) * sx;
    const ry = (s.y + 0.5 - 6) * sy;
    const x = rx * cos - ry * sin;
    const y = rx * sin + ry * cos;
    const w = cell * s.size * (1 - (opts.gap ?? 0));
    const px = pad + 6 * cell + x * cell - w / 2;
    const py = pad + 6 * cell + y * cell - w / 2;
    const c = opts.ink ? opts.ink(s.color) : s.color;
    sc.fillStyle = `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${s.alpha})`;
    if (s.size > 0.98) {
      // snap both edges to device pixels so squares tile without seams
      const x0 = Math.round(px * dpr) / dpr;
      const y0 = Math.round(py * dpr) / dpr;
      const x1 = Math.round((px + w) * dpr) / dpr;
      const y1 = Math.round((py + w) * dpr) / dpr;
      sc.fillRect(x0, y0, x1 - x0, y1 - y0);
    } else {
      sc.fillRect(px, py, w, w);
    }
  });
  const x0 = Math.round((cx - size / 2) * dpr) / dpr;
  const y0 = Math.round((cy - size / 2) * dpr) / dpr;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.glow && opts.glow > 0) {
    ctx.save();
    ctx.globalAlpha = (opts.alpha ?? 1) * (opts.glowAlpha ?? 0.6);
    ctx.filter = `blur(${opts.glow}px)`;
    ctx.drawImage(scratch, 0, 0, pxSize, pxSize, x0, y0, size, size);
    ctx.restore();
  }
  ctx.drawImage(scratch, 0, 0, pxSize, pxSize, x0, y0, size, size);
  ctx.restore();
}
