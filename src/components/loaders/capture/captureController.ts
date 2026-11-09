import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { BEAD, CARD, smoked, withTint } from '../../../glass/materialPresets';
import type { GlassScene } from '../../../glass/types';
import { reduced, Spring } from '../../../motion/spring';
import type { SpringConfig } from '../../../motion/spring';
import { drawBlades } from '../../controls/IrisDial/blades';

export const CAP = {
  W: 640,
  H: 440,
  cx: 220,
  cy: 214,
  housing: 156,
  lens: 120,
  blades: 132,
  open: 108,
  closed: 5,
  count: 7,
} as const;

export type CapturePhase = 'idle' | 'requesting' | 'live' | 'closing' | 'processing' | 'result' | 'error';

const IRIS_SPRING: SpringConfig = { stiffness: 220, damping: 24, mass: 1 };

/**
 * Aperture Capture stage. The picture inside the lens is real: the live
 * camera stream while previewing, then the processed capture. Pressing
 * Capture closes the iris (the shutter), the pipeline runs while it is
 * closed and a ring of light on the housing follows the pipeline's measured
 * progress; when the output exists the iris opens on it.
 */
export class CaptureController implements StageController {
  phase: CapturePhase = 'idle';
  /** Live preview element (camera) and the processed result. */
  video: HTMLVideoElement | null = null;
  result: HTMLCanvasElement | null = null;
  /** Measured pipeline progress 0..1 (only meaningful while processing). */
  progress = 0;
  private aperture = new Spring(0.35, IRIS_SPRING);
  private twistBase = 0;
  private invalidate: () => void = () => undefined;
  private onClosed: (() => void) | null = null;

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.aperture.config = r ? reduced(IRIS_SPRING) : IRIS_SPRING;
  }

  setPhase(p: CapturePhase): void {
    this.phase = p;
    const open = p === 'live' || p === 'result' ? 1 : p === 'closing' || p === 'processing' ? 0 : 0.35;
    this.aperture.set(open);
    this.invalidate();
  }

  /** Close the shutter; `then` runs once the blades have met. */
  closeThen(then: () => void): void {
    this.onClosed = then;
    this.setPhase('closing');
  }

  setVideo(v: HTMLVideoElement | null): void {
    this.video = v;
    this.invalidate();
  }

  setResult(c: HTMLCanvasElement | null): void {
    this.result = c;
    this.invalidate();
  }

  setProgress(p: number): void {
    this.progress = Math.min(1, Math.max(0, p));
    this.invalidate();
  }

  refresh(): void {
    this.invalidate();
  }

  get openness(): number {
    return this.aperture.x;
  }

  step(dt: number): boolean {
    this.aperture.step(dt);
    if (this.phase === 'closing' && this.aperture.x < 0.04 && this.onClosed) {
      const f = this.onClosed;
      this.onClosed = null;
      f();
    }
    const moving = !this.aperture.isSettled(0.002);
    // the live stream needs every frame; otherwise only while the iris moves
    return moving || this.phase === 'live' || this.phase === 'closing' || this.phase === 'processing';
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy } = CAP;
    const r = CAP.closed + (CAP.open - CAP.closed) * Math.max(0, Math.min(1, this.aperture.x));
    const under = ctx.paint('capture-under', (g) => {
      g.save();
      g.beginPath();
      g.arc(cx, cy, CAP.blades, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = dark ? '#111219' : '#dcdae6';
      g.fillRect(cx - CAP.blades, cy - CAP.blades, CAP.blades * 2, CAP.blades * 2);
      const src: CanvasImageSource | null = (this.phase === 'result' || this.phase === 'processing' || this.phase === 'closing') && this.result ? this.result : this.video && this.video.readyState >= 2 ? this.video : null;
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src instanceof HTMLCanvasElement ? src.width : 0;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src instanceof HTMLCanvasElement ? src.height : 0;
      if (src && sw > 0 && sh > 0) {
        // cover the aperture with the real picture
        const k = Math.max((CAP.open * 2) / sw, (CAP.open * 2) / sh);
        const w = sw * k;
        const h = sh * k;
        // a live camera is mirrored like a mirror; captures are shown as taken
        if (src instanceof HTMLVideoElement) {
          g.translate(cx, 0);
          g.scale(-1, 1);
          g.translate(-cx, 0);
        }
        g.drawImage(src, cx - w / 2, cy - h / 2, w, h);
        g.setTransform(ctx.pxPerUnit, 0, 0, ctx.pxPerUnit, 0, 0);
      }
      // warm light through the opening when there is nothing to show
      if (!src) {
        const glow = g.createRadialGradient(cx, cy, 2, cx, cy, CAP.open);
        glow.addColorStop(0, dark ? 'rgba(255,214,160,0.5)' : 'rgba(255,224,180,0.7)');
        glow.addColorStop(1, 'rgba(255,224,180,0)');
        g.fillStyle = glow;
        g.fillRect(cx - CAP.open, cy - CAP.open, CAP.open * 2, CAP.open * 2);
      }
      drawBlades(g, { cx, cy, outer: CAP.blades, count: CAP.count }, r, this.twistBase + (1 - r / CAP.open) * 0.9, dark);
      g.restore();
    });
    let housing = withTint({ ...CARD, bevel: 30, thickness: 22, frost: 0.2, aberration: 0.3, specular: 1.3, milk: 0.7, shadow: 0.42 }, [0.93, 0.92, 0.97], 0.34);
    let lens = withTint({ ...BEAD, bevel: 46, thickness: 30, frost: 0, aberration: 0.12, specular: 1.25, milk: 0.12, shadow: 0 }, [0.99, 0.99, 1], 0.04);
    if (dark) {
      housing = smoked(housing, 0.8);
      lens = smoked(lens, 0.15);
    }
    // the progress ring: an edge light whose lit arc is the measured fraction
    const processing = this.phase === 'processing';
    const edge = processing
      ? { head: 0.75 - this.progress * 0.999, intensity: 0.9, color: [1, 0.92, 0.78] as const, direction: 1, width: 0.012, trail: Math.max(0.001, this.progress) }
      : undefined;
    return {
      env: { kind: ctx.env, glowColor: [1, 0.9, 0.78], glowPos: [cx, cy], glowRadius: 200, glowStrength: (dark ? 0.12 : 0.06) * this.aperture.x, brightness: 1, time: ctx.time },
      under,
      layers: [
        { shapes: [{ cx, cy, hw: CAP.housing, hh: CAP.housing, radius: CAP.housing, skew: 0, material: housing, edge }] },
        { shapes: [{ cx, cy, hw: CAP.lens, hh: CAP.lens, radius: CAP.lens, skew: 0, material: lens }] },
      ],
    };
  }
}
