import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterLength } from '../../../glass/geometry';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { clockNow } from '../../../motion/scheduler';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { ledPixels } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { DOT_GAP, glassInk, ledGlow } from '../shared/ink';
import { clamp, lerp, mixRGB, rgba } from '../shared/math';
import { HoldGesture } from './holdGesture';

export const DROP = {
  W: 640,
  H: 440,
  cx: 320,
  /** The drop rests in the dish: its lower third sits inside the dish glass. */
  cy: 214,
  r: 76,
  dishY: 284,
  dishHW: 200,
  dishHH: 30,
} as const;

const WATER: RGB = [0.45, 0.72, 1.0];
const DONE: RGB = [0.5, 0.86, 0.62];
const RIPPLE_SECONDS = 1.3;

/**
 * Droplet Press: a glass drop resting in a shallow dish. Press and hold and it
 * flattens and spreads while water rises inside; at the top the drop releases
 * – the icon re-forms as a check and ripples cross the dish. Let go early and
 * the water drains back.
 */
export class DropletController implements StageController {
  readonly hold: HoldGesture;
  private pressure = new Spring(0, SPRINGS.deform);
  private icon = new PixelMorpher(ledPixels('drop'));
  private edge = new EdgeLight(0.75, 1.2);
  private ripples: number[] = [];
  private clock = 0;
  private invalidate: () => void = () => undefined;
  private reducedMotion = false;
  private showingCheck = false;
  /** Called once per completed hold. */
  onConfirm: () => void = () => undefined;

  constructor(now: () => number = clockNow) {
    this.hold = new HoldGesture(now);
  }

  setOnConfirm(fn: () => void): void {
    this.onConfirm = fn;
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.pressure.config = r ? reduced(SPRINGS.deform) : SPRINGS.deform;
  }

  hitDrop(x: number, y: number): boolean {
    return Math.hypot(x - DROP.cx, y - DROP.cy) <= DROP.r + 14;
  }

  press(): void {
    this.hold.press();
    this.edge.impulse(0.25);
    this.invalidate();
  }

  release(): void {
    this.hold.release();
    this.invalidate();
  }

  cancel(): void {
    this.hold.cancel();
    this.invalidate();
  }

  step(dt: number): boolean {
    this.clock += dt;
    if (this.hold.update()) {
      this.onConfirm();
      this.edge.impulse(1);
      if (!this.reducedMotion) this.ripples.push(0, -0.22, -0.44);
      this.morph(true);
    }
    if (this.hold.phase === 'idle' && this.showingCheck && this.hold.visual < 0.6) this.morph(false);
    this.pressure.set(this.hold.isHeld && this.hold.phase !== 'confirmed' ? 1 : this.hold.isHeld ? 0.55 : 0);
    this.pressure.step(dt);
    this.ripples = this.ripples.map((t) => t + dt).filter((t) => t < RIPPLE_SECONDS);
    const morphing = this.icon.step(dt);
    const shape = this.shape();
    this.edge.update(this.reducedMotion ? 0 : this.pressure.v * 120, perimeterLength({ hw: shape.hw, hh: shape.hh, radius: shape.radius }), dt);
    return this.hold.active || !this.pressure.isSettled(0.002) || this.ripples.length > 0 || morphing || this.edge.active;
  }

  private morph(check: boolean): void {
    this.showingCheck = check;
    const target = ledPixels(check ? 'check' : 'drop');
    if (this.reducedMotion) this.icon.show(target);
    else this.icon.morphTo(target, { seed: check ? 11 : 12, stagger: 'radial', duration: 0.55 });
  }

