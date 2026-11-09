/** Shortest signed difference between two angles in degrees, in (-180, 180]. */
export const wrapDeg = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * Accumulates rotation from successive pointer angles around a centre,
 * unwrapping across ±180° so a continuous turn never jumps, and estimates the
 * angular velocity for release projection. Shared by rotary controls.
 */
export class RotaryTracker {
  total = 0;
  velocity = 0;
  private angle = 0;
  private t = 0;
  private readonly cx: number;
  private readonly cy: number;
  private readonly deadRadius: number;

  constructor(cx: number, cy: number, deadRadius = 24) {
    this.cx = cx;
    this.cy = cy;
    this.deadRadius = deadRadius;
  }

  private angleOf(x: number, y: number): number {
    return (Math.atan2(y - this.cy, x - this.cx) * 180) / Math.PI;
  }

  begin(x: number, y: number, timeMs: number): void {
    this.angle = this.angleOf(x, y);
    this.total = 0;
    this.velocity = 0;
    this.t = timeMs;
  }

  /** Feed a pointer position; returns the accumulated rotation in degrees (clockwise positive on screen). */
  move(x: number, y: number, timeMs: number): number {
    // the angle is unstable near the centre
    if (Math.hypot(x - this.cx, y - this.cy) < this.deadRadius) return this.total;
    const a = this.angleOf(x, y);
    const d = wrapDeg(a - this.angle);
    const dt = Math.max((timeMs - this.t) / 1000, 1 / 240);
    this.velocity = this.velocity * 0.6 + (d / dt) * 0.4;
    this.angle = a;
    this.t = timeMs;
    this.total += d;
    return this.total;
  }
}
