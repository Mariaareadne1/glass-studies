import type { SceneContext } from '../../glass/GlassStage';
import { THUMB, smoked, withTint } from '../../glass/materialPresets';
import type { ContentLayer, GlassScene, GlassShape } from '../../glass/types';
import { ledPixels } from '../../pixels/iconDefinitions';
import { toStates } from '../../pixels/morphAlgorithm';
import { drawPixels } from '../../pixels/PixelMorph';
import { DOT_GAP, glassInk, ledGlow } from '../controls/shared/ink';
import { LOADER, LoopController, phase } from '../loaders/loopController';

export const STITCH = {
  /** The finished panel. */
  half: 112,
  outer: 46,
  inner: 9,
  /** Farthest drift of each fragment from its seat. */
  spread: 58,
  union: 12,
  period: 6.4,
} as const;

/** Each fragment's quadrant (sx, sy) and the stage at which it is seated: top pair, bottom pair, then halves. */
const QUADS = [
  { sx: -1, sy: -1, seat: [0.0, 0.33] },
  { sx: 1, sy: -1, seat: [0.0, 0.33] },
  { sx: -1, sy: 1, seat: [0.33, 0.66] },
  { sx: 1, sy: 1, seat: [0.33, 0.66] },
] as const;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export interface Fragment {
  cx: number;
  cy: number;
  /** Corner radii [tr, br, bl, tl]: generous on the panel's outer corner, small at the seams. */
  radii: [number, number, number, number];
  /** 0 = far apart, 1 = seated. */
  seated: number;
}

/**
 * Fragment geometry for an assembly stage s ∈ [0, 1]. The four pieces are the
 * exact quadrants of the finished rounded square, so their edges are
 * complementary by construction: seated, they tile the panel with no cracks or
 * overlaps. First the top pair closes its vertical seam, then the bottom pair,
 * then the two halves close the horizontal seam (s ≥ 1: one panel).
 */
export function fragments(s: number, t = 0, float = 1): Fragment[] {
  const { half, outer, inner, spread } = STITCH;
  const q = half / 2;
  const pairX = ease((s - 0) / 0.5); // pairs close their vertical seams
  const halves = ease((s - 0.5) / 0.5); // halves close the horizontal seam
  return QUADS.map((Q, i) => {
    const k = Math.min(1, Math.max(0, i < 2 ? pairX * 1.15 : (pairX - 0.15) * 1.18));
    const dx = (1 - k) * spread;
    const dy = (1 - halves) * spread * 0.9;
    const bob = (1 - halves) * float * 3 * Math.sin(t * 1.6 + i * 1.7);
    // screen corner order [tr, br, bl, tl]; the outer corner of quadrant (sx, sy) is generous
    const outerIdx = Q.sx > 0 ? (Q.sy < 0 ? 0 : 1) : Q.sy > 0 ? 2 : 3;
    const radii: [number, number, number, number] = [inner, inner, inner, inner];
    radii[outerIdx] = outer;
    return {
      cx: LOADER.cx + Q.sx * (q + dx),
      cy: LOADER.cy + Q.sy * (q + dy) + bob,
      radii,
      seated: Math.min(k, halves > 0 ? 1 : k) * (0.5 + 0.5 * halves),
    };
  });
}

/** Loop: drift apart → join in order → hold as one panel → separate cleanly (p = 0 and 1 match). */
export function stitchLoopStage(p: number): number {
  if (p < 0.12) return 0;
  if (p < 0.6) return (p - 0.12) / 0.48;
  if (p < 0.8) return 1;
  return 1 - ease((p - 0.8) / 0.2);
}

/**
 * Glass Stitch: four refractive fragments float apart, align and meet along
 * complementary edges; narrow optical bridges form as the gaps close (the
 * fragments are one smooth-union layer, so the bridge is the fused distance
 * field, not a drawn rectangle) and at completion the panel is a single
 * continuous lens: one surface, one set of normals, no seams.
 */
export class StitchController extends LoopController {
  override readonly supportsProgress = true;
  private grid: ContentLayer | null = null;
  private gridKey = '';
  /** Fragment highlighted by a click (preview of its join path). */
  preview: number | null = null;

  constructor() {
    super(STITCH.period * 0.05);
  }

  get stage(): number {
    if (this.transport.mode === 'progress') return this.transport.progress;
    if (this.reducedMotion) return 1;
    return stitchLoopStage(phase(this.t, STITCH.period));
  }

  current(): Fragment[] {
    const determinate = this.transport.mode === 'progress';
    return fragments(this.stage, this.t, determinate || this.reducedMotion ? 0 : 1);
  }

  setPreview(i: number | null): void {
    this.preview = i;
    this.notify();
  }

  override step(dt: number): boolean {
    const playing = super.step(dt);
    return this.transport.mode === 'progress' ? false : playing;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const key = `${dark}|${ctx.pxPerUnit}|${ctx.env}`;
    if (key !== this.gridKey || !this.grid) {
      // a fine checker under the panel: seams and bridges are visible in how it bends
      this.grid = ctx.paint('stitch-grid', (g) => {
        const c = 14;
        g.fillStyle = dark ? 'rgba(220,220,255,0.08)' : 'rgba(70,66,110,0.08)';
        for (let y = 40; y < LOADER.H - 40; y += c)
          for (let x = 140; x < LOADER.W - 140; x += c) if (((x / c) | 0) % 2 === ((y / c) | 0) % 2) g.fillRect(x, y, c, c);
      });
      this.gridKey = key;
    }
    let glass = withTint({ ...THUMB, bevel: 34, thickness: 30, frost: 0.05, aberration: 0.35, specular: 1.3, milk: 0.45, shadow: 0.42 }, [0.97, 0.96, 0.99], 0.18);
    if (dark) glass = smoked(glass, 0.4);
    const frags = this.current();
    const q = STITCH.half / 2;
    const shapes: GlassShape[] = frags.map((f, i) => ({
      cx: f.cx,
      cy: f.cy,
      hw: q,
      hh: q,
      radius: STITCH.inner,
      radii: f.radii,
      skew: 0,
      material: this.preview === i ? { ...glass, specular: glass.specular * 1.5, milk: glass.milk * 1.3 } : glass,
    }));
    // the bond: a core that grows from the centre as the last seam closes and becomes the
    // whole panel, so the fused field has the panel's true depth and the seams disappear
    const bond = ease((this.stage - 0.78) / 0.22);
    if (bond > 0.001) {
      const h = STITCH.half * bond;
      shapes.push({ cx: LOADER.cx, cy: LOADER.cy, hw: h, hh: h, radius: Math.min(h, STITCH.outer * bond + 2), skew: 0, material: glass });
    }
    const done = this.transport.mode === 'progress' && this.transport.progress >= 1;
    const above = done
      ? ctx.paint('stitch-check', (g) => {
          drawPixels(g, toStates(ledPixels('check')), LOADER.cx, LOADER.cy, 5.2, ctx.pxPerUnit, { gap: DOT_GAP, ink: glassInk(dark), glow: 3, glowAlpha: ledGlow(dark, 0.55) });
        })
      : undefined;
    return {
      env: { kind: ctx.env, glowColor: [0.92, 0.9, 1], glowPos: [LOADER.cx, LOADER.cy], glowRadius: 240, glowStrength: dark ? 0.08 : 0.04, brightness: 1, time: ctx.time },
      under: this.grid,
      layers: [{ shapes, union: STITCH.union, above }],
    };
  }
}
