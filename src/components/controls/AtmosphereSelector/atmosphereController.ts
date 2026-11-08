import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { Spring, SPRINGS } from '../../../motion/spring';
import { iconPixels } from '../../../pixels/iconDefinitions';
import { drawPixels } from '../../../pixels/PixelMorph';
import { rng } from '../../../pixels/morphAlgorithm';
import { WEATHER } from '../../../state/controls';
import type { Weather } from '../../../state/controls';
import { clamp, lerp, mixRGB, rampRGB, rgba, smoothstep } from '../shared/math';
import { LIGHT } from '../shared/palette';
import { SelectorCore } from '../shared/selectorCore';

export const ATMO = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 204,
  trackHW: 256,
  trackHH: 66,
  tileHW: 56,
  tileHH: 52,
  spacing: 125,
} as const;

export const ATMO_SLOTS = [-1.5, -0.5, 0.5, 1.5].map((k) => ATMO.cx + k * ATMO.spacing);

const COLORS: Record<Weather, RGB> = { sun: LIGHT.sun, rain: LIGHT.rain, wind: LIGHT.wind, snow: LIGHT.snow };
const ICON: Record<Weather, 'sun' | 'rain' | 'wind' | 'snow'> = { sun: 'sun', rain: 'rain', wind: 'wind', snow: 'snow' };
const AMBIENT_SECONDS = 4.5;
const PARTICLES = 46;

interface Seed {
  x: number;
  y: number;
  s: number;
  p: number;
}

/**
 * Atmosphere: a liquid tile that stretches strongly between four weather
 * slots. The surrounding air carries a short burst of weather particles after
 * every change (and while the visitor is engaged), then quiets down.
 */
export class AtmosphereController implements StageController {
  readonly core: SelectorCore;
  private amounts: Record<Weather, Spring>;
  private invalidate: () => void = () => undefined;
  private ambient = 0;
  private attention = false;
  private clock = 0;
  private seeds: Seed[];

