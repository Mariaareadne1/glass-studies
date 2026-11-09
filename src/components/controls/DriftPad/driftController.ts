import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterLength } from '../../../glass/geometry';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { ledPixels } from '../../../pixels/iconDefinitions';
import type { IconName } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import type { DriftValue } from '../../../state/controls';
import { DOT_GAP, glassInk, ledGlow } from '../shared/ink';
import { clamp, mixRGB, rgba } from '../shared/math';
import { DriftBody } from './driftBody';

export const DRIFT = {
  W: 640,
  H: 440,
  cx: 244,
  cy: 220,
  padHalf: 168,
  padRadius: 44,
  puckHalf: 38,
  puckRadius: 22,
  /** Gap kept between the puck and the pad wall. */
  inset: 14,
} as const;

const TRAVEL = DRIFT.padHalf - DRIFT.puckHalf - DRIFT.inset;
export const DRIFT_BOUNDS = { minX: DRIFT.cx - TRAVEL, maxX: DRIFT.cx + TRAVEL, minY: DRIFT.cy - TRAVEL, maxY: DRIFT.cy + TRAVEL };

/** Pad position → warmth (x, left→right) and energy (y, bottom→top), 0..100. */
export function toValue(x: number, y: number): DriftValue {
  return {
    x: clamp((x - DRIFT_BOUNDS.minX) / (2 * TRAVEL)) * 100,
    y: clamp((DRIFT_BOUNDS.maxY - y) / (2 * TRAVEL)) * 100,
  };
}

export function toPosition(v: DriftValue): { x: number; y: number } {
  return { x: DRIFT_BOUNDS.minX + (v.x / 100) * 2 * TRAVEL, y: DRIFT_BOUNDS.maxY - (v.y / 100) * 2 * TRAVEL };
}

/** Corner colours of the field: calm/energetic × cool/warm. */
const FIELD = {
  calmCool: [0.66, 0.68, 0.98] as RGB,
  calmWarm: [1.0, 0.78, 0.62] as RGB,
  livelyCool: [0.5, 0.86, 0.9] as RGB,
  livelyWarm: [1.0, 0.56, 0.52] as RGB,
};

export function fieldColor(v: DriftValue): RGB {
  const x = v.x / 100;
  const y = v.y / 100;
  return mixRGB(mixRGB(FIELD.calmCool, FIELD.calmWarm, x), mixRGB(FIELD.livelyCool, FIELD.livelyWarm, x), y);
}

/** Within this distance of the centre the mood reads as balanced. */
const BALANCED = 9;

export function moodOf(v: DriftValue): { icon: IconName; label: string } {
  if (Math.hypot(v.x - 50, v.y - 50) < BALANCED) return { icon: 'diamond', label: 'Balanced' };
  const warm = v.x >= 50;
  const lively = v.y >= 50;
  if (lively) return warm ? { icon: 'bolt', label: 'Lively · Warm' } : { icon: 'wind', label: 'Lively · Cool' };
  return warm ? { icon: 'leaf', label: 'Calm · Warm' } : { icon: 'rest', label: 'Calm · Cool' };
}

/**
 * Drift Pad: a two-axis pad. The glass puck follows the hand exactly, keeps
 * drifting after a throw, loses speed to friction and bounces softly off the
 * walls, compressing against them. The field beneath is a calm/lively ×
 * cool/warm colour space, and the puck's icon changes by quadrant.
 */
export class DriftController implements StageController {
  readonly body: DriftBody;
  private gx: Spring;
  private gy: Spring;
  private squashX = new Spring(0, SPRINGS.deform);
  private squashY = new Spring(0, SPRINGS.deform);
  private edge = new EdgeLight(0.3, 1.6);
  private icon: PixelMorpher;
  private iconName: IconName;
  private mode: 'rest' | 'drag' | 'drift' | 'glide' = 'rest';
  private field: HTMLCanvasElement | null = null;
  private invalidate: () => void = () => undefined;
  private reducedMotion = false;
  /** Reports the settled value after a throw or glide. */
  onSettle: (v: DriftValue) => void = () => undefined;

  constructor(v: DriftValue) {
    const p = toPosition(v);
    this.body = new DriftBody(p.x, p.y, DRIFT_BOUNDS);
    this.gx = new Spring(p.x, SPRINGS.travel);
    this.gy = new Spring(p.y, SPRINGS.travel);
    this.iconName = moodOf(v).icon;
    this.icon = new PixelMorpher(ledPixels(this.iconName));
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.gx.config = this.gy.config = r ? reduced(SPRINGS.travel) : SPRINGS.travel;
  }

