import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterLength } from '../../../glass/geometry';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene } from '../../../glass/types';
import { Deformer } from '../../../motion/deformation';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { iconPixels } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { clamp, lerp, mixRGB, rubber, smoothstep } from '../shared/math';
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
  const projected = position + velocity * 0.12;
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
    this.morph.progress = smoothstep(0.06, 0.94, this.morphP.x);
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

    let track = withGlow(TRACK, glowColor, 0.05 + 0.03 * warm);
    let thumb = withTint(THUMB, mixRGB([0.6, 0.6, 0.95], [1, 0.84, 0.6], warm), 0.08 + 0.04 * (1 - warm));
    thumb = withGlow(thumb, glowColor, 0.16 + 0.06 * warm);
    thumb = { ...thumb, exposure: lerp(0.96, 1.04, warm) };
    if (dark) {
      track = smoked(track);
      thumb = smoked(thumb, 0.6);
    }

    const icon = ctx.paint('solar-icon', (g) => {
      drawPixels(g, this.morph.states(), tx, SOLAR.cy, 7, ctx.pxPerUnit, {
        glow: dark ? 5 : 0,
        glowAlpha: 0.7,
        scaleX: d.along,
        scaleY: d.across,
      });
    });

    const under = ctx.paint('solar-under', (g) => {
      // faint end-stop glyphs resting on the studio surface inside the track;
      // each fades as the thumb covers it so the tile never shows a ghost
      const fade = (x: number) => smoothstep(SOLAR.thumb * 0.6, SOLAR.thumb * 1.6, Math.abs(tx - x));
      const a = dark ? 0.5 : 0.34;
      drawPixels(g, iconPixels('moon').map((px) => ({ ...px, alpha: a * fade(X0), size: 1 })), X0, SOLAR.cy, 3, ctx.pxPerUnit);
      drawPixels(g, iconPixels('sun').map((px) => ({ ...px, alpha: a * fade(X1), size: 1 })), X1, SOLAR.cy, 3, ctx.pxPerUnit);
    });

    return {
      env: {
        kind: ctx.env,
        glowColor,
        glowPos: [tx, SOLAR.cy + 10],
        glowRadius: 300,
        glowStrength: dark ? 0.28 : 0.3,
        brightness: dark ? 1 : lerp(0.985, 1.01, warm),
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [{ cx: SOLAR.cx, cy: SOLAR.cy, hw: SOLAR.trackHW, hh: SOLAR.trackHH, radius: SOLAR.trackHH, skew: 0, material: track }],
          above: icon,
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
              edge: this.edge.params(edgeColor),
            },
          ],
        },
      ],
    };
  }
}