  constructor(initial: Weather) {
    const i = WEATHER.indexOf(initial);
    this.core = new SelectorCore(
      { slots: ATMO_SLOTS, y: ATMO.cy, tileHW: ATMO.tileHW, tileHH: ATMO.tileHH, tileRadius: 40 },
      i,
      iconPixels(ICON[initial]),
      { stretchGain: 0.0013, maxStretch: 0.34, leanAmp: 0.6, edgeGain: 2.2 },
    );
    this.amounts = Object.fromEntries(WEATHER.map((w) => [w, new Spring(w === initial ? 1 : 0, SPRINGS.ambient)])) as Record<Weather, Spring>;
    const r = rng(42);
    this.seeds = Array.from({ length: PARTICLES }, () => ({ x: r(), y: r(), s: r(), p: r() }));
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  wake(): void {
    this.invalidate();
  }

  setAttention(engaged: boolean): void {
    this.attention = engaged;
    if (engaged) this.invalidate();
  }

  setReducedMotion(r: boolean): void {
    this.core.setReducedMotion(r);
  }

  select(w: Weather): void {
    const i = WEATHER.indexOf(w);
    if (this.core.select(i, iconPixels(ICON[w]), 'sweep-x', 0.72)) this.ambient = AMBIENT_SECONDS;
    WEATHER.forEach((k) => this.amounts[k].set(k === w ? 1 : 0));
    this.invalidate();
  }

  step(dt: number): boolean {
    const moving = this.core.step(dt);
    let ambientMoving = false;
    for (const w of WEATHER) {
      const a = this.amounts[w];
      a.step(dt);
      if (!a.isSettled(2e-3)) ambientMoving = true;
      else a.settle();
    }
    const reducedMotion = this.core.isReduced;
    this.ambient = Math.max(0, this.ambient - dt);
    const showAir = !reducedMotion && (this.ambient > 0 || this.attention);
    this.airLevel += ((showAir ? 1 : 0) - this.airLevel) * Math.min(1, dt * 2.5);
    if (this.airLevel > 0.003) this.clock += dt;
    return moving || ambientMoving || showAir || this.airLevel > 0.003;
  }

  private airLevel = 0;

  private drawAir(g: CanvasRenderingContext2D, dark: boolean): void {
    if (this.airLevel < 0.003) return;
    const t = this.clock;
    const W = ATMO.W;
    const H = ATMO.H;
    const lvl = this.airLevel;
    this.seeds.forEach((sd, i) => {
      const rain = this.amounts.rain.x * lvl;
      const snow = this.amounts.snow.x * lvl;
      const wind = this.amounts.wind.x * lvl;
      const sun = this.amounts.sun.x * lvl;
      if (rain > 0.01) {
        const y = ((sd.y * H + t * (260 + sd.s * 120)) % (H + 40)) - 20;
        const x = (sd.x * W + y * 0.18) % W;
        g.fillStyle = rgba(dark ? [0.6, 0.72, 1] : [0.35, 0.5, 0.85], 0.32 * rain);
        g.fillRect(Math.round(x), Math.round(y), 2, 9);
      }
      if (snow > 0.01) {
        const y = ((sd.y * H + t * (26 + sd.s * 22)) % (H + 20)) - 10;
        const x = sd.x * W + Math.sin(t * 0.9 + sd.p * 6.28) * 10;
        g.fillStyle = rgba(dark ? [0.9, 0.93, 1] : [0.62, 0.7, 0.95], 0.5 * snow);
        const sz = 3 + Math.round(sd.s * 2);
        g.fillRect(Math.round(x), Math.round(y), sz, sz);
      }
      if (wind > 0.01 && i % 2 === 0) {
        const x = ((sd.x * W + t * (220 + sd.s * 160)) % (W + 80)) - 60;
        const y = sd.y * H + Math.sin(t * 1.4 + sd.p * 6.28) * 6;
        g.fillStyle = rgba(dark ? [0.6, 0.95, 0.85] : [0.3, 0.7, 0.62], 0.3 * wind);
        g.fillRect(Math.round(x), Math.round(y), 18 + Math.round(sd.s * 22), 2);
      }
      if (sun > 0.01 && i % 3 === 0) {
        const y = H - (((1 - sd.y) * H + t * (10 + sd.s * 12)) % H);
        const x = sd.x * W + Math.sin(t * 0.5 + sd.p * 6.28) * 6;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + sd.p * 12);
        g.fillStyle = rgba(LIGHT.sun, 0.35 * sun * tw);
        g.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
    });
  }

  scene(ctx: SceneContext): GlassScene {
    const core = this.core;
    const fi = core.fractionalIndex;
    const color = rampRGB(WEATHER.map((w) => COLORS[w]), fi / (WEATHER.length - 1));
    const tile = core.tile();
    const dark = ctx.dark;

    let track = withGlow(TRACK, color, 0.05);
    // a slightly narrower bevel keeps the whole icon inside the clear centre
    let thumb = withTint({ ...THUMB, bevel: 20 }, mixRGB([1, 1, 1], color, 0.6), 0.09);
    thumb = withGlow(thumb, color, 0.2);
    if (dark) {
      track = smoked(track);
      thumb = smoked(thumb, 0.6);
    }

    const under = ctx.paint('atmo-under', (g) => this.drawAir(g, dark));
    const above = ctx.paint('atmo-icons', (g) => {
      ATMO_SLOTS.forEach((x, i) => {
        const cover = smoothstep(ATMO.tileHW * 0.4, ATMO.tileHW * 1.4, Math.abs(x - tile.cx));
        const w = WEATHER[i];
        drawPixels(
          g,
          iconPixels(ICON[w]).map((p) => ({ ...p, alpha: (dark ? 0.55 : 0.45) * cover, size: 1 })),
          x,
          ATMO.cy,
          3.2,
          ctx.pxPerUnit,
        );
      });
      drawPixels(g, core.morph.states(), tile.cx, tile.cy, 5, ctx.pxPerUnit, {
        scaleX: core.deform.along,
        scaleY: core.deform.across,
        glow: dark ? 5 : 0,
      });
    });

    const brightness = lerp(1, 0.975, this.amounts.rain.x) * lerp(1, 1.012, this.amounts.snow.x);
    return {
      env: {
        kind: ctx.env,
        glowColor: color,
        glowPos: [tile.cx, ATMO.cy + 20],
        glowRadius: 320,
        glowStrength: dark ? 0.26 : 0.32,
        brightness: dark ? 1 : brightness,
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [{ cx: ATMO.cx, cy: ATMO.cy, hw: ATMO.trackHW, hh: ATMO.trackHH, radius: ATMO.trackHH, skew: 0, material: track }],
          above,
        },
        {
          shapes: [{ ...tile, material: thumb, edge: core.edgeParams(mixRGB(color, [1, 1, 1], 0.35)) }],
        },
      ],
    };
  }
}

export const clampWeatherIndex = (i: number): number => clamp(Math.round(i), 0, WEATHER.length - 1);
