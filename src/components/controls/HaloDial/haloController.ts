import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterParam } from '../../../glass/geometry';
import { BEAD, CARD, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { haloSun } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { clamp, lerp, mixRGB, rgba } from '../shared/math';

export const HALO = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 214,
  radius: 156,
  arc: 122,
  bead: 17,
  startDeg: 135,
  sweepDeg: 270,
} as const;

const DEG = Math.PI / 180;

/** Screen-space angle (radians, clockwise, y down) of a value 0..100. */
export function valueToAngle(v: number): number {
  return (HALO.startDeg + (HALO.sweepDeg * clamp(v, 0, 100)) / 100) * DEG;
}

/**
 * Map a pointer angle to a value with stable behaviour at the discontinuity.
 * Inside the bottom gap the value clamps to the nearer end; a jump straight
 * across the gap (0 ↔ 100) is refused and the value stays at its end stop.
 */
export function valueFromAngle(angleDeg: number, prev: number): number {
  const rel = (((angleDeg - HALO.startDeg) % 360) + 360) % 360;
  let v: number;
  if (rel <= HALO.sweepDeg) v = (rel / HALO.sweepDeg) * 100;
  else v = rel > HALO.sweepDeg + (360 - HALO.sweepDeg) / 2 ? 0 : 100;
  if (Math.abs(v - prev) > 50) v = prev >= 50 ? 100 : 0;
  return v;
}

const WARM_LOW = [1.0, 0.86, 0.66] as const;
const WARM_HIGH = [1.0, 0.66, 0.28] as const;

/**
 * Halo: brightness dial. The value drives the arc, the bead, the sun's rays,
 * the warmth of the glass and the exposure of the studio surface – all from
 * one spring-smoothed display value, so they can never disagree.
 */
export class HaloController implements StageController {
  readonly display: Spring;
  private edge = new EdgeLight(0, 0);
  private sun: PixelMorpher;
  private rays = -1;
  private invalidate: () => void = () => undefined;
  dragging = false;
  private reducedMotion = false;

  constructor(value: number) {
    this.display = new Spring(value, SPRINGS.track);
    this.sun = new PixelMorpher(haloSun(value / 100));
    this.rays = Math.round((value / 100) * 16);
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.display.config = r ? reduced(SPRINGS.track) : SPRINGS.track;
  }

  setValue(v: number, immediate = false): void {
    if (immediate || this.reducedMotion) this.display.snap(v);
    else this.display.set(v);
    this.invalidate();
  }

  /** Activity pulse for the luminous perimeter. */
  touch(strength = 0.6): void {
    this.edge.impulse(strength);
    this.invalidate();
  }

  hitDial(x: number, y: number): boolean {
    return Math.hypot(x - HALO.cx, y - HALO.cy) <= HALO.radius + 24;
  }

  step(dt: number): boolean {
    const before = this.display.x;
    this.display.step(dt);
    const speed = Math.abs(this.display.x - before) / Math.max(dt, 1e-3);
    this.edge.update(0, 1, dt);
    if (speed > 1) this.edge.impulse(Math.min(0.6, speed / 200));
    const rays = Math.round((clamp(this.display.x, 0, 100) / 100) * 16);
    if (rays !== this.rays) {
      this.rays = rays;
      const px = haloSun(rays / 16);
      if (this.reducedMotion) this.sun.show(px);
      else this.sun.morphTo(px, { seed: rays + 2, stagger: 'random', duration: 0.3, maxDelay: 0.2, scatter: 0.4 });
    }
    const morphing = this.sun.step(dt);
    const settled = this.display.isSettled(0.01);
    if (settled) this.display.settle();
    return !settled || morphing || this.edge.active || this.dragging;
  }

