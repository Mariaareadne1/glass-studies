import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterLength } from '../../../glass/geometry';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import type { SpringConfig } from '../../../motion/spring';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import type { DriftMode, DriftValue } from '../../../state/controls';
import { DOT_GAP, glassInk, ledGlow } from '../shared/ink';
import { clamp, mixRGB, rgba } from '../shared/math';
import { DRIFT, fieldColor, glyphKey, toPosition, toValue, TRAVEL, windGlyph } from './windMath';

export { DRIFT, toPosition, toValue } from './windMath';

/** The glass lags the orb a little: a soft follower spring for stretch and shadow. */
const LAG: SpringConfig = { stiffness: 260, damping: 20, mass: 1 };
const RETURN: SpringConfig = { stiffness: 140, damping: 16, mass: 1 };

/**
 * Drift Pad: a two-axis wind control. The orb follows the hand exactly – the
 * value is never smoothed – while a follower spring drives the secondary
 * glass stretch, so the surface lags and catches up. Release either holds the
 * last position or springs back to centre (both the value and the orb). As the
 * orb nears a wall the glass compresses toward it ("refractive stress").
 */
export class DriftController implements StageController {
  /** Exact orb position (design units). */
  x: number;
  y: number;
  private fx: Spring;
  private fy: Spring;
  private gx: Spring;
  private gy: Spring;
  private edge = new EdgeLight(0.3, 1.6);
  private icon: PixelMorpher;
  private glyph: string;
  private state: 'rest' | 'drag' | 'return' = 'rest';
  private mode: DriftMode = 'hold';
  private field: HTMLCanvasElement | null = null;
  private invalidate: () => void = () => undefined;
  private reducedMotion = false;

  constructor(v: DriftValue) {
    const p = toPosition(v);
    this.x = p.x;
    this.y = p.y;
    this.fx = new Spring(p.x, LAG);
    this.fy = new Spring(p.y, LAG);
    this.gx = new Spring(p.x, RETURN);
    this.gy = new Spring(p.y, RETURN);
    this.glyph = glyphKey(v);
    this.icon = new PixelMorpher(windGlyph(v));
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.gx.config = this.gy.config = r ? reduced(RETURN) : RETURN;
    this.fx.config = this.fy.config = r ? reduced(LAG) : LAG;
  }

  setMode(m: DriftMode): void {
    this.mode = m;
  }

  get value(): DriftValue {
    return toValue(this.x, this.y);
  }

  get dragging(): boolean {
    return this.state === 'drag';
  }

  hitPuck(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= DRIFT.puckHalf + 12 && Math.abs(y - this.y) <= DRIFT.puckHalf + 12;
  }

  hitPad(x: number, y: number): boolean {
    return Math.abs(x - DRIFT.cx) <= DRIFT.padHalf && Math.abs(y - DRIFT.cy) <= DRIFT.padHalf;
  }

  beginDrag(): void {
    this.state = 'drag';
    this.edge.impulse(0.4);
    this.invalidate();
  }

  /** Direct manipulation: the orb is exactly where the hand puts it (clamped to the pad). */
  dragTo(x: number, y: number): void {
    const p = toPosition(toValue(x, y));
    this.x = p.x;
    this.y = p.y;
    this.invalidate();
  }

  /** Let go: hold keeps the exact position; spring returns to centre. Returns the resulting value. */
  release(): DriftValue {
    this.state = 'rest';
    if (this.mode === 'spring') {
      this.glideTo({ x: 0, y: 0 });
      return { x: 0, y: 0 };
    }
    this.invalidate();
    return this.value;
  }

  /** Keyboard, reset or spring return: the orb glides to a value. */
  glideTo(v: DriftValue): void {
    if (this.state === 'drag') return;
    const p = toPosition(v);
    if (this.reducedMotion) {
      this.x = p.x;
      this.y = p.y;
      this.state = 'rest';
      this.invalidate();
      return;
    }
    this.gx.snap(this.x, this.gx.v);
    this.gy.snap(this.y, this.gy.v);
    this.gx.set(p.x);
    this.gy.set(p.y);
    this.state = 'return';
    this.invalidate();
  }

  step(dt: number): boolean {
    if (this.state === 'return') {
      this.gx.step(dt);
      this.gy.step(dt);
      this.x = this.gx.x;
      this.y = this.gy.x;
      if (this.gx.isSettled(0.05) && this.gy.isSettled(0.05)) {
        this.gx.settle();
        this.gy.settle();
        this.x = this.gx.x;
        this.y = this.gy.x;
        this.state = 'rest';
      }
    }
    this.fx.set(this.x);
    this.fy.set(this.y);
    this.fx.step(dt);
    this.fy.step(dt);
    const key = glyphKey(this.value);
    if (key !== this.glyph) {
      this.glyph = key;
      const next = windGlyph(this.value);
      if (this.reducedMotion) this.icon.show(next);
      else this.icon.morphTo(next, { seed: 21, stagger: 'sweep-x', direction: this.value.x >= 0 ? 1 : -1, duration: 0.42 });
    }
    const morphing = this.icon.step(dt);
    const lag = Math.hypot(this.x - this.fx.x, this.y - this.fy.x);
    this.edge.update(this.reducedMotion ? 0 : lag * 40, perimeterLength({ hw: DRIFT.puckHalf, hh: DRIFT.puckHalf, radius: DRIFT.puckRadius }), dt);
    const following = !this.fx.isSettled(0.05) || !this.fy.isSettled(0.05);
    return this.state !== 'rest' || following || morphing || this.edge.active;
  }

