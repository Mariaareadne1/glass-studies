import type { SceneContext } from '../../glass/GlassStage';
import { perimeterParam } from '../../glass/geometry';
import { BEAD, CARD, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { GlassScene, RGB } from '../../glass/types';
import { mixRGB, rgba } from '../controls/shared/math';
import { LOADER, LoopController, phase } from './loopController';

export const ORBIT_PERIOD = 1.8;
const LENS = 74;
const PATH = 148;
const BEAD_R = 21;
const WARM: RGB = [1.0, 0.72, 0.45];
const COOL: RGB = [0.62, 0.6, 1.0];

/** Bead angle (radians, clockwise from the top): it surges and eases once per lap, seamlessly. */
export function orbitAngle(t: number): number {
  const p = phase(t, ORBIT_PERIOD);
  return -Math.PI / 2 + Math.PI * 2 * p + 0.42 * Math.sin(Math.PI * 2 * p);
}

/** Angular speed relative to the mean (1 = average lap speed). */
const orbitSpeed = (t: number): number => 1 + 0.42 * Math.cos(Math.PI * 2 * phase(t, ORBIT_PERIOD)) / Math.PI;

/**
 * Orbit Loader: a glass bead laps a central lens, quickening and easing once
 * per lap, leaving a comet of light on the studio surface. The lens rim lights
 * up where the bead passes, and the bead stretches along its path.
 */
export class OrbitLoader extends LoopController {
  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = LOADER;
    const a = this.reducedMotion ? -Math.PI / 2 : orbitAngle(this.t);
    const speed = this.reducedMotion ? 0 : orbitSpeed(this.t);
    const bx = cx + Math.cos(a) * PATH;
    const by = cy + Math.sin(a) * PATH;
    const pulse = 0.5 + 0.5 * Math.cos(this.t * 1.8);
    const heat = mixRGB(COOL, WARM, 0.5 + 0.5 * Math.sin(a));

    let lens = withTint({ ...CARD, bevel: LENS, thickness: 36, frost: 0.1, aberration: 0.85, specular: 1.4, milk: 0.9 }, [0.84, 0.84, 0.96], 0.32);
    lens = withGlow(lens, heat, 0.12 + (this.reducedMotion ? 0.2 * pulse : 0.1));
    let bead = withGlow({ ...BEAD, bevel: BEAD_R, thickness: 18, specular: 1.5 }, heat, 0.4);
    bead = { ...bead, halo: 0.6 };
    if (dark) {
      lens = smoked(lens, 0.6);
      bead = smoked(bead, 0.3);
    }

    const under = ctx.paint('orbit-loader-trail', (g) => {
      // a dotted LED track, brighter just behind the bead
      for (let i = 0; i < 36; i++) {
        const da = (i / 36) * Math.PI * 2;
        const behind = ((a - da) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const k = this.reducedMotion ? 0.3 : Math.max(0, 1 - behind / 2.2);
        const x = cx + Math.cos(da) * PATH;
        const y = cy + Math.sin(da) * PATH;
        g.fillStyle = dark ? `rgba(235,235,255,${0.12 + 0.6 * k})` : `rgba(70,66,110,${0.12 + 0.4 * k})`;
        const s = 2.4 + 2 * k;
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
      if (this.reducedMotion) return;
      // the comet: a soft coloured arc fading behind the bead
      const tail = 1.5 * speed;
      for (let i = 0; i < 24; i++) {
        const k = i / 24;
        const ta = a - tail * k;
        g.fillStyle = rgba(heat, (dark ? 0.3 : 0.38) * (1 - k) ** 2);
        g.beginPath();
        g.arc(cx + Math.cos(ta) * PATH, cy + Math.sin(ta) * PATH, BEAD_R * (1 - k * 0.6), 0, Math.PI * 2);
        g.fill();
      }
    });

    // stretch along the tangent of travel (shapes are axis-aligned, so split by direction)
    const st = 0.16 * speed * (this.reducedMotion ? 0 : 1);
    const tx = Math.abs(Math.sin(a));
    const ty = Math.abs(Math.cos(a));
    const hw = BEAD_R * (1 + st * tx - st * 0.5 * ty);
    const hh = BEAD_R * (1 + st * ty - st * 0.5 * tx);
    const head = perimeterParam(Math.cos(a) * LENS, -Math.sin(a) * LENS, { hw: LENS, hh: LENS, radius: LENS });

    return {
      env: { kind: ctx.env, glowColor: heat, glowPos: [bx, by], glowRadius: 220, glowStrength: dark ? 0.16 : 0.09, brightness: 1, time: ctx.time },
      under,
      layers: [
        {
          shapes: [
            {
              cx,
              cy,
              hw: LENS,
              hh: LENS,
              radius: LENS,
              skew: 0,
              material: lens,
              edge: { head, intensity: this.reducedMotion ? 0.2 + 0.3 * pulse : 0.65, color: mixRGB(heat, [1, 1, 1], 0.35), direction: -1, width: 0.05, trail: 0.22 },
            },
          ],
        },
        { shapes: [{ cx: bx, cy: by, hw, hh, radius: Math.min(hw, hh), skew: 0, material: bead }] },
      ],
    };
  }
}
