import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { CARD, THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { Deformer } from '../../../motion/deformation';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { iconPixels } from '../../../pixels/iconDefinitions';
import type { IconName } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { THERMAL_MAX, THERMAL_MIN, THERMAL_STEP } from '../../../state/controls';
import { clamp, rampRGB, rgba, rubber } from '../shared/math';

export const THERMAL = {
  W: 640,
  H: 440,
  trackX: 232,
  cy: 220,
  trackHW: 40,
  trackHH: 172,
  thumbHW: 33,
  thumbHH: 27,
  inset: 9,
  cardX: 440,
  cardHW: 128,
  cardHH: 96,
} as const;

/** y of the thumb centre at the coldest and warmest values. */
export const THERMAL_Y0 = THERMAL.cy + THERMAL.trackHH - THERMAL.inset - THERMAL.thumbHH;
export const THERMAL_Y1 = THERMAL.cy - THERMAL.trackHH + THERMAL.inset + THERMAL.thumbHH;

/** Vertical mapping: up is warmer. */
export function tempToY(t: number): number {
  const k = (t - THERMAL_MIN) / (THERMAL_MAX - THERMAL_MIN);
  return THERMAL_Y0 + (THERMAL_Y1 - THERMAL_Y0) * k;
}

export function yToTemp(y: number): number {
  const k = (y - THERMAL_Y0) / (THERMAL_Y1 - THERMAL_Y0);
  return THERMAL_MIN + clamp(k) * (THERMAL_MAX - THERMAL_MIN);
}

export function snapTemp(t: number): number {
  return clamp(Math.round(t / THERMAL_STEP) * THERMAL_STEP, THERMAL_MIN, THERMAL_MAX);
}

export type ThermalIcon = 'snow' | 'partly' | 'sun';

export function iconForTemp(t: number): ThermalIcon {
  if (t < 17) return 'snow';
  if (t <= 26) return 'partly';
  return 'sun';
}

const RAMP: RGB[] = [[0.45, 0.66, 1.0], [0.62, 0.78, 1.0], [0.9, 0.9, 0.95], [1.0, 0.78, 0.6], [1.0, 0.6, 0.38]];
export const tempColor = (t: number): RGB => rampRGB(RAMP, (t - THERMAL_MIN) / (THERMAL_MAX - THERMAL_MIN));

/**
 * Thermal: the thumb tracks the pointer 1:1 (no spring lag while dragging),
 * keyboard steps glide on a stiff spring. Temperature drives the mercury
 * column, the card illustration and the colour of the surrounding air.
 */
export class ThermalController implements StageController {
  readonly display: Spring;
  private deform = new Deformer(0.0012, 0.14);
  private edge = new EdgeLight(0.25, 2.4);
  private icon: PixelMorpher;
  private iconName: IconName;
  private invalidate: () => void = () => undefined;
  dragging = false;
  private grab = 0;
  private overshoot = 0;
  private reducedMotion = false;
  private d = { along: 1, across: 1, lean: 0 };
  private lastY: number;
  private vy = 0;

  constructor(t: number) {
    this.display = new Spring(t, SPRINGS.track);
    this.iconName = iconForTemp(t);
    this.icon = new PixelMorpher(iconPixels(this.iconName));
    this.lastY = tempToY(t);
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.display.config = r ? reduced(SPRINGS.track) : SPRINGS.track;
  }

  setValue(t: number): void {
    if (this.dragging) return;
    if (this.reducedMotion) this.display.snap(t);
    else this.display.set(t);
    this.invalidate();
  }

  hitThumb(x: number, y: number): boolean {
    const ty = tempToY(this.display.x);
    return Math.abs(x - THERMAL.trackX) <= THERMAL.trackHW + 14 && Math.abs(y - ty) <= THERMAL.thumbHH + 12;
  }

  hitTrack(x: number, y: number): boolean {
    return Math.abs(x - THERMAL.trackX) <= THERMAL.trackHW + 14 && Math.abs(y - THERMAL.cy) <= THERMAL.trackHH + 8;
  }

  /** Start a drag. Pressing the track away from the thumb jumps the thumb there first. */
  beginDrag(y: number, onThumb: boolean): number {
    this.dragging = true;
    this.grab = onThumb ? y - tempToY(this.display.x) : 0;
    this.edge.impulse(0.5);
    return this.drag(y);
  }

  /** Returns the continuous temperature under the pointer. */
  drag(y: number): number {
    const target = y - this.grab;
    const t = yToTemp(target);
    // beyond the ends the glass presses into the rim instead of leaving it
    const past = target > THERMAL_Y0 ? target - THERMAL_Y0 : target < THERMAL_Y1 ? target - THERMAL_Y1 : 0;
    this.overshoot = rubber(past / 40, 0.35) * 40;
    this.display.snap(t);
    this.invalidate();
    return t;
  }

  endDrag(): void {
    this.dragging = false;
    this.overshoot = 0;
    this.edge.impulse(0.35);
    this.invalidate();
  }

  step(dt: number): boolean {
    if (!this.dragging) this.display.step(dt);
    const y = tempToY(this.display.x);
    const rawV = (y - this.lastY) / Math.max(dt, 1e-3);
    this.vy += (rawV - this.vy) * Math.min(1, dt * 30);
    this.lastY = y;
    this.d = this.reducedMotion ? { along: 1, across: 1, lean: 0 } : this.deform.update(this.vy, dt, 0.8);
    this.edge.update(this.reducedMotion ? 0 : -this.vy, 2 * (THERMAL.thumbHW + THERMAL.thumbHH) * 2, dt);
    const name = iconForTemp(this.display.x);
    if (name !== this.iconName) {
      this.iconName = name;
      if (this.reducedMotion) this.icon.show(iconPixels(name));
      else this.icon.morphTo(iconPixels(name), { seed: 4, stagger: 'radial', duration: 0.6 });
    }
    const morphing = this.icon.step(dt);
    const settled = this.display.isSettled(0.005);
    if (settled && !this.dragging) this.display.settle();
    return this.dragging || !settled || morphing || this.deform.active || this.edge.active || Math.abs(this.vy) > 0.5;
  }

  scene(ctx: SceneContext): GlassScene {
    const t = this.display.x;
    const k = (t - THERMAL_MIN) / (THERMAL_MAX - THERMAL_MIN);
    const color = tempColor(t);
    const dark = ctx.dark;
    const ty = tempToY(t) + this.overshoot * 0.3;
    const squash = Math.abs(this.overshoot) / 120;
    const d = { along: this.d.along - squash, across: this.d.across + squash * 0.6 };

    let track = withGlow(TRACK, color, 0.05);
    let card = withGlow(CARD, color, 0.08 + 0.1 * Math.abs(k - 0.5) * 2);
    let thumb = withTint(THUMB, color, 0.1);
    thumb = withGlow(thumb, color, 0.2);
    if (dark) {
      track = smoked(track);
      card = smoked(card, 0.8);
      thumb = smoked(thumb, 0.6);
    }

    const under = ctx.paint('thermal-under', (g) => {
      const x = THERMAL.trackX;
      const top = THERMAL.cy - THERMAL.trackHH + 10;
      const bottom = THERMAL.cy + THERMAL.trackHH - 10;
      // cool → warm column resting inside the track
      const col = g.createLinearGradient(0, bottom, 0, top);
      RAMP.forEach((c, i) => col.addColorStop(i / (RAMP.length - 1), rgba(c, dark ? 0.32 : 0.42)));
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(x - 22, top, 44, bottom - top, 22);
      g.fill();
      // lit mercury from the bottom up to the thumb
      g.save();
      g.shadowColor = rgba(color, 0.9);
      g.shadowBlur = 12 * ctx.pxPerUnit;
      g.fillStyle = rgba(color, 0.9);
      g.beginPath();
      g.roundRect(x - 7, ty, 14, Math.max(0, bottom - 6 - ty), 7);
      g.fill();
      g.restore();
      // ticks: every degree, major every five – visible through the glass
      g.font = '500 11px "Geist Mono Variable", ui-monospace, monospace';
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      for (let deg = THERMAL_MIN; deg <= THERMAL_MAX; deg++) {
        const y = tempToY(deg);
        const major = deg % 5 === 0;
        g.fillStyle = dark ? `rgba(230,230,255,${major ? 0.55 : 0.28})` : `rgba(40,34,60,${major ? 0.5 : 0.25})`;
        g.fillRect(x + 12, y - 0.6, major ? 12 : 6, 1.2);
        if (major) {
          g.fillStyle = dark ? 'rgba(230,230,255,0.6)' : 'rgba(40,34,60,0.55)';
          g.fillText(`${deg}°`, x - THERMAL.trackHW - 12, y);
        }
      }
    });

    const above = ctx.paint('thermal-card', (g) => {
      drawPixels(g, this.icon.states(), THERMAL.cardX - 66, THERMAL.cy, 5.2, ctx.pxPerUnit, { glow: dark ? 4 : 0 });
    });

    return {
      env: {
        kind: ctx.env,
        glowColor: color,
        glowPos: [THERMAL.cardX - 40, THERMAL.cy],
        glowRadius: 360,
        glowStrength: (dark ? 0.2 : 0.26) + 0.12 * Math.abs(k - 0.5) * 2,
        brightness: dark ? 1 : 0.985 + 0.03 * k,
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [
            { cx: THERMAL.trackX, cy: THERMAL.cy, hw: THERMAL.trackHW, hh: THERMAL.trackHH, radius: THERMAL.trackHW, skew: 0, material: track },
            { cx: THERMAL.cardX, cy: THERMAL.cy, hw: THERMAL.cardHW, hh: THERMAL.cardHH, radius: 34, skew: 0, material: card },
          ],
          above,
        },
        {
          shapes: [
            {
              cx: THERMAL.trackX,
              cy: ty,
              hw: THERMAL.thumbHW * d.across,
              hh: THERMAL.thumbHH * d.along,
              radius: 24,
              skew: 0,
              material: thumb,
              edge: this.edge.params(color),
            },
          ],
        },
      ],
    };
  }
}

