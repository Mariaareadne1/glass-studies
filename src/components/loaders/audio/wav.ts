/** 16-bit PCM WAV encoding and sample analysis for Audio Render (pure, testable). */

export const PEAK_TARGET = 0.89; // ≈ −1 dBFS: loud enough, never clipping

/** Encode mono or interleaved-by-channel float samples as a 16-bit PCM WAV. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  const bytesPerSample = 2;
  const dataBytes = n * ch * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // format: PCM
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * bytesPerSample, true); // byte rate
  v.setUint16(32, ch * bytesPerSample, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      // asymmetric scaling: −1 → −32768, +1 → +32767
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      o += 2;
    }
  }
  return buf;
}

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  frames: number;
  duration: number;
}

/** Parse the header of a WAV produced by encodeWav (used to verify output). */
export function readWavInfo(buf: ArrayBuffer): WavInfo {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data') throw new Error('not a PCM WAV');
  const channels = v.getUint16(22, true);
  const sampleRate = v.getUint32(24, true);
  const bitsPerSample = v.getUint16(34, true);
  const frames = v.getUint32(40, true) / (channels * (bitsPerSample / 8));
  return { channels, sampleRate, bitsPerSample, frames, duration: frames / sampleRate };
}

export function peakOf(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > p) p = a;
  }
  return p;
}

/** Scale to the target peak (never amplifies silence; replaces non-finite samples with 0). */
export function normalize(samples: Float32Array, target = PEAK_TARGET): Float32Array {
  for (let i = 0; i < samples.length; i++) if (!Number.isFinite(samples[i])) samples[i] = 0;
  const p = peakOf(samples);
  if (p < 1e-6) return samples;
  const k = target / p;
  for (let i = 0; i < samples.length; i++) samples[i] *= k;
  return samples;
}

/** Waveform envelope from the real samples: per bin, peak and RMS (0..1). */
export function envelope(samples: Float32Array, bins: number): { peak: number; rms: number }[] {
  const out: { peak: number; rms: number }[] = [];
  const per = Math.max(1, Math.floor(samples.length / bins));
  for (let b = 0; b < bins; b++) {
    let p = 0;
    let s2 = 0;
    const start = b * per;
    const end = Math.min(samples.length, start + per);
    for (let i = start; i < end; i++) {
      const a = Math.abs(samples[i]);
      if (a > p) p = a;
      s2 += samples[i] * samples[i];
    }
    out.push({ peak: p, rms: Math.sqrt(s2 / Math.max(1, end - start)) });
  }
  return out;
}
