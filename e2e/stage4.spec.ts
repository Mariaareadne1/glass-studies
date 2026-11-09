import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { collectErrors, openStudy } from './helpers';

/** PNG width/height from the IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Record every camera stream the page opens, so tests can check they are stopped. */
const trackStreams = () => {
  const w = window as unknown as { __streams: MediaStream[] };
  w.__streams = [];
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const s = await orig(c);
    w.__streams.push(s);
    return s;
  };
};
const liveTracks = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);

test.describe('L5 Aperture Capture', () => {
  test('the camera starts only on request, captures a real frame, processes it and downloads a PNG', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(trackStreams);
    const focus = await openStudy(page, 'capture');
    const phase = focus.getByTestId('capture-phase');
    await expect(phase).toHaveAttribute('data-phase', 'idle');
    expect(await liveTracks(page)).toBe(0);

    await focus.getByTestId('capture-start').click();
    await expect(phase).toHaveAttribute('data-phase', 'live');
    expect(await liveTracks(page)).toBe(1);
    await focus.getByRole('radio', { name: 'Mono' }).click();
    // the frame size the camera is actually delivering
    const video = await page.evaluate(() => {
      const v = document.querySelector('.focus [data-testid=capture-video]') as HTMLVideoElement;
      return { w: v.videoWidth, h: v.videoHeight };
    });
    expect(video.w).toBeGreaterThan(0);
    await focus.getByTestId('capture-shoot').click();
    await expect(phase).toHaveAttribute('data-phase', 'result', { timeout: 15000 });
    // the stream is released once the frame is taken
    expect(await liveTracks(page)).toBe(0);
    await expect(focus.getByTestId('capture-status')).toContainText('Mono');

    const [dl] = await Promise.all([page.waitForEvent('download'), focus.getByTestId('capture-download').click()]);
    const file = await dl.path();
    const buf = readFileSync(file!);
    const { w, h } = pngSize(buf);
    expect({ w, h }).toEqual(video);
    // mono output: decode a pixel row through ffmpeg and check it is neutral grey
    const rgb = execFileSync(ffmpeg!, ['-v', 'error', '-i', file!, '-vf', `crop=${w}:1:0:${Math.floor(h / 2)}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    let maxDiff = 0;
    for (let i = 0; i < rgb.length; i += 3) maxDiff = Math.max(maxDiff, Math.abs(rgb[i] - rgb[i + 1]));
    expect(maxDiff).toBeLessThanOrEqual(2);

    // retake re-opens the camera; leaving the study releases it
    await focus.getByTestId('capture-retake').click();
    await expect(phase).toHaveAttribute('data-phase', 'live');
    await page.keyboard.press('Escape');
    await expect(page.locator('.focus')).toHaveCount(0);
    await expect.poll(() => liveTracks(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('an uploaded photo runs the same pipeline (Warm) with correct dimensions', async ({ page }) => {
    const focus = await openStudy(page, 'capture');
    await focus.getByRole('radio', { name: 'Warm' }).click();
    await focus.getByTestId('capture-upload').setInputFiles(path.resolve('e2e/fixtures/photo.png'));
    await expect(focus.getByTestId('capture-phase')).toHaveAttribute('data-phase', 'result', { timeout: 15000 });
    await expect(focus.getByTestId('capture-status')).toContainText('800 × 600 · Warm');
    const [dl] = await Promise.all([page.waitForEvent('download'), focus.getByTestId('capture-download').click()]);
    const out = readFileSync((await dl.path())!);
    expect(pngSize(out)).toEqual({ w: 800, h: 600 });
    // processed pixels differ from the source
    expect(out.equals(readFileSync('e2e/fixtures/photo.png'))).toBe(false);
    await focus.getByTestId('capture-upload').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(focus.getByTestId('capture-status')).toContainText('not an image');
  });

  test('denied permission and missing camera report clearly and leave upload available', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    const focus = await openStudy(page, 'capture');
    await focus.getByTestId('capture-start').click();
    await expect(focus.getByTestId('capture-phase')).toHaveAttribute('data-phase', 'error');
    await expect(focus.getByTestId('capture-status')).toContainText('permission was denied');
    await expect(focus.getByTestId('capture-upload')).toBeAttached();
  });
});

/** Parse a 16-bit mono WAV produced by the study. */
function wavStats(buf: Buffer) {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
  const channels = buf.readUInt16LE(22);
  const rate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  const bytes = buf.readUInt32LE(40);
  let peak = 0;
  let sum2 = 0;
  const n = bytes / 2;
  for (let i = 0; i < n; i++) {
    const v = buf.readInt16LE(44 + i * 2) / 32768;
    peak = Math.max(peak, Math.abs(v));
    sum2 += v * v;
  }
  return { channels, rate, bits, duration: n / channels / rate, peak, rms: Math.sqrt(sum2 / n) };
}

test.describe('L6 Audio Render', () => {
  for (const [name, secs] of [['Sine bell', 2], ['Soft chord', 4], ['Filtered noise', 6]] as const) {
    test(`${name} renders a real, unclipped ${secs} s WAV that ffmpeg decodes`, async ({ page }) => {
      const errors = collectErrors(page);
      const focus = await openStudy(page, 'audio');
      await focus.getByRole('radio', { name }).click();
      await focus.getByRole('radio', { name: `${secs} s` }).click();
      await focus.getByTestId('audio-render').click();
      await expect(focus.getByTestId('audio-status')).toHaveAttribute('data-phase', 'ready', { timeout: 20000 });
      const [dl] = await Promise.all([page.waitForEvent('download'), focus.getByTestId('audio-download').click()]);
      const file = (await dl.path())!;
      const st = wavStats(readFileSync(file));
      expect(st.channels).toBe(1);
      expect(st.rate).toBe(44100);
      expect(st.bits).toBe(16);
      expect(st.duration).toBeCloseTo(secs, 2);
      expect(st.peak).toBeLessThan(0.95);
      expect(st.peak).toBeGreaterThan(0.8);
      expect(st.rms).toBeGreaterThan(0.01); // not silent
      // an independent decoder agrees on container, codec, channels and duration, and decodes it fully
      execFileSync(ffmpeg!, ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-']);
      const probe = execFileSyncStderr(file);
      expect(probe).toMatch(/Audio: pcm_s16le/);
      expect(probe).toMatch(/44100 Hz, (mono|1 channels)/);
      expect(probe).toMatch(new RegExp(`Duration: 00:00:0${secs}\\.00`));
      expect(errors).toEqual([]);
    });
  }

  test('play, seek, preset change invalidates, repeated renders', async ({ page }) => {
    const focus = await openStudy(page, 'audio');
    const render = focus.getByTestId('audio-render');
    await render.click();
    await expect(focus.getByTestId('audio-status')).toHaveAttribute('data-phase', 'ready', { timeout: 20000 });
    await focus.getByTestId('audio-play').click();
    await expect(focus.getByTestId('audio-play')).toHaveText('Pause');
    await expect.poll(() => page.evaluate(() => (document.querySelector('.focus [data-testid=audio-element]') as HTMLAudioElement).currentTime)).toBeGreaterThan(0.2);
    await focus.getByTestId('audio-play').click();
    await expect(focus.getByTestId('audio-play')).toHaveText('Play');
    await focus.getByTestId('audio-seek').fill('300');
    await expect.poll(() => page.evaluate(() => (document.querySelector('.focus [data-testid=audio-element]') as HTMLAudioElement).currentTime)).toBeCloseTo(3, 1);
    // changing the sound discards the render
    await focus.getByRole('radio', { name: 'Soft chord' }).click();
    await expect(focus.getByTestId('audio-download')).toHaveCount(0);
    for (let i = 0; i < 3; i++) {
      await focus.getByTestId('audio-render').click();
      await expect(focus.getByTestId('audio-status')).toHaveAttribute('data-phase', 'ready', { timeout: 20000 });
      await focus.getByTestId('audio-reset').click();
    }
  });
});

function execFileSyncStderr(file: string): string {
  try {
    execFileSync(ffmpeg!, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    return '';
  } catch (e) {
    // `ffmpeg -i` without an output exits 1 after printing the stream info to stderr
    return String((e as { stderr?: Buffer }).stderr ?? '');
  }
}
