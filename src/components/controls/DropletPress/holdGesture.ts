/**
 * Press-and-hold timing for the Droplet Press, independent of rendering.
 * Holding fills `progress` over `holdSeconds`; reaching 1 confirms once (even
 * while still held). Releasing early drains the fill back. After a confirm the
 * gesture rests for `restSeconds`, then drains and is ready again.
 */
export type HoldPhase = 'idle' | 'holding' | 'confirmed';

export class HoldGesture {
  phase: HoldPhase = 'idle';
  progress = 0;
  private rest = 0;
  private held = false;

  readonly holdSeconds: number;
  readonly restSeconds: number;
  readonly drainPerSecond: number;

  constructor(holdSeconds = 0.9, restSeconds = 1.4, drainPerSecond = 2.4) {
    this.holdSeconds = holdSeconds;
    this.restSeconds = restSeconds;
    this.drainPerSecond = drainPerSecond;
  }

  press(): void {
    this.held = true;
    if (this.phase === 'idle') this.phase = 'holding';
  }

  release(): void {
    this.held = false;
    if (this.phase === 'holding') this.phase = 'idle';
  }

  get isHeld(): boolean {
    return this.held;
  }

  /** Advance time; returns true on the frame the hold completes. */
  step(dt: number): boolean {
    if (this.phase === 'holding') {
      this.progress = Math.min(1, this.progress + dt / this.holdSeconds);
      if (this.progress >= 1) {
        this.phase = 'confirmed';
        this.rest = this.restSeconds;
        return true;
      }
      return false;
    }
    if (this.phase === 'confirmed') {
      this.rest -= dt;
      if (this.rest <= 0 && !this.held) this.phase = 'idle';
      return false;
    }
    this.progress = Math.max(0, this.progress - dt * this.drainPerSecond);
    return false;
  }

  get active(): boolean {
    return this.phase !== 'idle' || this.progress > 0;
  }
}
