/**
 * Press-and-hold activation for the Droplet Press, independent of rendering.
 *
 *   idle → holding → confirmed → (rest) → idle
 *            ↓ release / cancel before the threshold
 *          idle (nothing happens)
 *
 * The threshold is measured in elapsed monotonic time from the press (an
 * injected clock), never by counting frames, so a slow device takes exactly
 * as long. `progress` is that elapsed fraction; `visual` is what the drop
 * shows – it drains smoothly after an early release, but a new press always
 * restarts the timer from zero.
 */
export type HoldPhase = 'idle' | 'holding' | 'confirmed';

export class HoldGesture {
  phase: HoldPhase = 'idle';
  /** Elapsed fraction of the current hold (0 when not holding). */
  progress = 0;
  /** Displayed fill: follows `progress` while holding, drains afterwards. */
  visual = 0;
  private pressedAt = 0;
  private confirmedAt = 0;
  private held = false;
  private last = 0;

  readonly holdSeconds: number;
  readonly restSeconds: number;
  readonly drainPerSecond: number;
  private readonly now: () => number;

  constructor(now: () => number, holdSeconds = 0.9, restSeconds = 1.4, drainPerSecond = 2.4) {
    this.now = now;
    this.holdSeconds = holdSeconds;
    this.restSeconds = restSeconds;
    this.drainPerSecond = drainPerSecond;
    this.last = now();
  }

  press(): void {
    this.held = true;
    if (this.phase === 'idle') {
      this.phase = 'holding';
      this.pressedAt = this.now();
      this.progress = 0;
    }
  }

  /** Let go. Before the threshold this cancels; after it, the action already happened. */
  release(): void {
    this.held = false;
    if (this.phase === 'holding') {
      this.phase = 'idle';
      this.progress = 0;
    }
  }

  /** Abort without activating (Escape, pointer left the drop, lost capture, blur). */
  cancel(): void {
    this.release();
  }

  get isHeld(): boolean {
    return this.held;
  }

  /** Advance; returns true exactly once, on the update where the hold completes. */
  update(): boolean {
    const now = this.now();
    const dt = Math.max(0, Math.min(0.1, now - this.last));
    this.last = now;
    if (this.phase === 'holding') {
      this.progress = Math.min(1, (now - this.pressedAt) / this.holdSeconds);
      this.visual = Math.max(this.visual - dt * this.drainPerSecond, this.progress);
      if (this.progress >= 1) {
        this.phase = 'confirmed';
        this.confirmedAt = now;
        this.visual = 1;
        return true;
      }
      return false;
    }
    if (this.phase === 'confirmed') {
      if (now - this.confirmedAt >= this.restSeconds && !this.held) this.phase = 'idle';
      return false;
    }
    this.visual = Math.max(0, this.visual - dt * this.drainPerSecond);
    return false;
  }

  get active(): boolean {
    return this.phase !== 'idle' || this.visual > 0;
  }
}