  get value(): DriftValue {
    return toValue(this.body.x, this.body.y);
  }

  get dragging(): boolean {
    return this.mode === 'drag';
  }

  hitPuck(x: number, y: number): boolean {
    return Math.abs(x - this.body.x) <= DRIFT.puckHalf + 12 && Math.abs(y - this.body.y) <= DRIFT.puckHalf + 12;
  }

  hitPad(x: number, y: number): boolean {
    return Math.abs(x - DRIFT.cx) <= DRIFT.padHalf && Math.abs(y - DRIFT.cy) <= DRIFT.padHalf;
  }

  beginDrag(): void {
    this.mode = 'drag';
    this.edge.impulse(0.4);
    this.invalidate();
  }

  dragTo(x: number, y: number, vx: number, vy: number): void {
    this.body.place(x, y);
    this.body.vx = vx;
    this.body.vy = vy;
    this.invalidate();
  }

  /** Release with the hand's velocity; reduced motion drops the throw. */
  release(vx: number, vy: number): void {
    this.body.vx = 0;
    this.body.vy = 0;
    if (!this.reducedMotion) this.body.launch(vx, vy);
    this.mode = this.body.moving ? 'drift' : 'rest';
    if (this.mode === 'rest') this.onSettle(this.value);
    this.invalidate();
  }

  /** Keyboard / external value: glide on springs. */
  glideTo(v: DriftValue): void {
    if (this.mode === 'drag') return;
    const p = toPosition(v);
    this.gx.snap(this.body.x);
    this.gy.snap(this.body.y);
    this.gx.set(p.x);
    this.gy.set(p.y);
    this.mode = 'glide';
    this.invalidate();
  }

  step(dt: number): boolean {
    if (this.mode === 'drift') {
      const impact = this.body.step(dt);
      if (impact > 60 && !this.reducedMotion) {
        const k = Math.min(impact / 1800, 0.24);
        const b = this.body;
        if (b.x <= DRIFT_BOUNDS.minX + 1 || b.x >= DRIFT_BOUNDS.maxX - 1) this.squashX.snap(-k, 0);
        if (b.y <= DRIFT_BOUNDS.minY + 1 || b.y >= DRIFT_BOUNDS.maxY - 1) this.squashY.snap(-k, 0);
        this.edge.impulse(Math.min(1, impact / 900));
      }
      if (!this.body.moving) {
        this.mode = 'rest';
        this.onSettle(this.value);
      }
    } else if (this.mode === 'glide') {
      this.gx.step(dt);
      this.gy.step(dt);
      this.body.x = this.gx.x;
      this.body.y = this.gy.x;
      this.body.vx = this.gx.v;
      this.body.vy = this.gy.v;
      if (this.gx.isSettled(0.05) && this.gy.isSettled(0.05)) {
        this.gx.settle();
        this.gy.settle();
        this.body.place(this.gx.x, this.gy.x);
        this.mode = 'rest';
      }
    }
    this.squashX.step(dt);
    this.squashY.step(dt);
    const mood = moodOf(this.value).icon;
    if (mood !== this.iconName) {
      this.iconName = mood;
      if (this.reducedMotion) this.icon.show(ledPixels(mood));
      else this.icon.morphTo(ledPixels(mood), { seed: 21, stagger: 'radial', duration: 0.5 });
    }
    const morphing = this.icon.step(dt);
    const speed = Math.hypot(this.body.vx, this.body.vy);
    this.edge.update(this.reducedMotion ? 0 : speed, perimeterLength({ hw: DRIFT.puckHalf, hh: DRIFT.puckHalf, radius: DRIFT.puckRadius }), dt);
    const deforming = !this.squashX.isSettled(0.002) || !this.squashY.isSettled(0.002);
    return this.mode !== 'rest' || deforming || morphing || this.edge.active;
  }

  /** Puck extents: stretched along its velocity, compressed against a wall it hit. */
  puck(): { cx: number; cy: number; hw: number; hh: number; radius: number } {
    const b = this.body;
    const sx = this.reducedMotion ? 0 : clamp(Math.abs(b.vx) / 2600, 0, 0.18);
    const sy = this.reducedMotion ? 0 : clamp(Math.abs(b.vy) / 2600, 0, 0.18);
    const hw = DRIFT.puckHalf * (1 + sx - sy * 0.5 + this.squashX.x - this.squashY.x * 0.5);
    const hh = DRIFT.puckHalf * (1 + sy - sx * 0.5 + this.squashY.x - this.squashX.x * 0.5);
    return { cx: b.x, cy: b.y, hw, hh, radius: DRIFT.puckRadius };
  }