  /** The drop flattens and spreads under pressure; the squash overshoots on release. */
  shape(): { cx: number; cy: number; hw: number; hh: number; radius: number } {
    const p = this.pressure.x;
    const swell = this.hold.phase === 'holding' ? Math.sin(this.clock * 9) * 0.6 * this.hold.visual : 0;
    // volume is (approximately) conserved: the footprint widens as the drop flattens
    const hw = DROP.r * (1 + 0.18 * p) + swell;
    const hh = (DROP.r * DROP.r) / hw;
    return { cx: DROP.cx, cy: DROP.cy + (DROP.r - hh) * 0.95, hw, hh, radius: Math.min(hw, hh) };
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const fill = this.hold.visual;
    const done = this.hold.phase === 'confirmed' ? 1 : 0;
    const tint = mixRGB(WATER, DONE, done * 0.7);
    const shape = this.shape();

    let dish = withTint(TRACK, [0.78, 0.8, 0.92], 0.4);
    dish = { ...withGlow(dish, tint, 0.04 + 0.1 * fill), bevel: 22, thickness: 10, milk: 0.9 };
    let drop = withTint({ ...THUMB, bevel: 54, thickness: 50, frost: 0.08, aberration: 0.8, specular: 1.45 }, [0.92, 0.95, 1.0], 0.2);
    drop = { ...withGlow(drop, tint, 0.08 + 0.32 * fill), halo: 0.2 + 0.5 * fill };
    if (dark) {
      dish = smoked(dish);
      drop = smoked(drop, 0.3);
    }

    const under = ctx.paint('droplet-under', (g) => {
      // ripples crossing the dish after a release
      this.ripples.forEach((t) => {
        if (t < 0) return;
        const k = t / RIPPLE_SECONDS;
        g.strokeStyle = rgba(tint, (1 - k) * (dark ? 0.55 : 0.7));
        g.lineWidth = 2.4 * (1 - k) + 0.6;
        g.beginPath();
        g.ellipse(DROP.cx, DROP.dishY - 2, 40 + k * 180, (40 + k * 180) * 0.16, 0, 0, Math.PI * 2);
        g.stroke();
      });
      // water inside the drop, rising with the hold; the surface sways
      if (fill > 0.002) {
        const top = shape.cy + shape.hh - fill * shape.hh * 2;
        g.save();
        g.beginPath();
        g.ellipse(shape.cx, shape.cy, shape.hw - 4, shape.hh - 4, 0, 0, Math.PI * 2);
        g.clip();
        const water = g.createLinearGradient(0, top, 0, shape.cy + shape.hh);
        water.addColorStop(0, rgba(mixRGB(tint, [1, 1, 1], 0.45), dark ? 0.7 : 0.8));
        water.addColorStop(1, rgba(tint, dark ? 0.85 : 0.75));
        g.fillStyle = water;
        g.beginPath();
        g.moveTo(shape.cx - shape.hw, shape.cy + shape.hh);
        for (let x = -shape.hw; x <= shape.hw; x += 6) {
          const amp = this.reducedMotion ? 0 : 3.2 * (1 - fill * 0.5);
          g.lineTo(shape.cx + x, top + Math.sin(x * 0.07 + this.clock * 5) * amp);
        }
        g.lineTo(shape.cx + shape.hw, shape.cy + shape.hh);
        g.closePath();
        g.fill();
        g.restore();
      }
    });

    const icon = ctx.paint('droplet-icon', (g) => {
      const ink = glassInk(dark);
      drawPixels(g, this.icon.states(), shape.cx, shape.cy - 4 - fill * 6, lerp(4.4, 4.0, this.pressure.x), ctx.pxPerUnit, {
        gap: DOT_GAP,
        ink: fill > 0.55 && !dark ? (c) => mixRGB(ink(c), [1, 1, 1], clamp((fill - 0.55) * 2.4)) : ink,
        scaleX: shape.hw / DROP.r,
        scaleY: shape.hh / DROP.r,
        glow: 3,
        glowAlpha: ledGlow(dark, 0.5),
      });
    });

    return {
      env: {
        kind: ctx.env,
        glowColor: tint,
        glowPos: [DROP.cx, DROP.dishY],
        glowRadius: 260,
        glowStrength: (dark ? 0.1 : 0.06) + 0.14 * fill,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        { shapes: [{ cx: DROP.cx, cy: DROP.dishY, hw: DROP.dishHW, hh: DROP.dishHH, radius: DROP.dishHH, skew: 0, material: dish }] },
        { shapes: [{ ...shape, skew: 0, material: drop, edge: this.edge.params(mixRGB(tint, [1, 1, 1], 0.4)) }], above: icon },
      ],
    };
  }
}
