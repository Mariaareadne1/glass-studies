import { describe, expect, test } from 'vitest';
import { filterRows, fitWithin, processPixels } from '../components/loaders/capture/imagePipeline';
import { encodeWav, envelope, normalize, peakOf, PEAK_TARGET, readWavInfo } from '../components/loaders/audio/wav';

const image = (w: number, h: number) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = (i * 7) % 256;
    d[i * 4 + 1] = (i * 13) % 256;
    d[i * 4 + 2] = (i * 29) % 256;
    d[i * 4 + 3] = 255;
  }
  return d;
};

describe('Aperture Capture pipeline', () => {
  test('mono makes every pixel neutral; warm raises red and lowers blue; pearl lifts shadows', () => {
    const mono = image(8, 8);
    filterRows(mono, 8, 0, 8, 'mono');
    for (let i = 0; i < mono.length; i += 4) {
      expect(Math.abs(mono[i] - mono[i + 1])).toBeLessThanOrEqual(1);
      expect(mono[i + 3]).toBe(255);
    }
    const src = image(8, 8);
    const warm = image(8, 8);
    filterRows(warm, 8, 0, 8, 'warm');
    let dr = 0;
    let db = 0;
    for (let i = 0; i < src.length; i += 4) {
      dr += warm[i] - src[i];
      db += warm[i + 2] - src[i + 2];
    }
    expect(dr).toBeGreaterThan(0);
    expect(db).toBeLessThan(0);
    const black = new Uint8ClampedArray([0, 0, 0, 255]);
    filterRows(black, 1, 0, 1, 'pearl');
    expect(black[0]).toBeGreaterThan(20);
  });

  test('processing reports monotonic measured progress ending at 1 and filters every row', async () => {
    const d = image(10, 50);
    const before = new Uint8ClampedArray(d);
    const seen: number[] = [];
    await processPixels(d, 10, 50, { filter: 'mono', chunkRows: 7, onProgress: (p) => seen.push(p), yieldFn: async () => undefined });
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    expect(seen).toHaveLength(1 + Math.ceil(50 / 7));
    // last row changed too
    const last = (49 * 10) * 4;
    expect(d[last] !== before[last] || d[last + 1] !== before[last + 1]).toBe(true);
  });

  test('aborting stops between chunks', async () => {
    const a = new AbortController();
    const d = image(4, 100);
    const p = processPixels(d, 4, 100, { filter: 'warm', chunkRows: 10, signal: a.signal, onProgress: (f) => f > 0.25 && a.abort(), yieldFn: async () => undefined });
    await expect(p).rejects.toThrow(/aborted/);
  });

  test('large images are fitted inside the maximum edge, keeping aspect', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(640, 480, 1600)).toEqual({ w: 640, h: 480 });
  });
});

describe('Audio Render WAV', () => {
  test('header fields, size and duration are exact', () => {
    const n = 44100 * 2;
    const s = new Float32Array(n).map((_, i) => Math.sin(i / 10) * 0.5);
    const buf = encodeWav([s], 44100);
    expect(buf.byteLength).toBe(44 + n * 2);
    const info = readWavInfo(buf);
    expect(info).toEqual({ channels: 1, sampleRate: 44100, bitsPerSample: 16, frames: n, duration: 2 });
  });

  test('PCM scaling: −1 → −32768, +1 → 32767, out-of-range clamps', () => {
    const v = new DataView(encodeWav([new Float32Array([-1, 1, 0, 2, -3])], 8000));
    expect(v.getInt16(44, true)).toBe(-32768);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(0);
    expect(v.getInt16(50, true)).toBe(32767);
    expect(v.getInt16(52, true)).toBe(-32768);
  });

  test('normalize hits the target peak, removes non-finite samples and leaves silence alone', () => {
    const s = normalize(new Float32Array([0.1, -0.4, Number.NaN, 0.2]));
    expect(peakOf(s)).toBeCloseTo(PEAK_TARGET, 6);
    expect(s[2]).toBe(0);
    expect(peakOf(normalize(new Float32Array(10)))).toBe(0);
  });

  test('the envelope follows the actual samples', () => {
    const s = new Float32Array(1000);
    for (let i = 500; i < 1000; i++) s[i] = i % 2 ? 0.8 : -0.8;
    const e = envelope(s, 10);
    expect(e).toHaveLength(10);
    expect(e[0].peak).toBe(0);
    expect(e[9].peak).toBeCloseTo(0.8, 6);
    expect(e[9].rms).toBeCloseTo(0.8, 6);
  });
});
