import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { THUMB, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { iconPixels } from '../../../pixels/iconDefinitions';
import type { IconName } from '../../../pixels/iconDefinitions';
import type { ParticleState } from '../../../pixels/morphAlgorithm';
import { drawPixels } from '../../../pixels/PixelMorph';
import { MODES } from '../../../state/controls';
import type { Mode } from '../../../state/controls';
import { mixRGB, rampRGB, rgba, smoothstep } from '../shared/math';
import { LIGHT } from '../shared/palette';
import { SelectorCore } from '../shared/selectorCore';

export const MODE = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 196,
  trackHW: 280,
  trackHH: 76,
  tile: 60,
  spacing: 138,
} as const;

export const MODE_SLOTS = [-1.5, -0.5, 0.5, 1.5].map((k) => MODE.cx + k * MODE.spacing);

export const MODE_COLORS: Record<Mode, RGB> = { nature: LIGHT.nature, energy: LIGHT.energy, rest: LIGHT.rest, bloom: LIGHT.bloom };
const ICON: Record<Mode, IconName> = { nature: 'leaf', energy: 'bolt', rest: 'rest', bloom: 'bloom' };
const IDLE_SECONDS = 3.5;

/**
 * Modes: a heavier, more upright tile that leans into its travel. Each mode
 * owns a short signature animation that plays on arrival and while the
 * visitor is engaged; otherwise the icon rests, still and legible.
 */
export class ModeController implements StageController {
  readonly core: SelectorCore;
  private invalidate: () => void = () => undefined;
  private mode: Mode;
  private idle = 0;
  private attention = false;
  private clock = 0;
  private energyCharge = 0;
  private pendingBloom = 0;

  constructor(initial: Mode) {
    this.mode = initial;
    this.core = new SelectorCore(
      { slots: MODE_SLOTS, y: MODE.cy, tileHW: MODE.tile, tileHH: MODE.tile, tileRadius: 42 },
      MODES.indexOf(initial),
      iconPixels(ICON[initial]),
      { stretchGain: 0.0006, maxStretch: 0.12, leanAmp: 2.4, edgeGain: 3 },
    );
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

  select(m: Mode): void {
    const i = MODES.indexOf(m);
    const icon: IconName = m === 'bloom' && !this.core.isReduced ? 'bud' : ICON[m];
    const stagger = m === 'nature' || m === 'bloom' ? 'radial' : m === 'rest' ? 'random' : 'sweep-x';
    if (this.core.select(i, iconPixels(icon), stagger, m === 'bloom' ? 0.42 : 0.66)) {
      this.mode = m;
      this.idle = IDLE_SECONDS;
      this.clock = 0;
      if (m === 'energy') {
        this.energyCharge = 1;
        this.core.edge.impulse(1.2);
      }
      // bloom: bud first, then the petals unfold in a second morph
      this.pendingBloom = m === 'bloom' && !this.core.isReduced ? 0.4 : 0;
    }
    this.invalidate();
  }

  step(dt: number): boolean {
    const moving = this.core.step(dt);
    if (this.pendingBloom > 0) {
      this.pendingBloom -= dt;
      if (this.pendingBloom <= 0 && this.mode === 'bloom') {
        this.core.morph.morphTo(iconPixels('bloom'), { seed: 9, stagger: 'radial', duration: 0.8, maxDelay: 0.45, scatter: 0.6 });
      }
    }
    this.idle = Math.max(0, this.idle - dt);
    this.energyCharge = Math.max(0, this.energyCharge - dt * 0.9);
    const animating = !this.core.isReduced && (this.idle > 0 || this.attention);
    if (animating) this.clock += dt;
    return moving || animating || this.pendingBloom > 0 || this.energyCharge > 0;
  }

  /** Per-mode signature motion applied to the settled squares. */
  private idleMap(): ((s: ParticleState, i: number) => ParticleState) | undefined {
    if (this.core.isReduced || this.core.morph.animating) return undefined;
    const t = this.clock;
    const live = this.idle > 0 || this.attention ? 1 : 0;
    if (!live) return undefined;
    switch (this.mode) {
      case 'nature':
        // the leaf bends from its stem: displacement grows with height
        return (s) => {
          const lift = (11 - s.y) / 11;
          return { ...s, x: s.x + Math.sin(t * 1.6) * 0.9 * lift * lift, y: s.y + Math.cos(t * 1.6) * 0.15 * lift };
        };
      case 'energy': {
        // a bright pulse travels down the bolt
        const pos = ((t * 9) % 18) - 3;
        return (s) => {
          const k = Math.max(0, 1 - Math.abs(s.y - pos) / 1.6);
          const c = mixRGB(s.color, [1, 1, 0.92], k * 0.85);
          return { ...s, color: c };
        };
      }
      case 'rest':
        // stars twinkle and drift a fraction of a pixel; the moon stays still
        return (s, i) => {
          const isStar = s.color[0] > 0.6 && s.color[2] > 0.95 && s.x > 5;
          if (!isStar) return s;
          const tw = 0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.7);
          return { ...s, alpha: s.alpha * tw, y: s.y + Math.sin(t * 0.8 + i) * 0.25 };
        };
      case 'bloom':
        // petals breathe outward from the centre
        return (s) => {
          const dx = s.x - 5.5;
          const dy = s.y - 5.5;
          const k = 1 + Math.sin(t * 2) * 0.035;
          return s.y > 8.5 ? s : { ...s, x: 5.5 + dx * k, y: 5.5 + dy * k };
        };
      default:
        return undefined;
    }
  }

