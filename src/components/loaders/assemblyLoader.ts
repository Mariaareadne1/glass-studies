import type { SceneContext } from '../../glass/GlassStage';
import { THUMB, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { GlassScene, RGB } from '../../glass/types';
import { iconPixels } from '../../pixels/iconDefinitions';
import type { IconName, Pixel } from '../../pixels/iconDefinitions';
import { evalParticle, rng } from '../../pixels/morphAlgorithm';
import type { Particle, ParticleState, StaggerMode } from '../../pixels/morphAlgorithm';
import { drawPixels, PixelMorpher } from '../../pixels/PixelMorph';
import { DOT_GAP } from '../controls/shared/ink';
import { mixRGB } from '../controls/shared/math';
import { LOADER, LoopController, phase } from './loopController';
import type { LoopMode } from './loopController';

export const ASSEMBLY_SEQUENCE: IconName[] = ['sun', 'cloud', 'leaf', 'moon'];
/** Seconds each icon is held, including its assembly. */
export const ASSEMBLY_BEAT = 1.6;
export const ASSEMBLY_FAMILIES: { id: StaggerMode; label: string }[] = [
  { id: 'random', label: 'Drift' },
  { id: 'radial', label: 'Bloom' },
  { id: 'sweep-x', label: 'Sweep' },
];
const HALF = 132;
const CELL = 10.4;
const MAX_DELAY = 0.38;
const CREAM: RGB = [1.0, 0.93, 0.78];

/**
 * Deterministic scatter for an icon: every target square gets its own seeded
 * starting point in a loose cloud around the tile, so particle identities are
 * stable and a given progress always produces the same picture.
 */
export function scatterFor(target: readonly Pixel[], seed = 5): ParticleState[] {
  const rand = rng(seed * 7919 + 3);
  return target.map((p) => {
    const a = rand() * Math.PI * 2;
    const r = 4.5 + rand() * 4.5;
    return { x: 5.5 + Math.cos(a) * r, y: 5.5 + Math.sin(a) * r * 0.85, color: p.color, alpha: 0.22, size: 0.45 };
  });
}

/** One particle per target square, flying from its scatter point to its cell. */
export function assemblyPlan(target: readonly Pixel[], seed = 5, family: StaggerMode = 'radial'): Particle[] {
  const from = scatterFor(target, seed);
  const rand = rng(seed * 104729 + 1);
  return target.map((p, i) => {
    let k: number;
    if (family === 'radial') k = Math.min(1, Math.hypot(p.x - 5.5, p.y - 5.5) / 7.5);
    else if (family === 'sweep-x') k = p.x / 11;
    else k = rand();
    return {
      from: from[i],
      to: { x: p.x, y: p.y, color: p.color, alpha: 1, size: 1 },
      delay: Math.max(0, Math.min(1, k * 0.85 + rand() * 0.15)) * MAX_DELAY,
      arc: (rand() * 2 - 1) * 1.4,
      kind: 'shared',
    };
  });
}

/** Rendered squares at assembly progress p (0 = scattered, 1 = the exact icon). */
export function assemblyStates(plan: readonly Particle[], p: number): ParticleState[] {
  const q = Math.min(1, Math.max(0, p));
  if (q >= 1) return plan.map((pt) => pt.to);
  return plan.map((pt) => evalParticle(pt, q, MAX_DELAY));
}

/**
 * Pixel Assembly: luminous squares gather into a sun, a cloud, a leaf and a
 * moon, dissolve and reassemble. Loop mode uses the instruments' morph
 * planner (each square keeps its identity, interrupted morphs continue from
 * where the squares are); determinate mode assembles a chosen icon from a
 * seeded scatter in proportion to the supplied fraction.
 */
export class AssemblyLoader extends LoopController {
  override readonly supportsProgress = true;
  private morph = new PixelMorpher(iconPixels(ASSEMBLY_SEQUENCE[0]));
  private trail: ParticleState[] = [];
  private index = 0;
  private cycle = 0;
  private beat = 0;
  private family: StaggerMode = 'random';
  private target: IconName = 'sun';
  private plan: Particle[] = assemblyPlan(iconPixels('sun'));

  constructor() {
    super(0.2);
  }

  get currentIcon(): IconName {
    return this.transport.mode === 'progress' ? this.target : ASSEMBLY_SEQUENCE[this.index];
  }

  get currentFamily(): StaggerMode {
    return this.family;
  }

  setFamily(f: StaggerMode): void {
    this.family = f;
    this.plan = assemblyPlan(iconPixels(this.target), 5, f);
    this.invalidate();
  }

  setTarget(icon: IconName): void {
    this.target = icon;
    this.plan = assemblyPlan(iconPixels(icon), 5, this.family);
    this.invalidate();
  }

  /** Current squares (for tests and for drawing). */
  states(): ParticleState[] {
    if (this.transport.mode === 'progress') {
      if (this.reducedMotion) return this.plan.map((pt) => ({ ...pt.to, alpha: this.transport.progress }));
      return assemblyStates(this.plan, this.transport.progress);
    }
    return this.morph.states();
  }

  protected override onRestart(): void {
    this.index = 0;
    this.cycle = 0;
    this.beat = 0;
    this.morph.show(iconPixels(ASSEMBLY_SEQUENCE[0]));
  }

  protected override onModeChange(mode: LoopMode): void {
    if (mode === 'loop') this.morph.show(iconPixels(ASSEMBLY_SEQUENCE[this.index]));
  }

  protected override advance(dt: number): void {
    if (this.transport.mode === 'progress') return;
    this.beat += dt;
    if (this.beat >= ASSEMBLY_BEAT) {
      this.beat -= ASSEMBLY_BEAT;
      this.index = (this.index + 1) % ASSEMBLY_SEQUENCE.length;
      if (this.index === 0) this.cycle++;
      const next = iconPixels(ASSEMBLY_SEQUENCE[this.index]);
      if (this.reducedMotion) this.morph.show(next);
      // a different seed every beat keeps the choreography from looking repeated
      else this.morph.morphTo(next, { seed: this.cycle * 4 + this.index + 3, stagger: this.family, duration: 0.95, maxDelay: 0.32, scatter: 2.2 });
    }
    const before = this.morph.animating ? this.morph.states() : [];
    this.morph.step(dt);
    this.trail = before;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = LOADER;
    let tile = withTint({ ...THUMB, bevel: 40, thickness: 34, frost: 0.18, aberration: 0.65, specular: 1.3 }, [0.95, 0.93, 0.97], 0.26);
    tile = { ...withGlow(tile, CREAM, 0.12), halo: 0.2 };
    if (dark) tile = smoked(tile, 0.5);
    const determinate = this.transport.mode === 'progress';
    const done = determinate && this.transport.progress >= 1;
    const states = this.states();
    const glowA = dark ? 0.5 : 0.22;
    const icon = ctx.paint('assembly-icon', (g) => {
      // short trails: the previous frame's squares, faint, only while in flight
      if (!determinate && this.trail.length && !this.reducedMotion) {
        drawPixels(g, this.trail.map((s) => ({ ...s, alpha: s.alpha * 0.18, size: s.size * 0.8 })), cx, cy, CELL, ctx.pxPerUnit, { gap: DOT_GAP });
      }
      drawPixels(g, states, cx, cy, CELL, ctx.pxPerUnit, { gap: DOT_GAP, glow: 5, glowAlpha: glowA, glowColor: 'rgba(255,244,214,1)' });
    });
    const p = phase(this.t, ASSEMBLY_BEAT);
    const pulse = 0.5 + 0.5 * Math.cos(this.t * 2.2);
    const edgeColor = mixRGB(CREAM, [1, 1, 1], 0.4);
    const edge = done
      ? { head: 0.62, intensity: 0.55, color: edgeColor, direction: 1, width: 0.5, trail: 0.05 }
      : this.reducedMotion || determinate
        ? { head: 0.62, intensity: 0.2 + 0.25 * pulse, color: edgeColor, direction: 1, width: 0.2, trail: 0.05 }
        : { head: p, intensity: 0.6, color: edgeColor, direction: 1, width: 0.045, trail: 0.26 };
    return {
      env: { kind: ctx.env, glowColor: CREAM, glowPos: [cx, cy], glowRadius: 260, glowStrength: dark ? 0.12 : 0.07, brightness: 1, time: ctx.time },
      layers: [{ shapes: [{ cx, cy, hw: HALF, hh: HALF, radius: 44, skew: 0, material: tile, edge }], above: icon }],
    };
  }
}
