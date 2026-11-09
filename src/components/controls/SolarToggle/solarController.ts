import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterLength, perimeterParam } from '../../../glass/geometry';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { Deformer } from '../../../motion/deformation';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { iconPixels } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { blendInk, darkWarmInk, DOT_GAP, glassInk, lightInk } from '../shared/ink';
import { clamp, lerp, mixRGB, rgba, rubber, smoothstep } from '../shared/math';
import { LIGHT } from '../shared/palette';

export const SOLAR = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 220,
  trackHW: 204,
  trackHH: 80,
  thumb: 68,
  inset: 12,
} as const;

const X0 = SOLAR.cx - SOLAR.trackHW + SOLAR.inset + SOLAR.thumb;
const X1 = SOLAR.cx + SOLAR.trackHW - SOLAR.inset - SOLAR.thumb;
export const SOLAR_TRAVEL = X1 - X0;

/** Release policy: project the thumb forward by its velocity, then snap to the nearer end. */
export function solarSnapTarget(position: number, velocity: number): 0 | 1 {
  const projected = position + Math.max(-0.45, Math.min(0.45, velocity * 0.12));
  return projected >= 0.5 ? 1 : 0;
}

export function positionToX(p: number): number {
  return X0 + p * SOLAR_TRAVEL;
}

/**
 * Solar: owns the spring, deformation, edge light and the scrubbed moon→sun
 * pixel morph. Semantic state lives in solarStore; this object only renders it.
 */
export class SolarController implements StageController {
  pos: Spring;
  private deform = new Deformer(0.0011, 0.15);
  private edge = new EdgeLight(0.18, 2.6);
  private morph: PixelMorpher;
  /** Morph progress trails the thumb slightly so squares keep drifting after it lands. */
  private morphP: Spring;
  private invalidate: () => void = () => undefined;
  dragging = false;
  private grab = 0;
  private reducedMotion = false;
  private lastDeform = { along: 1, across: 1, lean: 0 };

  constructor(on: boolean) {
    this.pos = new Spring(on ? 1 : 0, SPRINGS.travel);
    this.morph = new PixelMorpher(iconPixels(on ? 'sun' : 'moon'));
    this.morph.setScrub(iconPixels('moon'), iconPixels('sun'), { seed: 3, stagger: 'sweep-x', maxDelay: 0.42, scatter: 2.2 });
    this.morph.progress = on ? 1 : 0;
    this.morphP = new Spring(on ? 1 : 0, SPRINGS.trail);
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.pos.config = r ? reduced(SPRINGS.travel) : SPRINGS.travel;
  }

  /** Move toward a semantic state (from store, keyboard, click). */
  setOn(on: boolean): void {
    const t = on ? 1 : 0;
    if (this.pos.target !== t && !this.dragging) {
      this.edge.impulse(0.85, t > this.pos.x ? 1 : -1);
    }
    if (!this.dragging) this.pos.set(t);
    this.invalidate();
  }

  hitThumb(x: number, y: number): boolean {
    const cx = positionToX(this.pos.x);
    return Math.abs(x - cx) <= SOLAR.thumb + 8 && Math.abs(y - SOLAR.cy) <= SOLAR.thumb + 8;
  }

  hitTrack(x: number, y: number): boolean {
    return Math.abs(x - SOLAR.cx) <= SOLAR.trackHW + 6 && Math.abs(y - SOLAR.cy) <= SOLAR.trackHH + 6;
  }

  beginDrag(x: number): void {
    this.dragging = true;
    this.grab = x - positionToX(this.pos.x);
    this.edge.impulse(0.5);
    this.invalidate();
  }

  drag(x: number, vx: number): void {
    const raw = (x - this.grab - X0) / SOLAR_TRAVEL;
    const p = raw < 0 ? rubber(raw) : raw > 1 ? 1 + rubber(raw - 1) : raw;
    this.pos.snap(p, vx / SOLAR_TRAVEL);
    this.invalidate();
  }

