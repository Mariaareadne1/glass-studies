import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterParam } from '../../../glass/geometry';
import { BEAD, CARD, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { haloSun } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { DOT_GAP } from '../shared/ink';
import { clamp, lerp, mixRGB, rgba } from '../shared/math';

export const HALO = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 214,
  radius: 156,
  arc: 136,
  bead: 15,
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

    // V2: near-colourless pearl dial – deep lavender centre so light type reads,
    // a thick milky wall with strong spectral fringes, warmth rising with value
    let dial = withTint(CARD, [0.46, 0.47, 0.64], 0.7);
    dial = withGlow(dial, warm, 0.04 + 0.16 * v);
    dial = { ...dial, frost: 0.18, bevel: 46, thickness: 30, aberration: 1.0, milk: 0.95, specular: 1.2, halo: 0.25 * v };
    let bead = withGlow(BEAD, warm, 0.25 + 0.35 * v);
    bead = { ...bead, thickness: 12, halo: 0.5 * v };
    if (dark) {
      dial = smoked(dial, 0.7);
      bead = smoked(bead, 0.4);
    }

    // a faint orbit of light around the instrument, resting on the studio surface
    const under = ctx.paint('halo-orbit', (g) => {
      g.save();
      g.translate(HALO.cx, HALO.cy + 8);
      g.rotate(-0.22);
      g.scale(1, 0.26);
      const og = g.createLinearGradient(-230, 0, 230, 0);
      og.addColorStop(0, rgba(WARM_HIGH, 0.0));
      og.addColorStop(0.18, rgba(WARM_LOW, 0.55 * (0.4 + 0.6 * v)));
      og.addColorStop(0.55, 'rgba(200,190,255,0.25)');
      og.addColorStop(0.85, rgba([0.8, 0.85, 1], 0.4));
      og.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = og;
      g.lineWidth = 6;
      g.shadowColor = rgba(WARM_LOW, 0.6);
      g.shadowBlur = 10 * ctx.pxPerUnit;
      g.beginPath();
      g.ellipse(0, 0, 228, 228, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    });

    const above = ctx.paint('halo-arc', (g) => {
      const a0 = HALO.startDeg * DEG;
      const a1 = (HALO.startDeg + HALO.sweepDeg) * DEG;
      g.lineCap = 'round';
      // unlit channel: a whisper of white set into the rim
      g.lineWidth = 6;
      g.strokeStyle = dark ? 'rgba(220,220,255,0.12)' : 'rgba(255,255,255,0.28)';
      g.beginPath();
      g.arc(HALO.cx, HALO.cy, HALO.arc, a0, a1);
      g.stroke();
      if (v > 0.001) {
        // white-hot at the start, warming to amber at the handle (stops follow the value)
        const end = Math.max(0.001, (theta - a0) / (Math.PI * 2));
        const grad = g.createConicGradient(a0, HALO.cx, HALO.cy);
        grad.addColorStop(0, 'rgba(250,248,255,0.95)');
        grad.addColorStop(end * 0.45, rgba([1, 0.95, 0.86], 1));
        grad.addColorStop(end * 0.8, rgba([1, 0.8, 0.5], 1));
        grad.addColorStop(end, rgba(WARM_HIGH, 1));
        grad.addColorStop(Math.min(1, end + 0.001), rgba(WARM_HIGH, 0));
        // luminous bloom, then a white-hot core
        g.save();
        g.shadowColor = rgba(warm, 0.9);
        g.shadowBlur = 18 * ctx.pxPerUnit;
        g.strokeStyle = grad;
        g.lineWidth = 7;
        g.beginPath();
        g.arc(HALO.cx, HALO.cy, HALO.arc, a0, theta);
        g.stroke();
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(HALO.cx, HALO.cy, HALO.arc, a0, theta);
        g.stroke();
      }
      drawPixels(g, this.sun.states(), HALO.cx, HALO.cy - 44, 4.2, ctx.pxPerUnit, {
        gap: DOT_GAP,
        ink: (c) => mixRGB([1, 1, 1], c, 0.12 * v),
        glow: 3 + 5 * v,
        glowAlpha: 0.4 + 0.4 * v,
      });
    });

    // the perimeter glow follows the handle around the dial
    const head = perimeterParam(Math.cos(theta) * HALO.radius, -Math.sin(theta) * HALO.radius, {
      hw: HALO.radius,
      hh: HALO.radius,
      radius: HALO.radius,
    });
    const edge = this.edge.params(mixRGB(warm, [1, 1, 1], 0.3), 0.15 + 0.35 * v);

    return {
      env: {
        kind: ctx.env,
        glowColor: warm,
        glowPos: [HALO.cx, HALO.cy - 10],
        glowRadius: 230 + 120 * v,
        glowStrength: (dark ? 0.08 : 0.04) + 0.26 * v,
        brightness: dark ? lerp(0.85, 1.12, v) : lerp(0.9, 1.02, v),
        time: ctx.time,
      },
      under,
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
