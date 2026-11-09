import type { SceneContext } from '../../glass/GlassStage';
import { CARD, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { GlassScene, RGB } from '../../glass/types';
import { mixRGB, rgba } from '../controls/shared/math';
import { LOADER, LoopController, phase } from './loopController';

export const TIDE_PERIOD = 3.6;
const HW = 104;
const HH = 156;
const RADIUS = 40;
const SHALLOW: RGB = [0.62, 0.86, 1.0];
const DEEP: RGB = [0.52, 0.54, 0.98];
const BUBBLES = [
  [0.22, 0.0, 3],
  [0.48, 0.35, 4],
  [0.7, 0.6, 3],
  [0.36, 0.78, 2],
  [0.6, 0.15, 2],
] as const;

/** Fill level 0..1 over one tide: rises then drains, with no seam at the loop. */
export function tideLevel(t: number): number {
  return 0.12 + 0.76 * (0.5 - 0.5 * Math.cos(phase(t, TIDE_PERIOD) * Math.PI * 2));
}

/**
 * Tide Fill Loader: a glass vessel that slowly fills and drains. The surface
 * sways, a bright meniscus clings to the glass and small LED bubbles rise
 * through the water; all of it is seen through the vessel wall.
 */
export class TideLoader extends LoopController {
  constructor() {
    super(TIDE_PERIOD * 0.3);
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = LOADER;
    const level = this.reducedMotion ? 0.56 : tideLevel(this.t);
    const glow = this.reducedMotion ? 0.5 + 0.5 * Math.cos(this.t * 1.6) : level;
    let vessel = withTint({ ...CARD, bevel: 40, thickness: 30, frost: 0.06, aberration: 0.75, specular: 1.35, milk: 0.85 }, [0.9, 0.93, 1], 0.18);
    vessel = { ...withGlow(vessel, SHALLOW, 0.08 + 0.12 * glow), halo: 0.15 + 0.15 * glow };
    if (dark) vessel = smoked(vessel, 0.45);

    const under = ctx.paint('tide-loader-water', (g) => {
      const left = cx - HW + 8;
      const right = cx + HW - 8;
      const bottom = cy + HH - 8;
      const top = bottom - level * (HH * 2 - 16);
      g.save();
      g.beginPath();
      g.roundRect(left, cy - HH + 8, right - left, HH * 2 - 16, RADIUS - 8);
      g.clip();
      const water = g.createLinearGradient(0, top, 0, bottom);
      water.addColorStop(0, rgba(SHALLOW, dark ? 0.72 : 0.82));
      water.addColorStop(1, rgba(DEEP, dark ? 0.82 : 0.86));
      g.fillStyle = water;
      const amp = this.reducedMotion ? 0 : 5;
      const surface = (x: number) => top + Math.sin(x * 0.045 + this.t * 3.1) * amp + Math.sin(x * 0.09 - this.t * 2.2) * amp * 0.4;
      g.beginPath();
      g.moveTo(left, bottom);
      for (let x = left; x <= right; x += 4) g.lineTo(x, surface(x));
      g.lineTo(right, bottom);
      g.closePath();
      g.fill();
      // the meniscus: a bright line riding the surface
      g.strokeStyle = rgba(mixRGB(SHALLOW, [1, 1, 1], 0.7), dark ? 0.75 : 0.95);
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(left, surface(left));
      for (let x = left + 4; x <= right; x += 4) g.lineTo(x, surface(x));
      g.stroke();
      // LED bubbles rising through the water
      if (!this.reducedMotion) {
        BUBBLES.forEach(([fx, offset, size]) => {
          const k = phase(this.t / 2.4 + offset, 1);
          const y = bottom - k * (bottom - top);
          const x = left + fx * (right - left) + Math.sin(this.t * 2 + offset * 9) * 4;
          if (y < surface(x) + 4) return;
          g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k * 0.6)})`;
          const s = size * 2;
          g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        });
      }
      g.restore();
    });

    return {
      env: { kind: ctx.env, glowColor: SHALLOW, glowPos: [cx, cy + HH * (1 - level)], glowRadius: 260, glowStrength: dark ? 0.14 : 0.08, brightness: 1, time: ctx.time },
      under,
      layers: [{ shapes: [{ cx, cy, hw: HW, hh: HH, radius: RADIUS, skew: 0, material: vessel }] }],
    };
  }
}
