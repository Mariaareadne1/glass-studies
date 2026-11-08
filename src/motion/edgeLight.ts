import type { EdgeLightParams, RGB } from '../glass/types';
import { Spring, SPRINGS } from './spring';

/**
 * A luminous segment that races around a glass perimeter. Its head advances
 * by the distance the glass actually travels (scaled), so the light is tied
 * to real motion: drag slowly and it creeps, flick and it laps the rim.
 * Intensity rises with speed and with discrete impulses, then decays.
 */
export class EdgeLight {
  head: number;
  direction = 1;
  private intensity = new Spring(0, SPRINGS.ambient);
  private boost = 0;

  private gain: number;
  /** Where the light comes to rest on the perimeter once motion stops. */
  restHead: number;
  constructor(head = 0.12, gain = 2.2) {
    this.head = head;
    this.restHead = head;
    this.gain = gain;
  }

  /** Call when a state transition starts to give the light a kick. */
  impulse(strength = 1, direction = this.direction): void {
    this.boost = Math.max(this.boost, strength);
    this.direction = direction >= 0 ? 1 : -1;
  }

  /**
   * @param velocity design units/s of the glass along its travel axis
   * @param perimeter perimeter length of the glass in design units
   */
  update(velocity: number, perimeter: number, dt: number): void {
    const moving = Math.abs(velocity);
    if (moving > 4) this.direction = velocity >= 0 ? 1 : -1;
    // distance travelled, amplified, wrapped onto the perimeter
    this.head += ((velocity * this.gain) / Math.max(perimeter, 1)) * dt;
    this.head -= Math.floor(this.head);
    // after the sweep, the light glides home along the rim (shortest way round)
    if (moving < 4 && this.boost <= 0) {
      let d = this.restHead - this.head;
      d -= Math.round(d);
      this.head += d * Math.min(1, dt * 2.2);
      this.head -= Math.floor(this.head);
    }
    const target = Math.min(1, moving / 900 + this.boost);
    this.intensity.set(target);
    this.intensity.config = target > this.intensity.x ? SPRINGS.deform : SPRINGS.ambient;
    this.intensity.step(dt);
    this.boost = Math.max(0, this.boost - dt * 1.6);
  }

  get level(): number {
    return Math.max(0, this.intensity.x);
  }

  get active(): boolean {
    return this.boost > 0 || this.level > 0.004 || !this.intensity.isSettled(0.004);
  }

  params(color: RGB, rest = 0.0): EdgeLightParams {
    return {
      head: this.head,
      intensity: Math.max(rest, this.level),
      color,
      direction: this.direction,
      width: 0.035,
      trail: 0.09,
    };
  }
}
