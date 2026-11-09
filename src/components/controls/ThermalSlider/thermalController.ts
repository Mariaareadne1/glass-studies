import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { CARD, THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { Deformer } from '../../../motion/deformation';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { ledPixels as iconPixels } from '../../../pixels/iconDefinitions';
import type { IconName } from '../../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../../pixels/PixelMorph';
import { THERMAL_MAX, THERMAL_MIN, THERMAL_STEP } from '../../../state/controls';
import { DOT_GAP, glassInk, ledGlow } from '../shared/ink';
import { clamp, mixRGB, rampRGB, rgba, rubber } from '../shared/math';

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
  /** V2.1 rounded-square family shared with the icon tiles: housing, thumb and card corners. */
  trackRadius: 24,
  thumbRadius: 13,
  cardRadius: 28,
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

    // V2: ivory housing filled with a calm peach→lavender gradient; the thumb is a
    // wide pill of creamy glass that crosses the capsule; the card is neutral lavender
    let track = withTint(withGlow(TRACK, color, 0.03), [0.97, 0.95, 0.93], 0.26);
    track = { ...track, milk: 0.9, bevel: 24 };
    let card = withTint(withGlow(CARD, color, 0.05 + 0.08 * Math.abs(k - 0.5) * 2), [0.5, 0.53, 0.78], 0.64);
    let thumb = withTint({ ...THUMB, bevel: 18, thickness: 26 }, mixRGB([0.97, 0.96, 0.95], color, 0.12), 0.46);
    thumb = { ...withGlow(thumb, color, 0.16), halo: 0.3 };
    if (dark) {
      track = smoked(track);
      card = smoked(card, 0.8);
      thumb = smoked(thumb, 0.5);
    }

    const under = ctx.paint('thermal-under', (g) => {
      const x = THERMAL.trackX;
      const top = THERMAL.cy - THERMAL.trackHH + 6;
      const bottom = THERMAL.cy + THERMAL.trackHH - 6;
      const w = THERMAL.trackHW - 6;
      g.save();
      g.beginPath();
      g.roundRect(x - w, top, w * 2, bottom - top, THERMAL.trackRadius - 6);
      g.clip();
      const col = g.createLinearGradient(0, bottom, 0, top);
      col.addColorStop(0, rgba([0.55, 0.62, 0.98], dark ? 0.45 : 0.62));
      col.addColorStop(0.45, rgba([0.78, 0.76, 0.96], dark ? 0.35 : 0.45));
      col.addColorStop(1, rgba([1.0, 0.74, 0.55], dark ? 0.45 : 0.66));
      g.fillStyle = col;
      g.fillRect(x - w, top, w * 2, bottom - top);
      // the set point glows softly where the thumb rests
      const glow = g.createRadialGradient(x, ty, 2, x, ty, 70);
      glow.addColorStop(0, rgba(color, 0.55));
      glow.addColorStop(1, rgba(color, 0));
      g.fillStyle = glow;
      g.fillRect(x - w, ty - 70, w * 2, 140);
      g.restore();
      // card atmosphere: soft cloud forms resting beneath the card glass
      g.save();
      g.beginPath();
      g.roundRect(THERMAL.cardX - THERMAL.cardHW, THERMAL.cy - THERMAL.cardHH, THERMAL.cardHW * 2, THERMAL.cardHH * 2, THERMAL.cardRadius);
      g.clip();
      [[70, 60, 60], [20, 78, 50], [105, 30, 44]].forEach(([dx, dy, r]) => {
        const c = g.createRadialGradient(THERMAL.cardX + dx, THERMAL.cy + dy, 2, THERMAL.cardX + dx, THERMAL.cy + dy, r);
        c.addColorStop(0, `rgba(255,250,248,${dark ? 0.12 : 0.7})`);
        c.addColorStop(1, 'rgba(255,250,248,0)');
        g.fillStyle = c;
        g.fillRect(THERMAL.cardX + dx - r, THERMAL.cy + dy - r, r * 2, r * 2);
      });
      g.restore();
      // precision ticks inside the capsule; labels outside
      g.font = `500 ${Math.max(11, 9 / ctx.cssScale).toFixed(1)}px "Geist Mono Variable", ui-monospace, monospace`;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      for (let deg = THERMAL_MIN; deg <= THERMAL_MAX; deg++) {
        const y = tempToY(deg);
        const major = deg % 5 === 0;
        g.fillStyle = `rgba(255,255,255,${major ? 0.85 : 0.5})`;
        g.fillRect(x + 10, y - 0.6, major ? 12 : 6, 1.2);
        if (major) {
          g.fillStyle = dark ? 'rgba(230,230,255,0.6)' : 'rgba(74,70,98,0.62)';
          g.fillText(`${deg}°`, x - THERMAL.trackHW - 14, y);
        }
      }
    });

    const above = ctx.paint('thermal-card', (g) => {
      drawPixels(g, this.icon.states(), THERMAL.cardX - 66, THERMAL.cy, 5, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 3, glowAlpha: ledGlow(dark, 0.45) });
    });

    // three grip dots on the thumb surface
    const grip = ctx.paint('thermal-grip', (g) => {
      g.fillStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(120,112,150,0.55)';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.arc(THERMAL.trackX, ty + i * 6.5, 1.9, 0, Math.PI * 2);
        g.fill();
      }
    });

    return {
      env: {
        kind: ctx.env,
        glowColor: color,
        glowPos: [THERMAL.cardX - 40, THERMAL.cy],
        glowRadius: 360,
        glowStrength: (dark ? 0.16 : 0.1) + 0.08 * Math.abs(k - 0.5) * 2,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [
            { cx: THERMAL.trackX, cy: THERMAL.cy, hw: THERMAL.trackHW, hh: THERMAL.trackHH, radius: THERMAL.trackRadius, skew: 0, material: track },
            { cx: THERMAL.cardX, cy: THERMAL.cy, hw: THERMAL.cardHW, hh: THERMAL.cardHH, radius: THERMAL.cardRadius, skew: 0, material: card },
          ],
          above,
        },
        {
          shapes: [
            {
              cx: THERMAL.trackX,
              cy: ty,
              hw: 52 * d.across,
              hh: 22 * d.along,
              radius: THERMAL.thumbRadius,
              skew: 0,
              material: thumb,
              edge: this.edge.params(color),
            },
          ],
          above: grip,
        },
      ],
    };
  }
}

