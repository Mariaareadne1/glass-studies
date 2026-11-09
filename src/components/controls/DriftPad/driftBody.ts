/**
 * The puck's free motion after release: it keeps the hand's velocity, loses
 * it to friction and bounces softly off the pad walls. Pure, so it can be
 * tested without a renderer.
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const DRIFT_FRICTION = 3.0; // 1/s, exponential velocity decay
export const DRIFT_RESTITUTION = 0.42;
export const DRIFT_MAX_SPEED = 2400; // design units/s
export const DRIFT_REST_SPEED = 6;

export class DriftBody {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly bounds: Bounds;

  constructor(x: number, y: number, bounds: Bounds) {
    this.x = x;
    this.y = y;
    this.bounds = bounds;
  }

  launch(vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    const k = speed > DRIFT_MAX_SPEED ? DRIFT_MAX_SPEED / speed : 1;
    this.vx = vx * k;
    this.vy = vy * k;
  }

  place(x: number, y: number): void {
    this.x = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, x));
    this.y = Math.min(this.bounds.maxY, Math.max(this.bounds.minY, y));
    this.vx = 0;
    this.vy = 0;
  }

  /** Advance; returns the speed of the hardest wall impact this step (0 if none). */
  step(dt: number): number {
    const decay = Math.exp(-DRIFT_FRICTION * dt);
    this.vx *= decay;
    this.vy *= decay;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    let impact = 0;
    const b = this.bounds;
    if (this.x < b.minX || this.x > b.maxX) {
      impact = Math.max(impact, Math.abs(this.vx));
      this.x = this.x < b.minX ? b.minX + (b.minX - this.x) * DRIFT_RESTITUTION : b.maxX - (this.x - b.maxX) * DRIFT_RESTITUTION;
      this.vx = -this.vx * DRIFT_RESTITUTION;
    }
    if (this.y < b.minY || this.y > b.maxY) {
      impact = Math.max(impact, Math.abs(this.vy));
      this.y = this.y < b.minY ? b.minY + (b.minY - this.y) * DRIFT_RESTITUTION : b.maxY - (this.y - b.maxY) * DRIFT_RESTITUTION;
      this.vy = -this.vy * DRIFT_RESTITUTION;
    }
    if (Math.hypot(this.vx, this.vy) < DRIFT_REST_SPEED) {
      this.vx = 0;
      this.vy = 0;
    }
    return impact;
  }

  get moving(): boolean {
    return this.vx !== 0 || this.vy !== 0;
  }
}