  /** Returns the chosen state. */
  endDrag(vx: number): boolean {
    this.dragging = false;
    const v = vx / SOLAR_TRAVEL;
    const target = solarSnapTarget(this.pos.x, v);
    this.pos.v = clamp(v, -12, 12);
    this.pos.set(target);
    this.edge.impulse(0.7, target > this.pos.x ? 1 : -1);
    this.invalidate();
    return target === 1;
  }

  step(dt: number): boolean {
    if (!this.dragging) this.pos.step(dt);
    const velocity = this.pos.v * SOLAR_TRAVEL;
    this.lastDeform = this.reducedMotion ? { along: 1, across: 1, lean: 0 } : this.deform.update(velocity, dt);
    const perim = perimeterLength({ hw: SOLAR.thumb, hh: SOLAR.thumb, radius: 44 });
    this.edge.update(this.reducedMotion ? 0 : velocity, perim, dt);
    // the icon morph is scrubbed by the thumb itself – fully reversible
    this.morphP.set(clamp(this.pos.x));
    if (this.reducedMotion) this.morphP.snap(clamp(this.pos.x));
    else this.morphP.step(dt);
    // reduced motion: no particle flourish – the icon changes cleanly at the midpoint
    this.morph.progress = this.reducedMotion ? (this.pos.x >= 0.5 ? 1 : 0) : smoothstep(0.06, 0.94, this.morphP.x);
    const settled = this.pos.isSettled(4e-4);
    if (settled && !this.dragging) this.pos.settle();
    const morphSettled = this.morphP.isSettled(1e-3);
    if (morphSettled) this.morphP.settle();
    return this.dragging || !settled || !morphSettled || this.deform.active || this.edge.active;
  }

