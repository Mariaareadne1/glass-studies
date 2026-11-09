import type { SceneContext, StageController } from '../../glass/GlassStage';
import type { GlassScene } from '../../glass/types';

export const LOADER = { W: 640, H: 440, cx: 320, cy: 220 } as const;

/** Seamless phase in [0, 1) for a loop of `period` seconds. */
export const phase = (t: number, period: number): number => {
  const p = (t % period) / period;
  return p < 0 ? p + 1 : p;
};

export const SPEEDS = [0.5, 1, 1.5] as const;
export type LoopSpeed = (typeof SPEEDS)[number];
/** 'loop' = indeterminate (never shows a number), 'progress' = driven by a supplied 0..1 fraction. */
export type LoopMode = 'loop' | 'progress';

export interface TransportState {
  playing: boolean;
  speed: LoopSpeed;
  mode: LoopMode;
  progress: number;
}

/**
 * Base for the Glass Loaders. A loader keeps its own clock and asks for
 * frames while playing; the stage stops calling it when it scrolls off screen
 * or the tab is hidden, so an unseen loader costs nothing.
 *
 * Transport: the clock only advances while playing, scaled by `speed`, so a
 * pause freezes every phase exactly and resuming continues from the same
 * instant (no catch-up jump). `restart()` returns to the opening frame.
 * Determinate loaders also accept a `progress` fraction supplied from outside;
 * they must never invent one.
 */
export abstract class LoopController implements StageController {
  protected t: number;
  protected reducedMotion = false;
  private readonly startTime: number;
  private invalidateFn: () => void = () => undefined;
  private listeners = new Set<() => void>();
  private st: TransportState = { playing: true, speed: 1, mode: 'loop', progress: 0 };
  /** Whether this loader has a determinate mode. */
  readonly supportsProgress: boolean = false;

  /** @param startTime where in its loop the loader first appears, so it never opens on an empty frame */
  constructor(startTime = 0) {
    this.t = startTime;
    this.startTime = startTime;
  }

  attach(invalidate: () => void): void {
    this.invalidateFn = invalidate;
  }

  protected invalidate(): void {
    this.invalidateFn();
  }

  /** Subscribe to transport changes (for the UI). */
  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private changed(): void {
    this.listeners.forEach((l) => l());
    this.invalidateFn();
  }

  get transport(): Readonly<TransportState> {
    return this.st;
  }

  get time(): number {
    return this.t;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.invalidateFn();
  }

  setPlaying(playing: boolean): void {
    if (this.st.playing === playing) return;
    this.st = { ...this.st, playing };
    this.changed();
  }

  setSpeed(speed: LoopSpeed): void {
    this.st = { ...this.st, speed };
    this.changed();
  }

  setMode(mode: LoopMode): void {
    if (!this.supportsProgress && mode === 'progress') return;
    this.st = { ...this.st, mode };
    this.onModeChange(mode);
    this.changed();
  }

  setProgress(p: number): void {
    const v = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
    this.st = { ...this.st, progress: v };
    this.onProgress(v);
    this.changed();
  }

  restart(): void {
    this.t = this.startTime;
    this.onRestart();
    this.changed();
  }

  step(dt: number): boolean {
    if (!this.st.playing) return false;
    const d = dt * this.st.speed;
    this.t += d;
    this.advance(d);
    return true;
  }

  /** Per-frame simulation hook (morph timers etc.), already speed-scaled. */
  protected advance(_dt: number): void {}
  protected onRestart(): void {}
  protected onModeChange(_mode: LoopMode): void {}
  protected onProgress(_p: number): void {}

  abstract scene(ctx: SceneContext): GlassScene;
}
