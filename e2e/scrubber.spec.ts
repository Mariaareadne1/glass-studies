import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import path from 'node:path';
import { collectErrors, dragDesign, openStudy } from './helpers';

const fixture = (name: string) => path.resolve('e2e/fixtures', name);

/**
 * Reads the frame the main video is actually showing: the fixtures draw a white
 * bar whose width is t / duration of the frame width, so the decoded pixels
 * tell us which time was decoded.
 */
async function decodedFraction(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = document.querySelector('.focus [data-testid=scrubber-video]') as HTMLVideoElement;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext('2d')!;
    g.drawImage(v, 0, 0);
    const row = g.getImageData(0, Math.round(c.height / 2), c.width, 1).data;
    let white = 0;
    for (let x = 0; x < c.width; x++) if (row[x * 4] > 200) white++;
    return white / c.width;
  });
}

const timeline = (focus: Locator) => focus.getByTestId('scrubber-timeline');
const timeOf = async (focus: Locator) => Number(await timeline(focus).getAttribute('data-time'));

async function load(page: Page, focus: Locator, file: string, duration: string) {
  await focus.getByTestId('scrubber-file').setInputFiles(fixture(file));
  await expect(timeline(focus)).toHaveAttribute('data-duration', duration);
  await expect(focus.getByTestId('scrubber-status')).toHaveAttribute('data-status', 'ready');
  await expect(timeline(focus)).toHaveAttribute('data-thumbs', 'true');
}

test.describe('C6 Glass Scrubber', () => {
  test('the bundled sample loads with real metadata and sampled thumbnails', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'scrubber');
    await expect(timeline(focus)).toHaveAttribute('data-duration', '10.000');
    await expect(timeline(focus)).toHaveAttribute('data-thumbs', 'true');
    await expect(focus.getByTestId('scrubber-time')).toHaveText('0:00.0 / 0:10.0');
    expect(errors).toEqual([]);
  });

  for (const [file, d] of [['clip-5s.mp4', 5], ['clip-20s.mp4', 20]] as const) {
    test(`seeks to 0 / 50 / 100% of ${file} decode the right frames`, async ({ page }) => {
      const errors = collectErrors(page);
      const focus = await openStudy(page, 'scrubber');
      await load(page, focus, file, d.toFixed(3));
      const tl = timeline(focus);
      await tl.focus();
      for (const [key, frac] of [['End', 1], ['Home', 0]] as const) {
        await page.keyboard.press(key);
        await expect.poll(() => timeOf(focus)).toBeCloseTo(frac * d, 1);
        await page.waitForTimeout(150);
        expect(await decodedFraction(page)).toBeCloseTo(frac, 1);
      }
      // drag to the middle of the strip: release commits the position
      const stage = focus.locator('.glass-stage');
      await dragDesign(page, stage, [64, 332], [320, 332], 18);
      await expect.poll(() => timeOf(focus)).toBeCloseTo(d / 2, 0);
      await page.waitForTimeout(150);
      const f = await decodedFraction(page);
      expect(Math.abs(f - (await timeOf(focus)) / d)).toBeLessThan(0.06);
      // ±5 s keyboard seeks stay in bounds
      await tl.focus();
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
      await expect.poll(() => timeOf(focus)).toBeCloseTo(d, 1);
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => timeOf(focus)).toBeCloseTo(d - 5, 1);
      expect(errors).toEqual([]);
    });
  }

  test('rapid scrubbing never leaves the time out of bounds and lands where released', async ({ page }) => {
    const focus = await openStudy(page, 'scrubber');
    await load(page, focus, 'clip-20s.mp4', '20.000');
    const stage = focus.locator('.glass-stage');
    const box = (await stage.boundingBox())!;
    const s = box.width / 640;
    await page.mouse.move(box.x + 100 * s, box.y + 332 * s);
    await page.mouse.down();
    for (let i = 0; i < 40; i++) await page.mouse.move(box.x + (i % 2 ? 560 : 80) * s, box.y + 332 * s);
    await page.mouse.move(box.x + 448 * s, box.y + 332 * s);
    await page.mouse.up();
    await expect.poll(() => timeOf(focus)).toBeCloseTo(15, 0);
    const t = await timeOf(focus);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(20);
  });

  test('play, pause and mute work on the real element; file replacement and eject', async ({ page }) => {
    const focus = await openStudy(page, 'scrubber');
    await load(page, focus, 'clip-5s.mp4', '5.000');
    await focus.getByTestId('scrubber-play').click();
    await expect(focus.getByTestId('scrubber-play')).toHaveText('Pause');
    await expect.poll(() => timeOf(focus)).toBeGreaterThan(0.4);
    await focus.getByTestId('scrubber-play').click();
    await expect(focus.getByTestId('scrubber-play')).toHaveText('Play');
    await page.waitForTimeout(250);
    const paused = await timeOf(focus);
    await page.waitForTimeout(400);
    expect(await timeOf(focus)).toBeCloseTo(paused, 2);
    await focus.getByTestId('scrubber-mute').click();
    await expect(focus.getByTestId('scrubber-mute')).toHaveText('Mute');
    // replace the file: the new duration is authoritative
    await load(page, focus, 'clip-20s.mp4', '20.000');
    await focus.getByTestId('scrubber-eject').click();
    await expect(focus.getByTestId('scrubber-status')).toHaveAttribute('data-status', 'empty');
    await expect(focus.getByTestId('scrubber-play')).toBeDisabled();
  });

  test('an unsupported file reports a useful error instead of frozen thumbnails', async ({ page }) => {
    const focus = await openStudy(page, 'scrubber');
    await focus.getByTestId('scrubber-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a video') });
    await expect(focus.getByTestId('scrubber-status')).toHaveAttribute('data-status', 'error');
    await expect(focus.getByTestId('scrubber-status')).toContainText('cannot play');
    // a file that claims to be video but is not decodable
    await focus.getByTestId('scrubber-file').setInputFiles({ name: 'broken.mp4', mimeType: 'video/mp4', buffer: Buffer.from('garbage bytes, not mp4') });
    await expect(focus.getByTestId('scrubber-status')).toHaveAttribute('data-status', 'error');
    await focus.getByRole('button', { name: 'Sample' }).click();
    await expect(focus.getByTestId('scrubber-status')).toHaveAttribute('data-status', 'ready');
  });
});