  scene(ctx: SceneContext): GlassScene {
    const p = this.pos.x;
    const warm = smoothstep(0.1, 0.9, p);
    // Past an end stop the glass compresses against the rim instead of passing it.
    const over = p > 1 ? p - 1 : p < 0 ? -p : 0;
    const tx = positionToX(clamp(p) + Math.sign(p - 0.5) * over * 0.25);
    const squash = (over * SOLAR_TRAVEL * 0.75) / (SOLAR.thumb * 2);
    const d0 = this.lastDeform;
    const d = { along: d0.along - squash, across: d0.across + squash * 0.6, lean: d0.lean };
    const dark = ctx.dark;

    const glowColor = mixRGB(LIGHT.moon, LIGHT.sun, warm);
    const edgeColor = mixRGB(LIGHT.moonEdge, LIGHT.sunEdge, warm);

    // V2 pearl optics: neutral lavender capsule; the thumb is cool silver glass at
    // night and creamy, sun-warmed glass by day, spilling a soft warm halo.
    let track = withGlow(TRACK, glowColor, 0.04 + 0.04 * warm);
    let thumb = withTint(THUMB, mixRGB([0.80, 0.81, 0.93], [1.0, 0.95, 0.88], warm), lerp(0.4, 0.52, warm));
    thumb = withGlow(thumb, mixRGB(LIGHT.moonEdge, [1, 0.74, 0.4], warm), lerp(0.12, 0.34, warm));
    thumb = { ...thumb, exposure: lerp(0.97, 1.03, warm), halo: lerp(0.25, 0.9, warm) };
    if (dark) {
      track = smoked(track);
      thumb = smoked(thumb, 0.5);
    }

    const speed = Math.abs(this.pos.v);
    const icon = ctx.paint('solar-icon', (g) => {
      // LED dots on the thumb surface: white moon on silver glass, dark warm sun on cream
      drawPixels(g, this.morph.states(), tx, SOLAR.cy, 6.6, ctx.pxPerUnit, {
        gap: DOT_GAP,
        // ink follows the morph itself, so the moon never turns dark before it becomes the sun
        ink: blendInk(glassInk(dark), dark ? lightInk : darkWarmInk, smoothstep(0.55, 0.95, this.morph.progress)),
        glow: (1 - warm) * 4 + (dark ? 3 : 0),
        // the warm day ink keeps its full glow; on light studios the dark night ink barely glows
        glowAlpha: dark ? 0.55 : 0.55 * lerp(0.2, 1, smoothstep(0.55, 0.95, this.morph.progress)),
        scaleX: d.along,
        scaleY: d.across,
      });
    });

    const under = ctx.paint('solar-under', (g) => {
      // state light pooled under the capsule: cool lavender-blue on the moon side,
      // warm peach near the sun – the reference's graded track interior
      const pool = (x: number, c: RGB, a: number, r: number) => {
        const grad = g.createRadialGradient(x, SOLAR.cy, 4, x, SOLAR.cy, r);
        grad.addColorStop(0, rgba(c, a));
        grad.addColorStop(1, rgba(c, 0));
        g.fillStyle = grad;
        g.fillRect(x - r, SOLAR.cy - r, r * 2, r * 2);
      };
      // clipped to the capsule so the colour lives inside the glass, not around it
      g.save();
      g.beginPath();
      g.roundRect(SOLAR.cx - SOLAR.trackHW + 4, SOLAR.cy - SOLAR.trackHH + 4, SOLAR.trackHW * 2 - 8, SOLAR.trackHH * 2 - 8, SOLAR.trackHH);
      g.clip();
      pool(X0 - 20, [0.55, 0.62, 1.0], (dark ? 0.35 : 0.45) * (1 - warm * 0.6), 220);
      pool(X1 + 20, [1.0, 0.72, 0.42], (dark ? 0.3 : 0.55) * warm, 220);
      g.restore();
    });

    const echoes = ctx.paint('solar-echo', (g) => {
      // faint end-stop glyphs inside the capsule, fading as the thumb covers them
      const fade = (x: number) => smoothstep(SOLAR.thumb * 0.6, SOLAR.thumb * 1.6, Math.abs(tx - x));
      const a = 0.55;
      drawPixels(g, iconPixels('moon').map((px) => ({ ...px, alpha: a * fade(X0), size: 1 })), X0, SOLAR.cy, 3, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark) });
      drawPixels(g, iconPixels('sun').map((px) => ({ ...px, alpha: a * fade(X1), size: 1 })), X1, SOLAR.cy, 3, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark) });
      // motion echoes: the icon leaves a short dotted wake while the thumb travels
      if (!this.reducedMotion && speed > 0.4) {
        const dir = Math.sign(this.pos.v);
        for (let k = 1; k <= 3; k++) {
          const ex = tx - dir * k * 34;
          const a2 = Math.min(1, (speed - 0.4) / 3) * (0.42 - k * 0.11);
          if (a2 <= 0) continue;
          drawPixels(g, this.morph.states().map((px) => ({ ...px, alpha: px.alpha * a2 })), ex, SOLAR.cy, 6.6 * (1 - k * 0.14), ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark) });
        }
      }
    });

    // the warm arc also catches the capsule rim just above the thumb
    const trackRect = { hw: SOLAR.trackHW, hh: SOLAR.trackHH, radius: SOLAR.trackHH };
    // by day a thin amber arc rests on the upper rim (quiet), brightening with motion
    const thumbEdge = this.edge.params(edgeColor, (dark ? 0.15 : 0.3) * warm);
    const trackEdge = {
      ...thumbEdge,
      head: perimeterParam(tx - SOLAR.cx + 30, SOLAR.trackHH, trackRect),
      intensity: thumbEdge.intensity * 0.6 + (dark ? 0.2 : 0.5) * warm,
      width: 0.03,
      trail: 0.07,
      direction: 1,
    };

    return {
      env: {
        kind: ctx.env,
        glowColor,
        glowPos: [tx, SOLAR.cy + 10],
        glowRadius: 300,
        glowStrength: dark ? 0.2 : 0.12,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [{ cx: SOLAR.cx, cy: SOLAR.cy, hw: SOLAR.trackHW, hh: SOLAR.trackHH, radius: SOLAR.trackHH, skew: 0, material: track, edge: trackEdge }],
          above: echoes,
        },
        {
          shapes: [
            {
              cx: tx,
              cy: SOLAR.cy,
              hw: SOLAR.thumb * d.along,
              hh: SOLAR.thumb * d.across,
              radius: 44,
              skew: d.lean,
              material: thumb,
              edge: thumbEdge,
            },
          ],
          above: icon,
        },
      ],
    };
  }
}
