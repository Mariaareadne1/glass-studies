import { tuning } from '../glass/tuning';

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/** Named, tuned spring presets. Values were tuned against frame captures. */
export const SPRINGS = {
  /** Thumbs travelling between end stops: one restrained overshoot. */
  travel: { stiffness: 150, damping: 19, mass: 1 },
  /** Deformation: quick, slightly underdamped so arrival compresses once. */
  deform: { stiffness: 420, damping: 16, mass: 1 },
  /** Values that should track input closely (sliders/dials via keyboard). */
  track: { stiffness: 700, damping: 52, mass: 1 },
  /** Secondary motion that trails a primary value (pixel morphs). */
  trail: { stiffness: 85, damping: 16.5, mass: 1 },
  /** Light/colour transitions. */
  ambient: { stiffness: 60, damping: 15, mass: 1 },
  /** Card resizing. */
  layout: { stiffness: 180, damping: 22, mass: 1 },
} as const satisfies Record<string, SpringConfig>;

/** Reduced motion: critically damped and quick – no overshoot, no wobble. */
export function reduced(c: SpringConfig): SpringConfig {
  const stiffness = Math.max(c.stiffness, 400);
  return { stiffness, damping: 2 * Math.sqrt(stiffness * c.mass), mass: c.mass };
}

const STEP = 1 / 240;
const MAX_DT = 1 / 20;

/**
 * Damped harmonic oscillator integrated with fixed semi-implicit Euler
 * sub-steps. Changing `target` never resets velocity, so interruptions are
 * continuous: the spring simply starts pulling toward the new destination.
 */
export class Spring {
  x: number;
  v = 0;
  target: number;
  config: SpringConfig;
  /** Acceleration from the last step, used for deformation. */
  a = 0;

  constructor(value: number, config: SpringConfig) {
    this.x = value;
    this.target = value;
    this.config = config;
  }

  set(value: number): void {
    this.target = value;
  }

  /** Jump to a value (e.g. direct drag), optionally carrying a velocity. */
  snap(value: number, velocity = 0): void {
    this.x = value;
    this.target = value;
    this.v = velocity;
    this.a = 0;
  }

  step(dt: number): void {
    const { stiffness, damping, mass } = this.config;
    const k = stiffness * tuning.stiffness;
    const c = damping * tuning.damping;
    let remaining = Math.min(Math.max(dt, 0), MAX_DT);
    const v0 = this.v;
    while (remaining > 1e-9) {
      const h = Math.min(STEP, remaining);
      const acc = (-k * (this.x - this.target) - c * this.v) / mass;
      this.v += acc * h;
      this.x += this.v * h;
      remaining -= h;
    }
    this.a = dt > 0 ? (this.v - v0) / Math.min(dt, MAX_DT) : 0;
  }

  isSettled(eps = 1e-3): boolean {
    return Math.abs(this.x - this.target) < eps && Math.abs(this.v) < eps * 10;
  }

  settle(): void {
    this.x = this.target;
    this.v = 0;
    this.a = 0;
  }
}
