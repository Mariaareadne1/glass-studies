/**
 * Aperture Capture image pipeline: plain pixel arithmetic on RGBA bytes,
 * processed in row chunks so the UI can show MEASURED progress (rows done /
 * rows total) and stay responsive. Everything runs locally; nothing is sent
 * anywhere.
 */
export type CaptureFilter = 'pearl' | 'mono' | 'warm';

export const FILTERS: { id: CaptureFilter; label: string }[] = [
  { id: 'pearl', label: 'Pearl' },
  { id: 'mono', label: 'Mono' },
  { id: 'warm', label: 'Warm' },
];

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Apply a filter to pixel rows [y0, y1) of an RGBA buffer in place. */
export function filterRows(data: Uint8ClampedArray, width: number, y0: number, y1: number, filter: CaptureFilter): void {
  for (let i = y0 * width * 4; i < y1 * width * 4; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (filter === 'mono') {
      // luminance with a gentle S-curve
      const t = lum / 255;
      const v = 255 * (t * t * (3 - 2 * t) * 0.7 + t * 0.3);
      data[i] = clamp8(v);
      data[i + 1] = clamp8(v);
      data[i + 2] = clamp8(v * 1.02);
    } else if (filter === 'warm') {
      data[i] = clamp8(r * 1.08 + 10);
      data[i + 1] = clamp8(g * 1.0 + 3);
      data[i + 2] = clamp8(b * 0.86 - 4);
    } else {
      // pearl: lifted shadows, softened contrast, a whisper of lavender
      const lift = (v: number) => 24 + v * 0.86;
      const mix = (v: number) => v * 0.82 + lum * 0.18;
      data[i] = clamp8(lift(mix(r)) + 2);
      data[i + 1] = clamp8(lift(mix(g)));
      data[i + 2] = clamp8(lift(mix(b)) + 8);
    }
  }
}

export interface ProcessOptions {
  filter: CaptureFilter;
  /** Rows per chunk; progress is reported after each. */
  chunkRows?: number;
  onProgress?: (fraction: number) => void;
  /** Abort between chunks. */
  signal?: AbortSignal;
  /** Yields to the event loop between chunks (injected in tests). */
  yieldFn?: () => Promise<void>;
}

const defaultYield = () => new Promise<void>((r) => setTimeout(r, 0));

/** Process a whole image; resolves with the same buffer, filtered. Rejects with AbortError if aborted. */
export async function processPixels(data: Uint8ClampedArray, width: number, height: number, opts: ProcessOptions): Promise<Uint8ClampedArray> {
  const chunk = Math.max(1, opts.chunkRows ?? 24);
  const y = opts.yieldFn ?? defaultYield;
  opts.onProgress?.(0);
  for (let y0 = 0; y0 < height; y0 += chunk) {
    if (opts.signal?.aborted) throw new DOMException('Processing aborted', 'AbortError');
    const y1 = Math.min(height, y0 + chunk);
    filterRows(data, width, y0, y1, opts.filter);
    opts.onProgress?.(y1 / height);
    if (y1 < height) await y();
  }
  return data;
}

/** Fit an image of (w, h) inside a maximum edge, preserving aspect. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
