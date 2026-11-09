import type { SceneContext, StageController } from '../../glass/GlassStage';
import type { GlassScene } from '../../glass/types';

export const LOADER = { W: 640, H: 440, cx: 320, cy: 220 } as const;

/** Seamless phase in [0, 1) for a loop of `period` seconds. */
export const phase = (t: number, period: number): number => {
  const p = (t % period) / period;
  return p < 0 ? p + 1 : p;
};

/**
 * Base for the Glass Loaders. A loader keeps its own clock and asks for
 * frames forever; the stage stops calling it when it scrolls off screen or
 * the tab is hidden, so an unseen loader costs nothing. With reduced motion
 * each loader draws a calm variant: no travel, only a slow change of light.
 */
export abstract class LoopController implements StageController {
  protected t: number;
  protected reducedMotion = false;
  private invalidate: () => void = () => undefined;

  /** @param startTime where in its loop the loader first appears, so it never opens on an empty frame */
  constructor(startTime = 0) {
    this.t = startTime;
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.invalidate();
  }

  step(dt: number): boolean {
    this.t += dt;
    this.advance(dt);
    return true;
  }

  /** Per-frame simulation hook (morph timers etc.). */
  protected advance(_dt: number): void {}

  abstract scene(ctx: SceneContext): GlassScene;
}