  scene(ctx: SceneContext): GlassScene {
    const core = this.core;
    const fi = core.fractionalIndex;
    const color = rampRGB(MODES.map((m) => MODE_COLORS[m]), fi / (MODES.length - 1));
    const tile = core.tile();
    const dark = ctx.dark;

    let track = withGlow(TRACK, color, 0.04);
    let thumb = withTint(THUMB, mixRGB([1, 1, 1], color, 0.55), 0.1);
    thumb = withGlow(thumb, color, 0.22 + this.energyCharge * 0.25 * (this.mode === 'energy' ? 1 : 0));
    if (dark) {
      track = smoked(track);
      thumb = smoked(thumb, 0.6);
    }

    // quiet, differentiated colour pools resting under each position
    const under = ctx.paint('mode-under', (g) => {
      MODE_SLOTS.forEach((x, i) => {
        const c = MODE_COLORS[MODES[i]];
        const near = 1 - smoothstep(0, MODE.spacing, Math.abs(x - tile.cx));
        const grad = g.createRadialGradient(x, MODE.cy, 4, x, MODE.cy, 64);
        grad.addColorStop(0, rgba(c, (dark ? 0.2 : 0.16) + near * 0.12));
        grad.addColorStop(1, rgba(c, 0));
        g.fillStyle = grad;
        g.fillRect(x - 70, MODE.cy - 70, 140, 140);
      });
    });

    const above = ctx.paint('mode-icons', (g) => {
      MODE_SLOTS.forEach((x, i) => {
        const cover = smoothstep(MODE.tile * 0.4, MODE.tile * 1.4, Math.abs(x - tile.cx));
        drawPixels(
          g,
          iconPixels(ICON[MODES[i]]).map((p) => ({ ...p, alpha: (dark ? 0.6 : 0.5) * cover, size: 1 })),
          x,
          MODE.cy,
          3.2,
          ctx.pxPerUnit,
        );
      });
      drawPixels(g, core.morph.states(), tile.cx, tile.cy, 6, ctx.pxPerUnit, {
        scaleX: core.deform.along,
        scaleY: core.deform.across,
        map: this.idleMap(),
        glow: dark ? 5 : 0,
      });
    });

    return {
      env: {
        kind: ctx.env,
        glowColor: color,
        glowPos: [tile.cx, MODE.cy + 30],
        glowRadius: 300,
        glowStrength: dark ? 0.24 : 0.3,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        {
          shapes: [{ cx: MODE.cx, cy: MODE.cy, hw: MODE.trackHW, hh: MODE.trackHH, radius: 52, skew: 0, material: track }],
          above,
        },
        {
          shapes: [{ ...tile, material: thumb, edge: core.edgeParams(mixRGB(color, [1, 1, 1], 0.3)) }],
        },
      ],
    };
  }
}
