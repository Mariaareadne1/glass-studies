import type { SceneContext } from '../../glass/GlassStage';
import { THUMB, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { GlassScene, RGB } from '../../glass/types';
import { ledPixels } from '../../pixels/iconDefinitions';
import type { IconName } from '../../pixels/iconDefinitions';
import { drawPixels, PixelMorpher } from '../../pixels/PixelMorph';
import { DOT_GAP, glassInk, ledGlow } from '../controls/shared/ink';
import { mixRGB } from '../controls/shared/math';
import { LOADER, LoopController, phase } from './loopController';

export const MORPH_SEQUENCE: IconName[] = ['dots', 'hourglass', 'diamond', 'drop'];
export const MORPH_BEAT = 1.15; // seconds per icon
const HALF = 132;
const LILAC: RGB = [0.66, 0.62, 1.0];

/**
 * Pixel Morph Loader: a glass tile whose LED icon rebuilds itself square by
 * square through a short cycle, while a light circles the rim once per beat.
 */
export class MorphLoader extends LoopController {
  private icon = new PixelMorpher(ledPixels(MORPH_SEQUENCE[0]));
  private index = 0;
  private beat = 0;

  protected advance(dt: number): void {
    this.beat += dt;
    if (this.beat >= MORPH_BEAT) {
      this.beat -= MORPH_BEAT;
      this.index = (this.index + 1) % MORPH_SEQUENCE.length;
      const next = ledPixels(MORPH_SEQUENCE[this.index]);
      if (this.reducedMotion) this.icon.show(next);
      else this.icon.morphTo(next, { seed: this.index + 3, stagger: 'random', duration: 0.7, maxDelay: 0.3 });
    }
    this.icon.step(dt);
  }

  get currentIcon(): IconName {
    return MORPH_SEQUENCE[this.index];
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = LOADER;
    const p = phase(this.t, MORPH_BEAT * MORPH_SEQUENCE.length);
    let tile = withTint({ ...THUMB, bevel: 40, thickness: 34, frost: 0.2, aberration: 0.7, specular: 1.3 }, [0.92, 0.91, 0.99], 0.3);
    tile = { ...withGlow(tile, LILAC, 0.14), halo: 0.25 };
    if (dark) tile = smoked(tile, 0.5);
    const pulse = 0.5 + 0.5 * Math.cos(this.t * 2.4);
    const icon = ctx.paint('morph-loader-icon', (g) => {
      drawPixels(g, this.icon.states(), cx, cy, 10.4, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 4, glowAlpha: ledGlow(dark, 0.5) });
    });
    return {
      env: { kind: ctx.env, glowColor: LILAC, glowPos: [cx, cy], glowRadius: 260, glowStrength: dark ? 0.14 : 0.08, brightness: 1, time: ctx.time },
      layers: [
        {
          shapes: [
            {
              cx,
              cy,
              hw: HALF,
              hh: HALF,
              radius: 44,
              skew: 0,
              material: tile,
              edge: this.reducedMotion
                ? { head: 0.62, intensity: 0.25 + 0.3 * pulse, color: mixRGB(LILAC, [1, 1, 1], 0.4), direction: 1, width: 0.2, trail: 0.05 }
                : { head: phase(p * MORPH_SEQUENCE.length, 1), intensity: 0.7, color: mixRGB(LILAC, [1, 1, 1], 0.35), direction: 1, width: 0.045, trail: 0.28 },
            },
          ],
          above: icon,
        },
      ],
    };
  }
}
