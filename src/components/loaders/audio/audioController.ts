import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { CARD, smoked, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { Spring } from '../../../motion/spring';

export const AUD = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 150,
  hw: 264,
  hh: 70,
  bins: 44,
  cell: 7,
  rows: 13,
} as const;

export type AudioPhase = 'idle' | 'rendering' | 'ready' | 'error';

const COOL: RGB = [0.62, 0.78, 1.0];
const WARM: RGB = [1.0, 0.78, 0.55];

/**
 * Audio Render stage. While the offline render runs, loose pixels drift in
 * the glass bar (indeterminate) and the bar's rim light follows the render's
 * measured progress. When the buffer exists, the pixels settle into the
 * waveform computed from the actual samples: column height is the bin's peak,
 * colour runs cool→warm with its RMS level, and a playhead tracks playback.
 */
export class AudioController implements StageController {
  phase: AudioPhase = 'idle';
  progress = 0;
  /** Real envelope of the rendered samples (empty until rendered). */
  bins: { peak: number; rms: number }[] = [];
  playhead = -1;
  private resolve = new Spring(0, { stiffness: 90, damping: 16, mass: 1 });
  private t = 0;
  private reducedMotion = false;
  private invalidate: () => void = () => undefined;

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
  }

  setPhase(p: AudioPhase): void {
    this.phase = p;
    this.resolve.set(p === 'ready' ? 1 : 0);
    if (p !== 'ready') this.bins = [];
    this.invalidate();
  }

  setProgress(p: number): void {
    this.progress = p;
    this.invalidate();
  }

  setBins(b: { peak: number; rms: number }[]): void {
    this.bins = b;
    this.invalidate();
  }

  setPlayhead(f: number): void {
    this.playhead = f;
    this.invalidate();
  }

  step(dt: number): boolean {
    this.t += dt;
    this.resolve.step(dt);
    if (this.reducedMotion) this.resolve.snap(this.resolve.target);
    return this.phase === 'rendering' || !this.resolve.isSettled(0.002) || (this.playhead >= 0 && this.playhead < 1);
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { cx, cy, hw, hh, bins, cell, rows } = AUD;
    const k = Math.max(0, Math.min(1, this.resolve.x));
    const under = ctx.paint('audio-wave', (g) => {
      const span = hw * 2 - 48;
      const x0 = cx - span / 2;
      const colW = span / bins;
      for (let b = 0; b < bins; b++) {
        const bin = this.bins[b];
        const real = bin ? Math.max(1, Math.round(bin.peak * rows)) : 0;
        const rmsK = bin ? Math.min(1, bin.rms * 3) : 0.3;
        const col: RGB = [COOL[0] + (WARM[0] - COOL[0]) * rmsK, COOL[1] + (WARM[1] - COOL[1]) * rmsK, COOL[2] + (WARM[2] - COOL[2]) * rmsK];
        const played = this.playhead >= 0 && b / bins <= this.playhead;
        for (let r = 0; r < rows; r++) {
          const dy = r - (rows - 1) / 2;
          const onWave = Math.abs(dy) * 2 < real;
          // loose particles (rendering / idle) settle into the real waveform as k → 1
          const seed = Math.sin(b * 12.9898 + r * 78.233) * 43758.5453;
          const rnd = seed - Math.floor(seed);
          const loose = this.phase === 'rendering' && !this.reducedMotion ? 0.5 + 0.5 * Math.sin(this.t * (1.5 + rnd * 2) + rnd * 20) : 0.25;
          const a = onWave ? 0.25 + 0.75 * k : (1 - k) * (rnd < 0.35 ? loose : 0);
          if (a < 0.02) continue;
          const drift = (1 - k) * (this.phase === 'rendering' && !this.reducedMotion ? Math.sin(this.t * 1.3 + rnd * 9) * 6 : 0);
          const x = x0 + b * colW + colW / 2;
          const y = cy + dy * cell + drift;
          const s = cell * 0.62;
          const c = played ? [1, 1, 1] : col;
          g.fillStyle = `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${(a * (dark ? 0.95 : 0.9)).toFixed(3)})`;
          g.fillRect(Math.round((x - s / 2) * ctx.pxPerUnit) / ctx.pxPerUnit, Math.round((y - s / 2) * ctx.pxPerUnit) / ctx.pxPerUnit, s, s);
        }
      }
      if (this.playhead >= 0 && this.playhead <= 1) {
        g.fillStyle = dark ? 'rgba(255,255,255,0.8)' : 'rgba(40,36,70,0.6)';
        g.fillRect(x0 + span * this.playhead - 0.75, cy - hh + 14, 1.5, hh * 2 - 28);
      }
    });
    let bar = withTint({ ...CARD, bevel: 30, thickness: 22, frost: 0.08, aberration: 0.3, specular: 1.3, milk: 0.55, shadow: 0.36 }, [0.9, 0.9, 0.96], dark ? 0.4 : 0.42);
    if (dark) bar = smoked(bar, 0.85);
    else bar = withTint(bar, [0.3, 0.3, 0.42], 0.5);
    const edge =
      this.phase === 'rendering'
        ? { head: 0.75 - this.progress * 0.999, intensity: 0.85, color: [0.8, 0.88, 1] as const, direction: 1, width: 0.012, trail: Math.max(0.001, this.progress) }
        : undefined;
    return {
      env: { kind: ctx.env, glowColor: [0.85, 0.88, 1], glowPos: [cx, cy], glowRadius: 260, glowStrength: dark ? 0.08 : 0.04, brightness: 1, time: ctx.time },
      under,
      layers: [{ shapes: [{ cx, cy, hw, hh, radius: 30, skew: 0, material: bar, edge }] }],
    };
  }
}
