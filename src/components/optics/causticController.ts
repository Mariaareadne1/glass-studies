import type { SceneContext } from '../../glass/GlassStage';
import { BEAD, smoked, withGlow, withTint } from '../../glass/materialPresets';
import type { ContentLayer, GlassScene } from '../../glass/types';
import { LOADER, LoopController } from '../loaders/loopController';
import { causticField, tonemap } from './causticField';
import type { CausticGrid, LensGeometry, LightSource } from './causticField';

export type CausticShape = 'sphere' | 'capsule';
export type CausticLook = 'muted' | 'contrast';

export const CAUSTIC = {
  lensX: 320,
  lensY: 196,
  r: 66,
  lightZ: 560,
  /** Light path (loop mode): an ellipse around the lens, kept clear of the glass. */
  orbitRX: 210,
  orbitRY: 120,
  period: 9,
  handle: 15,
} as const;

const GRID: CausticGrid = { cols: 160, rows: 110, x0: 0, y0: 0, w: LOADER.W, h: LOADER.H };

export function lensFor(shape: CausticShape): LensGeometry {
  const { lensX: cx, lensY: cy, r } = CAUSTIC;
  return shape === 'sphere'
    ? { cx, cy, hw: r, hh: r, radius: r, bevel: r, thickness: 46 }
    : { cx, cy, hw: r * 1.75, hh: r * 0.8, radius: r * 0.8, bevel: r * 0.8, thickness: 40 };
}

/** Reproducible light trajectory for the loop. */
export function orbitLight(t: number): LightSource {
  const a = (2 * Math.PI * t) / CAUSTIC.period - Math.PI / 2;
  return { x: CAUSTIC.lensX + Math.cos(a) * CAUSTIC.orbitRX, y: CAUSTIC.lensY + Math.sin(a) * CAUSTIC.orbitRY * (0.8 + 0.2 * Math.sin(a * 2)), z: CAUSTIC.lightZ };
}

/** Keep a hand-placed light outside the glass and inside the stage. */
export function clampLight(x: number, y: number, shape: CausticShape): { x: number; y: number } {
  const g = lensFor(shape);
  const px = Math.min(LOADER.W - 24, Math.max(24, x));
  const py = Math.min(LOADER.H - 24, Math.max(24, y));
  const dx = (px - g.cx) / (g.hw + 34);
  const dy = (py - g.cy) / (g.hh + 34);
  const d = Math.hypot(dx, dy);
  if (d >= 1) return { x: px, y: py };
  const k = 1 / Math.max(d, 1e-3);
  return { x: g.cx + (px - g.cx) * k + (d < 1e-3 ? g.hw + 34 : 0), y: g.cy + (py - g.cy) * k };
}

/**
 * Caustic: a point light moves around a clear glass lens floating over the
 * studio plane. The light pattern on the plane is a photon map traced through
 * the lens's own surface profile and IOR (see causticField.ts), recomputed
 * whenever the light or the geometry changes, and the WebGL glass then
 * refracts that plane like any other content beneath it.
 */
export class CausticController extends LoopController {
  shape: CausticShape = 'sphere';
  look: CausticLook = 'muted';
  /** 'orbit' follows the reproducible path; 'hand' holds where the handle was put. */
  lightMode: 'orbit' | 'hand' = 'orbit';
  private hand = { x: CAUSTIC.lensX - 190, y: CAUSTIC.lensY - 70 };
  private field: Float32Array | null = null;
  private fieldKey = '';
  private plane: ContentLayer | null = null;
  private planeKey = '';
  private img: ImageData | null = null;
  private small: HTMLCanvasElement | null = null;

  constructor() {
    super(CAUSTIC.period * 0.62);
  }

  get light(): LightSource {
    if (this.lightMode === 'hand') return { ...this.hand, z: CAUSTIC.lightZ };
    return orbitLight(this.reducedMotion ? CAUSTIC.period * 0.62 : this.t);
  }

  setShape(s: CausticShape): void {
    this.shape = s;
    if (this.lightMode === 'hand') this.hand = clampLight(this.hand.x, this.hand.y, s);
    this.invalidate();
  }

  setLook(l: CausticLook): void {
    this.look = l;
    this.invalidate();
  }

  /** Grab the light: it leaves the orbit and follows the hand. */
  placeLight(x: number, y: number): void {
    this.lightMode = 'hand';
    this.hand = clampLight(x, y, this.shape);
    this.notify();
  }

