import type { SceneContext } from '../../glass/GlassStage';
import { THUMB, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { GlassScene, RGB } from '../../glass/types';
import { ledPixels } from '../../pixels/iconDefinitions';
import { drawPixels } from '../../pixels/PixelMorph';
import type { ParticleState } from '../../pixels/morphAlgorithm';
import { rng } from '../../pixels/morphAlgorithm';
import { DOT_GAP, glassInk, ledGlow } from '../controls/shared/ink';
import { clamp, mixRGB, smoothstep } from '../controls/shared/math';
import { LOADER, LoopController, phase } from './loopController';

export const CRYSTAL_PERIOD = 2.8;
const GROW = 0.36; // share of the loop spent growing
const HOLD = 0.68; // ...until here it holds and sparkles
const MELT = 0.9; // ...then melts; the rest is a clear pause
const HALF = 132;
const ICE: RGB = [0.66, 0.8, 1.0];

const PIXELS = ledPixels('snow');
const MAX_R = Math.max(...PIXELS.map((p) => Math.hypot(p.x - 6, p.y - 6)));
const r = rng(7);
const JITTER = PIXELS.map(() => ({ delay: r() * 0.12, dx: r() - 0.5, sparkle: r() }));

/** How much of the crystal has formed (0..1) at loop phase p. */
export function crystalAmount(p: number): number {
  if (p < GROW) return smoothstep(0, GROW, p);
  if (p < HOLD) return 1;
  if (p < MELT) return 1 - smoothstep(HOLD, MELT, p);
  return 0;
}

/**
 * Crystallize Loader: frost grows ring by ring from the centre of a glass tile
 * into an LED snow crystal, sparkles, then melts and falls away. The glass
 * itself fogs as the crystal forms and clears as it melts.
 */
export class CrystalLoader extends LoopController {
  constructor() {
    super(CRYSTAL_PERIOD * GROW * 0.85);
  }

  states(p: number): ParticleState[] {
    const out: ParticleState[] = [];
    PIXELS.forEach((px, i) => {
      const j = JITTER[i];
      const d = Math.hypot(px.x - 6, px.y - 6) / MAX_R;
      let alpha = 0;
      let size = 1;
      let y = px.y;
      let x = px.x;
      if (p < GROW) {
        const k = clamp((p / GROW - d * 0.75 - j.delay) / 0.25);
        alpha = k;
        size = 0.35 + 0.65 * k;
      } else if (p < HOLD) {
        alpha = 1;
        // a few cells catch the light in turn
        const tw = Math.sin((p - GROW) * 40 + j.sparkle * 12);
        size = j.sparkle > 0.75 && tw > 0.85 ? 1.15 : 1;
      } else if (p < MELT) {
        const k = clamp(((p - HOLD) / (MELT - HOLD) - (1 - d) * 0.5 - j.delay) / 0.5);
        alpha = 1 - k;
        size = 1 - 0.5 * k;
        y += k * k * 2.2;
        x += j.dx * k * 1.2;
      }
      if (alpha > 0.01) out.push({ x, y, color: px.color, alpha, size });
    });
    return out;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = LOADER;
    const p = this.reducedMotion ? GROW + 0.01 : phase(this.t, CRYSTAL_PERIOD);
    const amount = this.reducedMotion ? 0.75 + 0.25 * Math.cos(this.t * 1.5) : crystalAmount(p);
    let tile = withTint({ ...THUMB, bevel: 40, thickness: 30, aberration: 0.7, specular: 1.3 }, mixRGB([0.95, 0.95, 1], ICE, 0.3 * amount), 0.26 + 0.12 * amount);
    tile = { ...withGlow(tile, ICE, 0.1 + 0.16 * amount), frost: 0.08 + 0.5 * amount, halo: 0.12 + 0.25 * amount };
    if (dark) tile = smoked(tile, 0.5);
    const states = this.reducedMotion ? this.states(GROW + 0.01).map((s) => ({ ...s, alpha: s.alpha * (0.6 + 0.4 * amount) })) : this.states(p);
    const icon = ctx.paint('crystal-loader-icon', (g) => {
      drawPixels(g, states, cx, cy, 10.4, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 4, glowAlpha: ledGlow(dark, 0.55) });
    });
    return {
      env: { kind: ctx.env, glowColor: ICE, glowPos: [cx, cy], glowRadius: 260, glowStrength: (dark ? 0.12 : 0.06) + 0.06 * amount, brightness: 1, time: ctx.time },
      layers: [{ shapes: [{ cx, cy, hw: HALF, hh: HALF, radius: 44, skew: 0, material: tile }], above: icon }],
    };
  }
}
