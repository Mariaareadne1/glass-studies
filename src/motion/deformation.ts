import { tuning } from '../glass/tuning';
import { Spring, SPRINGS } from './spring';
import type { SpringConfig } from './spring';

export interface Deform {
  /** Scale along the motion axis (>1 stretch, <1 compress). */
  along: number;
  /** Scale across the motion axis (volume-preserving counterpart). */
  across: number;
  /** Lean/shear in the direction of motion. */
  lean: number;
}

export const REST: Deform = { along: 1, across: 1, lean: 0 };

/**
 * Velocity-driven squash & stretch. The stretch amount is itself a spring
 * chasing |velocity|, so when an object stops abruptly the stretch spring
 * overshoots below zero and the glass compresses once before settling – the
 * arrival squash comes from the physics, not from a keyframe.
 */
export class Deformer {
  private stretch: Spring;
  private leanS: Spring;
  private gain: number;
  private maxStretch: number;
  constructor(gain = 0.0009, maxStretch = 0.16, config: SpringConfig = SPRINGS.deform) {
    this.gain = gain;
    this.maxStretch = maxStretch;
    this.stretch = new Spring(0, config);
    this.leanS = new Spring(0, config);
  }

  setConfig(c: SpringConfig): void {
    this.stretch.config = c;
    this.leanS.config = c;
  }

  /** velocity in design units per second along the motion axis. */
  update(velocity: number, dt: number, amplitude = 1): Deform {
    const amp = amplitude * tuning.deformation;
    const target = Math.min(Math.abs(velocity) * this.gain, this.maxStretch) * amp;
    this.stretch.set(target);
    this.leanS.set(Math.max(-1, Math.min(1, velocity * this.gain * 1.2)) * 0.12 * amp);
    this.stretch.step(dt);
    this.leanS.step(dt);
    const s = Math.max(-0.12, this.stretch.x);
    return { along: 1 + s, across: 1 - s * 0.55, lean: this.leanS.x };
  }

  get active(): boolean {
    return !(this.stretch.isSettled(5e-4) && this.leanS.isSettled(5e-4));
  }

  reset(): void {
    this.stretch.snap(0);
    this.leanS.snap(0);
  }
}