  resumeOrbit(): void {
    this.lightMode = 'orbit';
    this.notify();
  }

  hitHandle(x: number, y: number): boolean {
    const l = this.light;
    return Math.hypot(x - l.x, y - l.y) <= CAUSTIC.handle + 14;
  }

  /** The irradiance map for the current light and lens (cached). */
  irradiance(): Float32Array {
    const l = this.light;
    const key = `${this.shape}|${l.x.toFixed(2)}|${l.y.toFixed(2)}`;
    if (key !== this.fieldKey || !this.field) {
      this.field = causticField(lensFor(this.shape), l, GRID, 3);
      this.fieldKey = key;
    }
    return this.field;
  }

  override step(dt: number): boolean {
    const playing = super.step(dt);
    return playing && this.lightMode === 'orbit' && !this.reducedMotion;
  }

  private paintPlane(ctx: SceneContext): ContentLayer {
    const dark = ctx.dark;
    const key = `${this.fieldKey}|${this.look}|${dark}|${ctx.pxPerUnit}`;
    if (key === this.planeKey && this.plane) return this.plane;
    const field = this.irradiance();
    const { cols, rows } = GRID;
    if (!this.small && typeof document !== 'undefined') {
      this.small = document.createElement('canvas');
      this.small.width = cols;
      this.small.height = rows;
    }
    const sg = this.small?.getContext('2d');
    if (sg && !this.img) this.img = sg.createImageData(cols, rows);
    const contrast = this.look === 'contrast';
    const base = dark ? [26, 27, 38] : contrast ? [92, 90, 112] : [238, 236, 242];
    const shadeCol = dark ? [12, 12, 20] : contrast ? [40, 38, 58] : [196, 192, 214];
    const lightCol = dark ? [255, 236, 200] : [255, 250, 236];
    const gain = contrast ? 1.4 : 0.8;
    if (this.img) {
      const d = this.img.data;
      for (let k = 0; k < field.length; k++) {
        // 3×3 box blur in place of more photons: smooth, still causal
        const x = k % cols;
        const y = (k / cols) | 0;
        let s = 0;
        let n = 0;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
            s += field[yy * cols + xx];
            n++;
          }
        const ratio = s / n;
        const bright = tonemap(ratio, gain);
        const shade = Math.min(1, Math.max(0, 1 - ratio)) * (contrast ? 0.9 : 0.55);
        const o = k * 4;
        for (let c = 0; c < 3; c++) d[o + c] = base[c] + (shadeCol[c] - base[c]) * shade + (lightCol[c] - base[c]) * bright;
        d[o + 3] = 255;
      }
      sg?.putImageData(this.img, 0, 0);
    }
    this.plane = ctx.paint('caustic-plane', (g) => {
      if (!this.small) return;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.globalAlpha = dark ? 0.9 : contrast ? 0.95 : 0.85;
      g.drawImage(this.small, 0, 0, LOADER.W, LOADER.H);
      g.globalAlpha = 1;
    });
    this.planeKey = key;
    return this.plane;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const g = lensFor(this.shape);
    const l = this.light;
    let lens = withTint({ ...BEAD, bevel: g.bevel, thickness: g.thickness, frost: 0, aberration: 0.12, specular: 1.15, milk: 0.08, shadow: 0 }, [0.99, 0.99, 1], 0.04);
    if (dark) lens = smoked(lens, 0.15);
    let handle = withTint({ ...BEAD, bevel: CAUSTIC.handle, thickness: 18, frost: 0.05, specular: 1.5, milk: 0.4, shadow: 0.3 }, [1, 0.97, 0.9], 0.3);
    handle = { ...withGlow(handle, [1, 0.92, 0.75], 0.6), halo: 0.6 };
    const under = this.paintPlane(ctx);
    return {
      env: { kind: ctx.env, glowColor: [1, 0.95, 0.85], glowPos: [l.x, l.y], glowRadius: 160, glowStrength: dark ? 0.1 : 0.05, brightness: 1, time: ctx.time },
      under,
      layers: [
        { shapes: [{ cx: g.cx, cy: g.cy, hw: g.hw, hh: g.hh, radius: g.radius, skew: 0, material: lens }] },
        { shapes: [{ cx: l.x, cy: l.y, hw: CAUSTIC.handle, hh: CAUSTIC.handle, radius: CAUSTIC.handle, skew: 0, material: handle }] },
      ],
    };
  }
}