  private fieldCanvas(): HTMLCanvasElement | null {
    if (this.field || typeof document === 'undefined') return this.field;
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    const g = c.getContext('2d');
    if (!g) return null;
    const put = (x: number, y: number, rgb: RGB) => {
      g.fillStyle = rgba(rgb, 1);
      g.fillRect(x, y, 1, 1);
    };
    put(0, 0, FIELD.livelyCool);
    put(1, 0, FIELD.livelyWarm);
    put(0, 1, FIELD.calmCool);
    put(1, 1, FIELD.calmWarm);
    this.field = c;
    return c;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const v = this.value;
    const color = fieldColor(v);
    const puck = this.puck();
    const { cx, cy, padHalf: P, padRadius } = DRIFT;

    let pad = withTint(TRACK, [0.82, 0.83, 0.94], 0.3);
    pad = { ...pad, bevel: 30, thickness: 12, frost: 0.3, milk: 0.85 };
    let puckM = withTint({ ...THUMB, bevel: 26, thickness: 40, frost: 0.06, aberration: 0.8, specular: 1.4 }, mixRGB([0.97, 0.97, 1], color, 0.25), 0.3);
    puckM = { ...withGlow(puckM, color, 0.22), halo: 0.35 };
    if (dark) {
      pad = smoked(pad, 0.85);
      puckM = smoked(puckM, 0.35);
    }

    const under = ctx.paint('drift-field', (g) => {
      const field = this.fieldCanvas();
      g.save();
      g.beginPath();
      g.roundRect(cx - P + 6, cy - P + 6, (P - 6) * 2, (P - 6) * 2, padRadius - 6);
      g.clip();
      g.globalAlpha = dark ? 0.5 : 0.62;
      if (field) {
        g.imageSmoothingEnabled = true;
        // sample from pixel centres so the corners carry the pure corner colours
        g.drawImage(field, 0.5, 0.5, 1, 1, cx - P, cy - P, P * 2, P * 2);
      }
      g.globalAlpha = 1;
      // the puck lights the field beneath it
      const glow = g.createRadialGradient(puck.cx, puck.cy, 4, puck.cx, puck.cy, 120);
      glow.addColorStop(0, rgba(mixRGB(color, [1, 1, 1], 0.4), dark ? 0.4 : 0.5));
      glow.addColorStop(1, rgba(color, 0));
      g.fillStyle = glow;
      g.fillRect(cx - P, cy - P, P * 2, P * 2);
      g.restore();
    });

    const grid = ctx.paint('drift-grid', (g) => {
      // a fine LED grid set into the pad; points brighten as the puck passes
      const n = 9;
      const span = TRAVEL * 2;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = DRIFT_BOUNDS.minX + (span * i) / (n - 1);
          const y = DRIFT_BOUNDS.minY + (span * j) / (n - 1);
          const d = Math.hypot(x - puck.cx, y - puck.cy);
          const k = clamp(1 - d / 140);
          g.fillStyle = dark ? `rgba(235,235,255,${0.16 + 0.5 * k})` : `rgba(60,56,96,${0.14 + 0.36 * k})`;
          const s = 2.2 + 1.4 * k;
          g.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      // axis hairlines through the centre
      g.fillStyle = dark ? 'rgba(235,235,255,0.1)' : 'rgba(60,56,96,0.1)';
      g.fillRect(cx - TRAVEL, cy - 0.5, TRAVEL * 2, 1);
      g.fillRect(cx - 0.5, cy - TRAVEL, 1, TRAVEL * 2);
    });

    const icon = ctx.paint('drift-icon', (g) => {
      drawPixels(g, this.icon.states(), puck.cx, puck.cy, 3.9, ctx.pxPerUnit, {
        gap: DOT_GAP,
        ink: glassInk(dark),
        scaleX: puck.hw / DRIFT.puckHalf,
        scaleY: puck.hh / DRIFT.puckHalf,
        glow: 2.5,
        glowAlpha: ledGlow(dark, 0.45),
      });
    });

    return {
      env: { kind: ctx.env, glowColor: color, glowPos: [puck.cx, puck.cy], glowRadius: 300, glowStrength: dark ? 0.16 : 0.1, brightness: 1, time: ctx.time },
      under,
      layers: [
        { shapes: [{ cx, cy, hw: P, hh: P, radius: padRadius, skew: 0, material: pad }], above: grid },
        { shapes: [{ ...puck, skew: 0, material: puckM, edge: this.edge.params(mixRGB(color, [1, 1, 1], 0.4)) }], above: icon },
      ],
    };
  }
}
