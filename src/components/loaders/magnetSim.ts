import { sdRoundRect } from '../../glass/geometry';
import { rng } from '../../pixels/morphAlgorithm';

/**
 * Magnetic Beads simulation: four glass beads in a rounded track, pulled or
 * pushed by invisible magnetic points. Physically inspired, not exact
 * electromagnetism:
 *  - force from each magnet ∝ polarity · strength / (distance + soft radius),
 *    clamped, so there is no singularity at zero distance
 *  - beads repel each other with a short-range soft force and are then
 *    separated positionally, so they never overlap beyond a small tolerance
 *  - fixed 1/240 s sub-steps, exponential damping and a speed cap keep it
 *    stable for any frame time (a resume after a pause cannot explode)
 */
export const MAG = {
  cx: 320,
  cy: 220,
  trackHW: 236,
  trackHH: 78,
  trackRadius: 60,
  bead: 21,
  count: 4,
  maxSpeed: 900,
  maxForce: 5200,
  damping: 2.6,
  step: 1 / 240,
} as const;

export interface Magnet {
  x: number;
  y: number;
  /** +1 attracts, −1 repels. */
  polarity: number;
}

export interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Rest slots for the complete state: a small check mark made of four beads. */
export const CHECK_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [MAG.cx - 66, MAG.cy - 6],
  [MAG.cx - 22, MAG.cy + 38],
  [MAG.cx + 26, MAG.cy - 6],
  [MAG.cx + 72, MAG.cy - 50],
];

export class MagnetSim {
  beads: Bead[] = [];
  magnets: Magnet[] = [];
  strength = 1;
  /** When set, beads are drawn to these slots (one each) instead of the magnets. */
  slots: ReadonlyArray<readonly [number, number]> | null = null;
  private acc = 0;
  private readonly seed: number;

  constructor(seed = 3) {
    this.seed = seed;
    this.reset();
  }

  reset(): void {
    const rand = rng(this.seed);
    this.beads = Array.from({ length: MAG.count }, (_, i) => ({
      x: MAG.cx + (i - 1.5) * 92 + (rand() - 0.5) * 20,
      y: MAG.cy + (rand() - 0.5) * 50,
      vx: 0,
      vy: 0,
    }));
    this.acc = 0;
  }

  /** Signed distance of a bead centre to the inner wall (negative inside the allowed area). */
  private wallSd(x: number, y: number): number {
    return sdRoundRect(x - MAG.cx, y - MAG.cy, { hw: MAG.trackHW - MAG.bead - 6, hh: MAG.trackHH - MAG.bead - 6, radius: Math.max(0, MAG.trackRadius - MAG.bead - 6) });
  }

  step(dt: number): void {
    // a long frame (or a resume) is consumed in fixed steps, capped so it can't run away
    this.acc += Math.min(Math.max(dt, 0), 0.1);
    while (this.acc >= MAG.step) {
      this.acc -= MAG.step;
      this.substep(MAG.step);
    }
  }

  private force(b: Bead, i: number): [number, number] {
    let fx = 0;
    let fy = 0;
    if (this.slots) {
      const [sx, sy] = this.slots[i % this.slots.length];
      fx += (sx - b.x) * 60;
      fy += (sy - b.y) * 60;
    } else {
      for (const m of this.magnets) {
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const d = Math.hypot(dx, dy);
        const soft = 38;
        // ∝ 1/(d + soft): finite at the magnet itself, fading with distance
        const f = (m.polarity * this.strength * 6800 * soft) / (d + soft);
        fx += (dx / (d + 1e-6)) * f;
        fy += (dy / (d + 1e-6)) * f;
      }
    }
    // short-range repulsion between beads
    for (let j = 0; j < this.beads.length; j++) {
      if (j === i) continue;
      const o = this.beads[j];
      const dx = b.x - o.x;
      const dy = b.y - o.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const reach = MAG.bead * 2.6;
      if (d < reach) {
        const k = ((reach - d) / reach) ** 2 * 9000;
        fx += (dx / d) * k;
        fy += (dy / d) * k;
      }
    }
    const fm = Math.hypot(fx, fy);
    if (fm > MAG.maxForce) {
      fx *= MAG.maxForce / fm;
      fy *= MAG.maxForce / fm;
    }
    return [fx, fy];
  }

  private substep(h: number): void {
    const forces = this.beads.map((b, i) => this.force(b, i));
    const damp = Math.exp(-MAG.damping * h);
    this.beads.forEach((b, i) => {
      b.vx = (b.vx + forces[i][0] * h) * damp;
      b.vy = (b.vy + forces[i][1] * h) * damp;
      const s = Math.hypot(b.vx, b.vy);
      if (s > MAG.maxSpeed) {
        b.vx *= MAG.maxSpeed / s;
        b.vy *= MAG.maxSpeed / s;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
    });
    // positional collision resolution: beads keep their own silhouettes
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < this.beads.length; i++)
        for (let j = i + 1; j < this.beads.length; j++) {
          const a = this.beads[i];
          const c = this.beads[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const min = MAG.bead * 2;
          if (d < min) {
            const push = (min - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            c.x += (dx / d) * push;
            c.y += (dy / d) * push;
          }
        }
      // walls: project back inside the track and remove the outward velocity
      for (const b of this.beads) {
        const sd = this.wallSd(b.x, b.y);
        if (sd > 0) {
          const e = 0.5;
          const nx = this.wallSd(b.x + e, b.y) - this.wallSd(b.x - e, b.y);
          const ny = this.wallSd(b.x, b.y + e) - this.wallSd(b.x, b.y - e);
          const nl = Math.hypot(nx, ny) || 1;
          b.x -= (nx / nl) * sd;
          b.y -= (ny / nl) * sd;
          const vn = (b.vx * nx + b.vy * ny) / nl;
          if (vn > 0) {
            b.vx -= (vn * nx) / nl * 1.4;
            b.vy -= (vn * ny) / nl * 1.4;
          }
        }
      }
    }
  }

  get kinetic(): number {
    return this.beads.reduce((e, b) => e + b.vx * b.vx + b.vy * b.vy, 0);
  }

  /** Largest overlap between any two beads (design units, 0 = none). */
  get maxOverlap(): number {
    let o = 0;
    for (let i = 0; i < this.beads.length; i++)
      for (let j = i + 1; j < this.beads.length; j++) {
        const d = Math.hypot(this.beads[i].x - this.beads[j].x, this.beads[i].y - this.beads[j].y);
        o = Math.max(o, MAG.bead * 2 - d);
      }
    return o;
  }

  /** Whether every bead centre is inside the track (with tolerance). */
  get contained(): boolean {
    return this.beads.every((b) => this.wallSd(b.x, b.y) < 0.75);
  }
}
