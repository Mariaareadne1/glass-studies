import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { BEAD, CARD, THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { ledPixels, ledPixels as iconPixels } from '../../../pixels/iconDefinitions';
import { drawPixels } from '../../../pixels/PixelMorph';
import { DAYS } from '../../../state/controls';
import type { Day } from '../../../state/controls';
import { FORECAST } from '../../../state/forecastData';
import { DOT_GAP, glassInk, ledGlow } from '../shared/ink';
import { lerp, mixRGB, rampRGB, rgba } from '../shared/math';
import { SelectorCore } from '../shared/selectorCore';

export const FC = {
  W: 640,
  H: 440,
  cx: 320,
  top: 54,
  hw: 216,
  hDetailed: 330,
  hMinimal: 246,
  dayHW: 188,
  dayHH: 34,
  dayGap: 54,
  tileHW: 42,
  tileHH: 28,
  spacing: 92,
  toggleHW: 28,
  toggleHH: 16,
} as const;

export const FC_SLOTS = [-1.5, -0.5, 0.5, 1.5].map((k) => FC.cx + k * FC.spacing);
export const FC_TOGGLE_X = FC.cx + FC.hw - 30 - FC.toggleHW;
export const FC_TOGGLE_Y = FC.top + 40;
/** Day-track centre when the card is in detailed layout (the DOM layout baseline). */
export const FC_DAY_Y_BASE = FC.top + FC.hDetailed - FC.dayGap;

/**
 * Forecast: three glass layers (card → day track & toggle track → day tile &
 * toggle bead). The card height is a spring; every nested surface is derived
 * from it each frame, so refraction, highlights and hit-testing stay aligned
 * while it resizes. DOM text follows via one CSS variable, not React renders.
 */
export class ForecastController implements StageController {
  readonly core: SelectorCore;
  private height: Spring;
  private toggle: Spring;
  private toggleEdge = new EdgeLight(0.1, 3);
  private invalidate: () => void = () => undefined;
  private overlay: HTMLElement | null = null;
  private reducedMotion = false;

  constructor(day: Day, detailed: boolean) {
    this.height = new Spring(detailed ? FC.hDetailed : FC.hMinimal, SPRINGS.layout);
    this.toggle = new Spring(detailed ? 1 : 0, SPRINGS.travel);
    this.core = new SelectorCore(
      { slots: FC_SLOTS, y: this.dayY, tileHW: FC.tileHW, tileHH: FC.tileHH, tileRadius: FC.tileHH },
      DAYS.indexOf(day),
      iconPixels(FORECAST[day].icon),
      { stretchGain: 0.0009, maxStretch: 0.2, leanAmp: 0.8, edgeGain: 2.6 },
    );
  }

  get dayY(): number {
    return FC.top + this.height.x - FC.dayGap;
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  bindOverlay(el: HTMLElement | null): void {
    this.overlay = el;
    this.syncOverlay();
  }

  wake(): void {
    this.invalidate();
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.core.setReducedMotion(r);
    this.height.config = r ? reduced(SPRINGS.layout) : SPRINGS.layout;
    this.toggle.config = r ? reduced(SPRINGS.travel) : SPRINGS.travel;
  }

  selectDay(d: Day): void {
    this.core.select(DAYS.indexOf(d), iconPixels(FORECAST[d].icon), 'sweep-x', 0.7);
    this.invalidate();
  }

  setDetailed(on: boolean): void {
    const t = on ? 1 : 0;
    if (this.toggle.target !== t) this.toggleEdge.impulse(0.9, on ? 1 : -1);
    this.toggle.set(t);
    this.height.set(on ? FC.hDetailed : FC.hMinimal);
    this.invalidate();
  }

  hitToggle(x: number, y: number): boolean {
    return Math.abs(x - FC_TOGGLE_X) <= FC.toggleHW + 12 && Math.abs(y - FC_TOGGLE_Y) <= FC.toggleHH + 12;
  }

  private syncOverlay(): void {
    this.overlay?.style.setProperty('--fc-dy', `${(this.height.x - FC.hDetailed).toFixed(2)}px`);
    this.overlay?.style.setProperty('--fc-detail', this.toggle.x.toFixed(3));
  }

  step(dt: number): boolean {
    this.height.step(dt);
    this.toggle.step(dt);
    this.core.geo.y = this.dayY;
    const moving = this.core.step(dt);
    this.toggleEdge.update(this.reducedMotion ? 0 : this.toggle.v * 24 * 2, 2 * Math.PI * 12, dt);
    const hs = this.height.isSettled(0.05);
    const ts = this.toggle.isSettled(1e-3);
    if (hs) this.height.settle();
    if (ts) this.toggle.settle();
    this.syncOverlay();
    return moving || !hs || !ts || this.toggleEdge.active;
  }

  scene(ctx: SceneContext): GlassScene {
    const core = this.core;
    const fi = core.fractionalIndex;
    const sky = rampRGB(DAYS.map((d) => FORECAST[d].sky as RGB), fi / (DAYS.length - 1));
    const dark = ctx.dark;
    const h = this.height.x;
    const cy = FC.top + h / 2;
    const dayY = this.dayY;
    const tile = core.tile();
    const tg = this.toggle.x;
    const tx = FC_TOGGLE_X + lerp(-12, 12, tg);

    // V2: transparent layered lavender-blue card (light type), frosted day row,
    // a floating cream tile, and a blue-tinted polished mini toggle
    let card = withTint(withGlow(CARD, sky, 0.05), [0.5, 0.56, 0.84], 0.6);
    card = { ...card, frost: 0.34, milk: 0.8, aberration: 0.5 };
    let track = withTint(withGlow(TRACK, sky, 0.03), [0.8, 0.82, 0.94], 0.34);
    track = { ...track, frost: 0.4 };
    let tileM = withTint({ ...THUMB, bevel: 16, thickness: 20, frost: 0.4 }, [0.98, 0.97, 0.96], 0.62);
    tileM = { ...withGlow(tileM, sky, 0.12), halo: 0.25 };
    let bead = withGlow({ ...BEAD, bevel: 11 }, mixRGB(sky, [1, 1, 1], 0.4), 0.2 + 0.25 * tg);
    const toggleTrack = withTint({ ...track, bevel: 10, thickness: 8 }, mixRGB([0.8, 0.82, 0.94], [0.36, 0.52, 0.98], tg), 0.4 + 0.25 * tg);
    if (dark) {
      card = smoked(card, 0.6);
      track = smoked(track);
      tileM = smoked(tileM, 0.4);
      bead = smoked(bead, 0.4);
    }

    // the atmospheric backdrop the card frosts: soft sky light and cloud masses
    const under = ctx.paint('fc-sky', (g) => {
      const grad = g.createRadialGradient(FC.cx - 80, cy - 60, 10, FC.cx - 80, cy - 60, 300);
      grad.addColorStop(0, rgba(sky, dark ? 0.45 : 0.55));
      grad.addColorStop(1, rgba(sky, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, FC.W, FC.H);
      const cloudy = Math.max(0, Math.min(1, fi)) * (fi < 3 ? 1 : 0.6);
      [[-150, -70, 90], [120, -110, 70], [60, 40, 110]].forEach(([dx, dy, r], i) => {
        const c = g.createRadialGradient(FC.cx + dx, cy + dy, 2, FC.cx + dx, cy + dy, r);
        c.addColorStop(0, `rgba(255,255,255,${(dark ? 0.08 : 0.5) * (0.3 + 0.7 * cloudy) * (i === 2 ? 0.7 : 1)})`);
        c.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = c;
        g.fillRect(0, 0, FC.W, FC.H);
      });
    });

    const above = ctx.paint('fc-icon', (g) => {
      drawPixels(g, core.morph.states(), FC.cx - FC.hw + 74, FC.top + 112, 5.4, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 3.5, glowAlpha: ledGlow(dark, 0.5) });
    });
    // tiny LED icons under each day label, resting in the frosted row
    const rowIcons = ctx.paint('fc-row-icons', (g) => {
      FC_SLOTS.forEach((x, i) => {
        const near = 1 - Math.min(1, Math.abs(x - tile.cx) / FC.spacing);
        drawPixels(g, ledPixels(FORECAST[DAYS[i]].icon).map((p) => ({ ...p, alpha: 1, size: 1 })), x, dayY + 11, 1.55, ctx.pxPerUnit, {
          gap: 0.18,
          ink: near > 0.5 ? (c) => (c[0] > 0.9 && c[2] < 0.55 ? c : [0.42, 0.4, 0.55]) : glassInk(dark),
        });
      });
    });

    return {
      env: {
        kind: ctx.env,
        glowColor: sky,
        glowPos: [FC.cx, cy],
        glowRadius: 360,
        glowStrength: dark ? 0.2 : 0.26,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [{ cx: FC.cx, cy, hw: FC.hw, hh: h / 2, radius: 44, skew: 0, material: card }],
          above,
        },
        {
          shapes: [
            { cx: FC.cx, cy: dayY, hw: FC.dayHW, hh: FC.dayHH, radius: FC.dayHH, skew: 0, material: track },
            { cx: FC_TOGGLE_X, cy: FC_TOGGLE_Y, hw: FC.toggleHW, hh: FC.toggleHH, radius: FC.toggleHH, skew: 0, material: toggleTrack },
          ],
        },
        {
          shapes: [
            { ...tile, material: tileM, edge: core.edgeParams(mixRGB(sky, [1, 1, 1], 0.35)) },
            { cx: tx, cy: FC_TOGGLE_Y, hw: 12, hh: 12, radius: 12, skew: 0, material: bead, edge: this.toggleEdge.params(mixRGB(sky, [1, 1, 1], 0.3)) },
          ],
          above: rowIcons,
        },
      ],
    };
  }
}