  scene(ctx: SceneContext): GlassScene {
    const v = clamp(this.display.x, 0, 100) / 100;
    const dark = ctx.dark;
    const warm = mixRGB(WARM_LOW, WARM_HIGH, v);
    const theta = valueToAngle(v * 100);
    const bx = HALO.cx + Math.cos(theta) * HALO.arc;
    const by = HALO.cy + Math.sin(theta) * HALO.arc;

    let dial = withGlow(CARD, warm, 0.06 + 0.26 * v);
    dial = withTint(dial, mixRGB([1, 1, 1], warm, 0.5), 0.05 + 0.06 * v);
    dial = { ...dial, frost: 0.12, bevel: 42, thickness: 30, exposure: lerp(0.97, 1.05, v) };
    let bead = withGlow(BEAD, warm, 0.3 + 0.3 * v);
    if (dark) {
      dial = smoked(dial, 0.7);
      bead = smoked(bead, 0.4);
    }

    const above = ctx.paint('halo-arc', (g) => {
      const a0 = HALO.startDeg * DEG;
      const a1 = (HALO.startDeg + HALO.sweepDeg) * DEG;
      g.lineCap = 'round';
      g.lineWidth = 10;
      g.strokeStyle = dark ? 'rgba(220,220,255,0.12)' : 'rgba(60,50,80,0.10)';
      g.beginPath();
      g.arc(HALO.cx, HALO.cy, HALO.arc, a0, a1);
      g.stroke();
      if (v > 0.001) {
        const grad = g.createConicGradient(a0, HALO.cx, HALO.cy);
        grad.addColorStop(0, rgba(WARM_LOW, 0.9));
        grad.addColorStop(HALO.sweepDeg / 360, rgba(WARM_HIGH, 1));
        grad.addColorStop(1, rgba(WARM_HIGH, 1));
        g.save();
        g.shadowColor = rgba(warm, 0.8);
        g.shadowBlur = 14 * ctx.pxPerUnit;
        g.strokeStyle = grad;
        g.beginPath();
        g.arc(HALO.cx, HALO.cy, HALO.arc, a0, theta);
        g.stroke();
        g.restore();
      }
      // ticks every 10%
      for (let k = 0; k <= 10; k++) {
        const a = valueToAngle(k * 10);
        const lit = k / 10 <= v + 1e-6;
        g.strokeStyle = lit ? rgba(warm, 0.85) : dark ? 'rgba(220,220,255,0.22)' : 'rgba(60,50,80,0.2)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(HALO.cx + Math.cos(a) * (HALO.arc + 16), HALO.cy + Math.sin(a) * (HALO.arc + 16));
        g.lineTo(HALO.cx + Math.cos(a) * (HALO.arc + 21), HALO.cy + Math.sin(a) * (HALO.arc + 21));
        g.stroke();
      }
      drawPixels(g, this.sun.states(), HALO.cx, HALO.cy - 40, 4.4, ctx.pxPerUnit, { glow: 3 + 6 * v, glowAlpha: 0.25 + 0.5 * v });
    });

    // the perimeter glow follows the handle around the dial
    const head = perimeterParam(Math.cos(theta) * HALO.radius, -Math.sin(theta) * HALO.radius, {
      hw: HALO.radius,
      hh: HALO.radius,
      radius: HALO.radius,
    });
    const edge = this.edge.params(mixRGB(warm, [1, 1, 1], 0.2), 0.12 + 0.3 * v);

    return {
      env: {
        kind: ctx.env,
        glowColor: warm,
        glowPos: [HALO.cx, HALO.cy - 10],
        glowRadius: 230 + 120 * v,
        glowStrength: (dark ? 0.08 : 0.06) + 0.38 * v,
        brightness: dark ? lerp(0.85, 1.12, v) : lerp(0.86, 1.04, v),
        time: ctx.time,
      },
      layers: [
        {
          shapes: [
            {
              cx: HALO.cx,
              cy: HALO.cy,
              hw: HALO.radius,
              hh: HALO.radius,
              radius: HALO.radius,
              skew: 0,
              material: dial,
              edge: { ...edge, head, width: 0.06, trail: 0.12 },
            },
          ],
          above,
        },
        {
          shapes: [{ cx: bx, cy: by, hw: HALO.bead, hh: HALO.bead, radius: HALO.bead, skew: 0, material: bead }],
        },
      ],
    };
  }
}
