import type { SceneContext } from '../../glass/GlassStage';
import { BEAD, smoked, withTint } from '../../glass/materialPresets';
import type { ContentLayer, GlassScene, GlassShape } from '../../glass/types';
import { ledPixels } from '../../pixels/iconDefinitions';
import { drawPixels } from '../../pixels/PixelMorph';
import { toStates } from '../../pixels/morphAlgorithm';
import { DOT_GAP, glassInk, ledGlow } from '../controls/shared/ink';
import { LOADER, LoopController, phase } from './loopController';

export const MERGE = { period: 4.8, r: 34, orbit: 84, union: 30 } as const;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface Droplet {
  x: number;
  y: number;
  r: number;
}

/**
 * Merge amounts for a stage fraction s in [0, 1]:
 *   pair  – droplets 0 and 1 drawn together (0 → 1 over the first half)
 *   all   – the pair and droplet 2 drawn together (0 → 1 over the second half)
 */
export function mergeAmounts(s: number): { pair: number; all: number } {
  return { pair: smooth(0.05, 0.5, s), all: smooth(0.55, 0.98, s) };
}

/** Loop stage: merge over the first 62% of the cycle, hold, then split back so p=0 and p=1 match. */
export function loopStage(p: number): number {
  if (p < 0.62) return p / 0.62;
  if (p < 0.72) return 1;
  return 1 - smooth(0.72, 1, p);
}

/**
 * Droplet geometry for a merge stage and orbit angle. Radii grow with the
 * square root of the mass gathered (r·√(1 + e)), so a fully merged pair has
 * twice the area of one droplet and the final bead three times: the union
 * conserves material instead of swallowing it.
 */
export function droplets(stage: number, angle: number): Droplet[] {
  const { r, orbit } = MERGE;
  const { pair, all } = mergeAmounts(stage);
  const cx = LOADER.cx;
  const cy = LOADER.cy;
  const home = [0, 1, 2].map((i) => {
    const a = angle + (i * 2 * Math.PI) / 3;
    return { x: cx + Math.cos(a) * orbit, y: cy + Math.sin(a) * orbit };
  });
  const mid = { x: (home[0].x + home[1].x) / 2, y: (home[0].y + home[1].y) / 2 };
  const pairPos = (i: number) => ({ x: home[i].x + (mid.x - home[i].x) * pair, y: home[i].y + (mid.y - home[i].y) * pair });
  // the merged pair (mass 2) and droplet 2 (mass 1) meet at their centre of mass
  const p0 = pairPos(0);
  const p1 = pairPos(1);
  const pc = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const com = { x: (2 * pc.x + home[2].x) / 3, y: (2 * pc.y + home[2].y) / 3 };
  const toCom = (p: { x: number; y: number }) => ({ x: p.x + (com.x - p.x) * all, y: p.y + (com.y - p.y) * all });
  const ePair = pair + all * (2 - pair);
  const eLone = all * 2;
  return [
    { ...toCom(p0), r: r * Math.sqrt(1 + ePair) },
    { ...toCom(p1), r: r * Math.sqrt(1 + ePair) },
    { ...toCom(home[2]), r: r * Math.sqrt(1 + eLone) },
  ];
}

/**
 * Merge: three pearl droplets orbit, two touch and draw a liquid neck, fuse
 * into one larger volume, take in the third, then split back into three.
 * The droplets are one fused optical surface (smooth union of their distance
 * fields), so the neck refracts and catches light like the droplets do.
 * Determinate mode maps a supplied fraction onto the same merge: 100% is a
 * single bead carrying a check.
 */
export class MergeLoader extends LoopController {
  override readonly supportsProgress = true;
  private pattern: ContentLayer | null = null;
  private patternKey = '';

  constructor() {
    super(0.25);
  }

  /** Current merge stage 0..1 (pure function of the clock or the supplied fraction). */
  get stage(): number {
    if (this.transport.mode === 'progress') return this.transport.progress;
    if (this.reducedMotion) return 0;
    return loopStage(phase(this.t, MERGE.period));
  }

  get angle(): number {
    if (this.transport.mode === 'progress' || this.reducedMotion) return -Math.PI / 2;
    return -Math.PI / 2 + (2 * Math.PI * phase(this.t, MERGE.period)) / 3;
  }

  current(): Droplet[] {
    return droplets(this.stage, this.angle);
  }

  override step(dt: number): boolean {
    const moving = super.step(dt);
    return this.transport.mode === 'progress' ? false : moving;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const key = `${dark}|${ctx.pxPerUnit}`;
    if (key !== this.patternKey || !this.pattern) {
      // a faint neutral dot grid: the fused neck visibly bends it
      this.pattern = ctx.paint('merge-grid', (g) => {
        g.fillStyle = dark ? 'rgba(220,220,255,0.16)' : 'rgba(70,68,100,0.14)';
        for (let y = 60; y < LOADER.H - 50; y += 14) for (let x = 120; x < LOADER.W - 120; x += 14) g.fillRect(x - 1, y - 1, 2, 2);
      });
      this.patternKey = key;
    }
    let bead = withTint({ ...BEAD, bevel: 30, thickness: 34, frost: 0.03, aberration: 0.25, specular: 1.3, milk: 0.22, shadow: 0.42 }, [0.97, 0.96, 1], 0.14);
    if (dark) bead = smoked(bead, 0.3);
    const drops = this.current();
    const shapes: GlassShape[] = drops.map((d) => ({ cx: d.x, cy: d.y, hw: d.r, hh: d.r, radius: d.r, skew: 0, material: bead }));
    const done = this.transport.mode === 'progress' && this.transport.progress >= 1;
    const pulse = 0.5 + 0.5 * Math.cos(this.t * 2.2);
    const above = done
      ? ctx.paint('merge-check', (g) => {
          drawPixels(g, toStates(ledPixels('check')), drops[2].x, drops[2].y, 4.6, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 3, glowAlpha: ledGlow(dark, 0.6) });
        })
      : undefined;
    if (this.reducedMotion && this.transport.mode === 'loop') shapes.forEach((s) => (s.material = { ...s.material, specular: s.material.specular * (0.85 + 0.3 * pulse) }));
    return {
      env: { kind: ctx.env, glowColor: [0.9, 0.88, 1], glowPos: [LOADER.cx, LOADER.cy], glowRadius: 220, glowStrength: dark ? 0.1 : 0.04, brightness: 1, time: ctx.time },
      under: this.pattern,
      layers: [{ shapes, union: MERGE.union, above }],
    };
  }
}
