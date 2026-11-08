import { perimeterPoint } from './geometry';
import type { ContentLayer, GlassRenderer, GlassScene, GlassShape, RGB } from './types';

/**
 * Honest fallback for browsers without WebGL2: frosted glass, rim light and
 * the traveling edge light, but NO refraction. The stage labels itself as
 * "frosted fallback" so this is never mistaken for the real optics.
 */

const ENV_STOPS: Record<string, [string, string]> = {
  pearl: ['#f5f3f1', '#eae8f1'],
  midnight: ['#171828', '#0d0e16'],
  atmosphere: ['#8fb0e5', '#f2e0e0'],
  optics: ['#efefef', '#d6d6d6'],
};

const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

function rrPath(ctx: CanvasRenderingContext2D, s: GlassShape, inset = 0): void {
  const r = Math.max(0, Math.min(s.radius, s.hw, s.hh) - inset);
  ctx.beginPath();
  ctx.roundRect(s.cx - s.hw + inset, s.cy - s.hh + inset, (s.hw - inset) * 2, (s.hh - inset) * 2, r);
}

export class CanvasGlassRenderer implements GlassRenderer {
  readonly kind = 'canvas2d' as const;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private canvas: HTMLCanvasElement;
  private scratch = document.createElement('canvas');

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('glass: 2D canvas unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(widthPx: number, heightPx: number, unitsToPx: number): void {
    this.canvas.width = Math.max(1, Math.round(widthPx));
    this.canvas.height = Math.max(1, Math.round(heightPx));
    this.scratch.width = this.canvas.width;
    this.scratch.height = this.canvas.height;
    this.scale = unitsToPx;
  }

  private drawContent(layer: ContentLayer | undefined): void {
    if (!layer) return;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(layer.canvas as CanvasImageSource, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  render(scene: GlassScene): void {
    const { ctx, scale } = this;
    const w = this.canvas.width / scale;
    const h = this.canvas.height / scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const [a, b] = ENV_STOPS[scene.env.kind];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const e = scene.env;
    const pool = ctx.createRadialGradient(e.glowPos[0], e.glowPos[1], 0, e.glowPos[0], e.glowPos[1], e.glowRadius);
    pool.addColorStop(0, css(e.glowColor, 0.55 * e.glowStrength));
    pool.addColorStop(1, css(e.glowColor, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);
    if (e.brightness < 1) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - e.brightness) * 0.8})`;
      ctx.fillRect(0, 0, w, h);
    }
    this.drawContent(scene.under);

    // Without refraction a frosted body would blur any artwork sitting inside
    // the glass, so the fallback draws every glass layer first and the
    // artwork on top, where it stays crisp.
    for (const layer of scene.layers) {
      for (const s of layer.shapes) this.drawShape(s, scene.env.kind === 'midnight');
    }
    for (const layer of scene.layers) this.drawContent(layer.above);
  }

  private drawShape(s: GlassShape, dark: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(s.cx, s.cy);
    ctx.transform(1, 0, -s.skew, 1, 0, 0);
    ctx.translate(-s.cx, -s.cy);
    // contact shadow
    ctx.save();
    ctx.shadowColor = `rgba(40,36,60,${s.material.shadow * 0.45})`;
    ctx.shadowBlur = Math.min(s.hw, s.hh) * 0.5 * this.scale;
    ctx.shadowOffsetY = 6 * this.scale;
    rrPath(ctx, s);
    ctx.fillStyle = 'rgba(255,255,255,0.01)';
    ctx.fill();
    ctx.restore();
    // frosted body: blurred copy of what is below
    this.scratch.getContext('2d')?.drawImage(this.canvas, 0, 0);
    ctx.save();
    rrPath(ctx, s);
    ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = `blur(${(4 + s.material.frost * 10) * this.scale}px) saturate(1.2)`;
    ctx.drawImage(this.scratch, 0, 0);
    ctx.filter = 'none';
    ctx.restore();
    const m = s.material;
    const body = ctx.createLinearGradient(0, s.cy - s.hh, 0, s.cy + s.hh);
    body.addColorStop(0, dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.42)');
    body.addColorStop(1, dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.14)');
    rrPath(ctx, s);
    ctx.fillStyle = body;
    ctx.fill();
    if (m.glow[3] > 0) {
      ctx.fillStyle = css([m.glow[0], m.glow[1], m.glow[2]], m.glow[3] * 0.35);
      ctx.fill();
    }
    // rim
    ctx.lineWidth = Math.max(1, m.bevel * 0.12);
    const rim = ctx.createLinearGradient(s.cx - s.hw, s.cy - s.hh, s.cx + s.hw, s.cy + s.hh);
    rim.addColorStop(0, 'rgba(255,255,255,0.95)');
    rim.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    rim.addColorStop(1, 'rgba(255,255,255,0.6)');
    rrPath(ctx, s, ctx.lineWidth / 2);
    ctx.strokeStyle = rim;
    ctx.stroke();
    // traveling edge light, sampled along the same perimeter as the GPU path
    if (s.edge && s.edge.intensity > 0.01) {
      const e = s.edge;
      const rect = { hw: s.hw, hh: s.hh, radius: s.radius };
      const steps = 18;
      for (let k = 0; k < steps; k++) {
        const back = (k / steps) * (e.trail * 2.5);
        const p = perimeterPoint(e.head - back * e.direction, rect);
        const a = e.intensity * (k === 0 ? 1 : Math.exp(-back / Math.max(e.trail, 1e-3)) * 0.6);
        ctx.beginPath();
        ctx.arc(s.cx + p.x, s.cy - p.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = css(e.color, Math.min(1, a));
        ctx.shadowColor = css(e.color, Math.min(1, a));
        ctx.shadowBlur = 8 * this.scale;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  destroy(): void {
    this.scratch.width = this.scratch.height = 0;
  }
}
