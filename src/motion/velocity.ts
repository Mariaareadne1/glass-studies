/** Estimates pointer velocity from a short history window (units/s). */
export class VelocityTracker {
  private samples: { t: number; x: number; y: number }[] = [];
  private windowMs: number;
  constructor(windowMs = 90) {
    this.windowMs = windowMs;
  }
  reset(): void {
    this.samples = [];
  }
  push(x: number, y: number, t: number): void {
    this.samples.push({ t, x, y });
    const cutoff = t - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) this.samples.shift();
  }
  get(): { vx: number; vy: number } {
    const s = this.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 1e-4) return { vx: 0, vy: 0 };
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  }
}
