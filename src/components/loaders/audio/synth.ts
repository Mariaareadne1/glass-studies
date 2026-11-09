/**
 * Audio Render synthesis: three original presets built as Web Audio graphs
 * and rendered with an OfflineAudioContext (deterministic: no randomness
 * except the seeded noise buffer). Progress is MEASURED by suspending the
 * offline render at fixed times – the render is genuinely paused there – so
 * the loader can show real progress rather than a guess.
 */
export type SoundPreset = 'bell' | 'chord' | 'noise';

export const PRESETS: { id: SoundPreset; label: string }[] = [
  { id: 'bell', label: 'Sine bell' },
  { id: 'chord', label: 'Soft chord' },
  { id: 'noise', label: 'Filtered noise' },
];

export const DURATIONS = [2, 4, 6] as const;
export const SAMPLE_RATE = 44100;

type Ctx = OfflineAudioContext;

function bell(ctx: Ctx, out: AudioNode, dur: number): void {
  // inharmonic partials of a small bell, each with its own decay
  const partials = [
    [1, 1, 1.6],
    [2.76, 0.5, 1.0],
    [5.4, 0.25, 0.6],
    [8.93, 0.12, 0.35],
  ];
  const strikes = Math.max(1, Math.round(dur / 2));
  for (let s = 0; s < strikes; s++) {
    const t0 = s * (dur / strikes);
    const f0 = [523.25, 659.25, 587.33][s % 3];
    for (const [ratio, amp, decay] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp * 0.3, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, Math.min(dur, t0 + decay * 2.2));
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(Math.min(dur, t0 + decay * 2.2 + 0.05));
    }
  }
}

function chord(ctx: Ctx, out: AudioNode, dur: number): void {
  const notes = [261.63, 329.63, 392.0, 493.88]; // Cmaj7
  notes.forEach((f, i) => {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      const g = ctx.createGain();
      const a = 0.25 + i * 0.12;
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(0.06, a);
      g.gain.setValueAtTime(0.06, Math.max(a, dur - 0.9));
      g.gain.linearRampToValueAtTime(0, dur - 0.02);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      o.connect(lp).connect(g).connect(out);
      o.start(0);
      o.stop(dur);
    }
  });
}

function noise(ctx: Ctx, out: AudioNode, dur: number): void {
  const len = Math.floor(dur * ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    d[i] = (seed / 0xffffffff) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 6;
  // a slow sweep: wind through glass
  bp.frequency.setValueAtTime(320, 0);
  bp.frequency.exponentialRampToValueAtTime(2400, dur * 0.55);
  bp.frequency.exponentialRampToValueAtTime(500, dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(0.5, 0.6);
  g.gain.setValueAtTime(0.5, Math.max(0.6, dur - 0.8));
  g.gain.linearRampToValueAtTime(0, dur - 0.02);
  src.connect(bp).connect(g).connect(out);
  src.start(0);
}

export interface RenderOptions {
  preset: SoundPreset;
  duration: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Render a preset to a mono AudioBuffer. Rejects with AbortError when aborted. */
export async function renderPreset(opts: RenderOptions): Promise<AudioBuffer> {
  const { duration } = opts;
  const ctx = new OfflineAudioContext(1, Math.round(duration * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  ({ bell, chord, noise })[opts.preset](ctx, master, duration);
  // measured progress: suspend at fixed points of the render timeline
  const marks = 8;
  for (let k = 1; k < marks; k++) {
    const t = (k / marks) * duration;
    ctx.suspend(Math.floor((t * SAMPLE_RATE) / 128) * (128 / SAMPLE_RATE)).then(() => {
      opts.onProgress?.(k / marks);
      if (opts.signal?.aborted) return; // leave it suspended; the promise below rejects
      ctx.resume();
    });
  }
  opts.onProgress?.(0);
  return new Promise<AudioBuffer>((resolve, reject) => {
    opts.signal?.addEventListener('abort', () => reject(new DOMException('Render aborted', 'AbortError')), { once: true });
    ctx.startRendering().then((b) => {
      opts.onProgress?.(1);
      resolve(b);
    }, reject);
  });
}
