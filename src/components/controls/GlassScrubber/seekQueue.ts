/** The part of HTMLMediaElement a seek queue needs (a fake satisfies it in tests). */
export interface Seekable {
  currentTime: number;
  readonly duration: number;
  readonly seeking: boolean;
  addEventListener(type: 'seeked', l: () => void): void;
  removeEventListener(type: 'seeked', l: () => void): void;
}

/**
 * Coalesces seeks so scrubbing never races the decoder: while a seek is in
 * flight, newer requests replace the pending target; when the element reports
 * `seeked`, only the latest pending target is issued. Targets are clamped to
 * [0, duration] using the element's own metadata.
 */
export class SeekQueue {
  private pending: number | null = null;
  private inFlight = false;
  private readonly el: Seekable;
  private readonly onSeeked = () => {
    this.inFlight = false;
    if (this.pending !== null) {
      const t = this.pending;
      this.pending = null;
      this.issue(t);
    }
  };

  constructor(el: Seekable) {
    this.el = el;
    el.addEventListener('seeked', this.onSeeked);
  }

  /** Clamp a time to the media's real duration. */
  clamp(t: number): number {
    const d = this.el.duration;
    if (!Number.isFinite(d) || d <= 0) return 0;
    return Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), d);
  }

  request(t: number): void {
    const target = this.clamp(t);
    if (this.inFlight) {
      this.pending = target;
      return;
    }
    this.issue(target);
  }

  private issue(t: number): void {
    if (Math.abs(this.el.currentTime - t) < 1e-4) return;
    this.inFlight = true;
    this.el.currentTime = t;
  }

  get busy(): boolean {
    return this.inFlight;
  }

  dispose(): void {
    this.el.removeEventListener('seeked', this.onSeeked);
    this.pending = null;
  }
}
