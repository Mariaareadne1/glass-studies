import type { SceneContext } from '../../glass/GlassStage';
import { CARD, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { GlassScene, RGB } from '../../glass/types';
import { Spring } from '../../motion/spring';
import { ledPixels } from '../../pixels/iconDefinitions';
import { toStates } from '../../pixels/morphAlgorithm';
import { drawPixels } from '../../pixels/PixelMorph';
import { DOT_GAP, glassInk, ledGlow } from '../controls/shared/ink';
import { mixRGB, rgba } from '../controls/shared/math';
import { LOADER, LoopController, phase } from './loopController';
import type { LoopMode } from './loopController';

export const TIDE_PERIOD = 3.6;
const HW = 104;
const HH = 156;
const RADIUS = 40;
const INSET = 8;
/** Interior of the vessel the liquid fills (design units). */
export const TIDE_INTERIOR = { w: (HW - INSET) * 2, h: (HH - INSET) * 2, r: RADIUS - INSET } as const;
const SHALLOW: RGB = [0.66, 0.86, 1.0];
const DEEP: RGB = [0.58, 0.68, 0.98];
const BUBBLES = [
  [0.22, 0.0, 3],
  [0.48, 0.35, 4],
  [0.7, 0.6, 3],
  [0.36, 0.78, 2],
  [0.6, 0.15, 2],
] as const;

/** Fill level 0..1 over one indeterminate tide: rises then drains, with no seam at the loop. */
export function tideLevel(t: number): number {
  return 0.12 + 0.76 * (0.5 - 0.5 * Math.cos(phase(t, TIDE_PERIOD) * Math.PI * 2));
}

/** Interior width at height y above the floor (rounded caps narrow the vessel). */
function widthAt(y: number): number {
  const { w, h, r } = TIDE_INTERIOR;
  const yy = Math.min(Math.max(y, 0), h);
  const d = yy < r ? r - yy : yy > h - r ? yy - (h - r) : 0;
  return w - 2 * (r - Math.sqrt(Math.max(0, r * r - d * d)));
}

/** Liquid area below height y (numerical integral of the width, exact to < 0.01%). */
export function volumeBelow(y: number): number {
  const steps = 400;
  const top = Math.min(Math.max(y, 0), TIDE_INTERIOR.h);
  let a = 0;
  for (let i = 0; i < steps; i++) a += widthAt(((i + 0.5) / steps) * top) * (top / steps);
  return a;
}

const TOTAL = volumeBelow(TIDE_INTERIOR.h);

/**
 * Liquid height (design units above the floor) holding a fraction p of the
 * vessel's volume. Accounts for the rounded caps: the level rises faster
 * near the floor and the top, where the vessel is narrower.
 */
export function heightForVolume(p: number): number {
  const target = Math.min(1, Math.max(0, p)) * TOTAL;
  let lo = 0;
  let hi = TIDE_INTERIOR.h;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (volumeBelow(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const COLS = 24;
const WAVE_C2 = 900; // wave speed² (1/s²) in column units
const WAVE_DAMP = 3.2;
const WAVE_MAX = 14; // design units
const STEP = 1 / 240;

/**
 * A 1D damped surface on fixed columns, integrated at a fixed sub-step. The
 * mean offset is removed every step, so waves never change the volume shown,
 * and offsets are clamped, so arbitrary jumps stay bounded.
 */
export class TideSurface {
  readonly u = new Float64Array(COLS);
  private v = new Float64Array(COLS);
  private acc = 0;

  /** Slosh from a level change: a tilt impulse proportional to the jump, bounded. */
  excite(delta: number): void {
    const k = Math.max(-1, Math.min(1, delta * 4));
    for (let i = 0; i < COLS; i++) this.v[i] += k * 420 * ((i + 0.5) / COLS - 0.5) * -2;
  }

  step(dt: number): void {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      for (let i = 0; i < COLS; i++) {
        const l = this.u[Math.max(0, i - 1)];
        const r = this.u[Math.min(COLS - 1, i + 1)];
        const a = WAVE_C2 * (l + r - 2 * this.u[i]) * 0.06 - WAVE_DAMP * this.v[i] - 6 * this.u[i];
        this.v[i] += a * STEP;
      }
      let mean = 0;
      for (let i = 0; i < COLS; i++) {
        this.u[i] += this.v[i] * STEP;
        mean += this.u[i];
      }
      mean /= COLS;
      let peak = 0;
      for (let i = 0; i < COLS; i++) {
        this.u[i] -= mean;
        peak = Math.max(peak, Math.abs(this.u[i]));
      }
      // bound the slosh by scaling the whole surface (keeps the zero mean exactly)
      if (peak > WAVE_MAX) {
        const k = WAVE_MAX / peak;
        for (let i = 0; i < COLS; i++) {
          this.u[i] *= k;
          this.v[i] *= k;
        }
      }
    }
  }

  get energy(): number {
    let e = 0;
    for (let i = 0; i < COLS; i++) e += this.u[i] * this.u[i] + this.v[i] * this.v[i] * 0.01;
    return e;
  }

  calm(): void {
    this.u.fill(0);
    this.v.fill(0);
  }

  /** Offset at a 0..1 position across the vessel (linear between columns). */
  at(f: number): number {
    const x = Math.min(COLS - 1, Math.max(0, f * (COLS - 1)));
    const i = Math.floor(x);
    const t = x - i;
    return this.u[i] * (1 - t) + this.u[Math.min(COLS - 1, i + 1)] * t;
  }
}

/**
 * Tide Fill: a slender glass vessel. Indeterminate mode is a soft tide (no
 * number). Determinate mode fills the vessel by VOLUME to the supplied
 * fraction: the level follows a spring, the surface sloshes on changes and
 * settles, and at 100% the vessel is full, still, releases one bubble and
 * shows a check. The water is drawn beneath the glass and refracted by it.
 */
export class TideLoader extends LoopController {
  override readonly supportsProgress = true;
  private level = new Spring(0, { stiffness: 40, damping: 12, mass: 1 });
  readonly surface = new TideSurface();
  private bubble = -1; // seconds since the completion bubble left the floor, -1 = none

  constructor() {
    super(TIDE_PERIOD * 0.3);
  }

  /** Displayed mean liquid height (design units above the interior floor). */
  get height(): number {
    if (this.transport.mode === 'progress') return this.level.x;
    return this.reducedMotion ? heightForVolume(0.56) : heightForVolume(tideLevel(this.t));
  }

  get complete(): boolean {
    return this.transport.mode === 'progress' && this.transport.progress >= 1;
  }

  protected override onModeChange(mode: LoopMode): void {
    if (mode === 'progress') this.level.snap(heightForVolume(tideLevel(this.t)));
    this.onProgress(this.transport.progress);
  }

  protected override onProgress(p: number): void {
    if (this.transport.mode !== 'progress') return;
    const target = heightForVolume(p);
    if (!this.reducedMotion) this.surface.excite((target - this.level.target) / TIDE_INTERIOR.h);
    this.level.set(target);
    if (this.reducedMotion) this.level.snap(target);
    if (p >= 1 && this.bubble < 0) this.bubble = 0;
    if (p < 1) this.bubble = -1;
  }

  protected override onRestart(): void {
    this.surface.calm();
    this.bubble = -1;
  }

  override step(dt: number): boolean {
    const playing = super.step(dt);
    if (!playing) return false;
    if (this.transport.mode !== 'progress') return true;
    this.level.step(dt);
    if (!this.reducedMotion) this.surface.step(dt);
    if (this.bubble >= 0 && this.bubble < 1.4) this.bubble += dt;
    const settled = this.level.isSettled(0.05) && this.surface.energy < 0.01;
    if (settled) {
      this.level.settle();
      this.surface.calm();
    }
    return !settled || (this.bubble >= 0 && this.bubble < 1.4);
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = LOADER;
    const determinate = this.transport.mode === 'progress';
    const height = this.height;
    const fill = height / TIDE_INTERIOR.h;
    const glow = this.reducedMotion && !determinate ? 0.5 + 0.5 * Math.cos(this.t * 1.6) : fill;
    let vessel = withTint({ ...CARD, bevel: 40, thickness: 30, frost: 0.04, aberration: 0.35, specular: 1.35, milk: 0.7 }, [0.94, 0.95, 1], 0.14);
    vessel = { ...withGlow(vessel, SHALLOW, 0.06 + 0.08 * glow), halo: 0.1 + 0.1 * glow };
    if (dark) vessel = smoked(vessel, 0.45);

    const left = cx - HW + INSET;
    const right = cx + HW - INSET;
    const floor = cy + HH - INSET;
    const top = floor - height;
    const under = ctx.paint('tide-loader-water', (g) => {
      g.save();
      g.beginPath();
      g.roundRect(left, cy - HH + INSET, right - left, TIDE_INTERIOR.h, TIDE_INTERIOR.r);
      g.clip();
      if (height > 0.2) {
        const water = g.createLinearGradient(0, top, 0, floor);
        water.addColorStop(0, rgba(SHALLOW, dark ? 0.6 : 0.62));
        water.addColorStop(1, rgba(DEEP, dark ? 0.72 : 0.7));
        g.fillStyle = water;
        const amp = this.reducedMotion || determinate ? 0 : 5;
        // free surface: the simulated columns (determinate) or the gentle tide sway (indeterminate)
        const surface = (x: number) => {
          const f = (x - left) / (right - left);
          return top + (determinate ? this.surface.at(f) : Math.sin(x * 0.045 + this.t * 3.1) * amp + Math.sin(x * 0.09 - this.t * 2.2) * amp * 0.4);
        };
        g.beginPath();
        g.moveTo(left, floor);
        for (let x = left; x <= right; x += 4) g.lineTo(x, surface(x));
        g.lineTo(right, surface(right));
        g.lineTo(right, floor);
        g.closePath();
        g.fill();
        // meniscus: a fine bright line riding the surface, a little higher at the walls
        g.strokeStyle = rgba(mixRGB(SHALLOW, [1, 1, 1], 0.75), dark ? 0.7 : 0.9);
        g.lineWidth = 1.6;
        g.beginPath();
        for (let x = left; x <= right; x += 4) {
          const wall = Math.max(0, 1 - Math.min(x - left, right - x) / 14) * 3;
          if (x === left) g.moveTo(x, surface(x) - wall);
          else g.lineTo(x, surface(x) - wall);
        }
        g.stroke();
        if (!this.reducedMotion && !determinate) {
          BUBBLES.forEach(([fx, offset, size]) => {
            const k = phase(this.t / 2.4 + offset, 1);
            const y = floor - k * (floor - top);
            const x = left + fx * (right - left) + Math.sin(this.t * 2 + offset * 9) * 4;
            if (y < surface(x) + 4) return;
            g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k * 0.6)})`;
            const s = size * 2;
            g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
          });
        }
        // the completion bubble: rises once from the floor and breaks at the surface
        if (this.bubble >= 0 && this.bubble < 1.4 && !this.reducedMotion) {
          const k = Math.min(1, this.bubble / 1.1);
          const y = floor - 10 - k * (floor - top - 14);
          const s = 7 * (1 - Math.max(0, this.bubble - 1.1) / 0.3);
          g.fillStyle = 'rgba(255,255,255,0.75)';
          g.fillRect(Math.round(cx - s / 2), Math.round(y - s / 2), s, s);
        }
      }
      g.restore();
    });
    const above = this.complete
      ? ctx.paint('tide-check', (g) => {
          drawPixels(g, toStates(ledPixels('check')), cx, cy, 6, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 3, glowAlpha: ledGlow(dark, 0.6) });
        })
      : undefined;

    return {
      env: { kind: ctx.env, glowColor: SHALLOW, glowPos: [cx, top], glowRadius: 260, glowStrength: dark ? 0.12 : 0.06, brightness: 1, time: ctx.time },
      under,
      layers: [{ shapes: [{ cx, cy, hw: HW, hh: HH, radius: RADIUS, skew: 0, material: vessel }], above }],
    };
  }
}