  /**
   * Orb glass: centred exactly on the value, stretched along the lag of the
   * follower spring (secondary motion) and compressed toward a nearby wall.
   */
  puck(): { cx: number; cy: number; hw: number; hh: number; radius: number } {
    const dx = this.reducedMotion ? 0 : this.x - this.fx.x;
    const dy = this.reducedMotion ? 0 : this.y - this.fy.x;
    const sx = clamp(Math.abs(dx) / 160, 0, 0.16);
    const sy = clamp(Math.abs(dy) / 160, 0, 0.16);
    const v = this.value;
    const wx = clamp((Math.abs(v.x) - 0.75) / 0.25) * 0.08;
    const wy = clamp((Math.abs(v.y) - 0.75) / 0.25) * 0.08;
    const hw = DRIFT.puckHalf * (1 + sx - sy * 0.5 - wx + wy * 0.5);
    const hh = DRIFT.puckHalf * (1 + sy - sx * 0.5 - wy + wx * 0.5);
    return { cx: this.x, cy: this.y, hw, hh, radius: DRIFT.puckRadius };
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
    put(0, 0, fieldColor({ x: -1, y: 1 }));
    put(1, 0, fieldColor({ x: 1, y: 1 }));
    put(0, 1, fieldColor({ x: -1, y: -1 }));
    put(1, 1, fieldColor({ x: 1, y: -1 }));
    this.field = c;
    return c;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const v = this.value;
    const color = fieldColor(v);
    const puck = this.puck();
    const { cx, cy, padHalf: P, padRadius } = DRIFT;
    // stress: the pad wall the orb approaches catches a little more light
    const stress = clamp((Math.max(Math.abs(v.x), Math.abs(v.y)) - 0.7) / 0.3);

    let pad = withTint(TRACK, [0.86, 0.87, 0.95], 0.28);
    pad = { ...pad, bevel: 30, thickness: 12 + 6 * stress, frost: 0.28, milk: 0.7 };
    let puckM = withTint({ ...THUMB, bevel: 30, thickness: 42, frost: 0.03, aberration: 0.35, specular: 1.4, milk: 0.5 }, mixRGB([0.98, 0.98, 1], color, 0.15), 0.2);
    puckM = { ...withGlow(puckM, color, 0.12), halo: 0.2 };
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
      g.globalAlpha = dark ? 0.4 : 0.5;
      if (field) {
        g.imageSmoothingEnabled = true;
        g.drawImage(field, 0.5, 0.5, 1, 1, cx - P, cy - P, P * 2, P * 2);
      }
      g.globalAlpha = 1;
      // guide axes and a crosshair under the orb (the orb's single crisp reflection rides on it)
      g.fillStyle = dark ? 'rgba(235,235,255,0.12)' : 'rgba(60,56,96,0.12)';
      g.fillRect(cx - TRAVEL, cy - 0.5, TRAVEL * 2, 1);
      g.fillRect(cx - 0.5, cy - TRAVEL, 1, TRAVEL * 2);
      g.fillStyle = dark ? 'rgba(235,235,255,0.22)' : 'rgba(60,56,96,0.2)';
      g.fillRect(puck.cx - 22, puck.cy - 0.5, 44, 1);
      g.fillRect(puck.cx - 0.5, puck.cy - 22, 1, 44);
      g.restore();
    });

    const grid = ctx.paint('drift-grid', (g) => {
      const n = 9;
      const span = TRAVEL * 2;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = cx - TRAVEL + (span * i) / (n - 1);
          const y = cy - TRAVEL + (span * j) / (n - 1);
          const d = Math.hypot(x - puck.cx, y - puck.cy);
          const k = clamp(1 - d / 140);
          g.fillStyle = dark ? `rgba(235,235,255,${0.12 + 0.4 * k})` : `rgba(60,56,96,${0.1 + 0.3 * k})`;
          const s = 2 + 1.2 * k;
          g.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
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
      env: { kind: ctx.env, glowColor: color, glowPos: [puck.cx, puck.cy], glowRadius: 300, glowStrength: dark ? 0.12 : 0.06, brightness: 1, time: ctx.time },
      under,
      layers: [
        { shapes: [{ cx, cy, hw: P, hh: P, radius: padRadius, skew: 0, material: pad }], above: grid },
        { shapes: [{ ...puck, skew: 0, material: puckM, edge: this.edge.params(mixRGB(color, [1, 1, 1], 0.5)) }], above: icon },
      ],
    };
  }
}

export const DRIFT_SPRINGS = { LAG, RETURN, deform: SPRINGS.deform };
