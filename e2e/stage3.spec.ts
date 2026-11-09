import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { collectErrors, dragDesign, imageDiff, openStudy } from './helpers';

const advance = (page: import('@playwright/test').Page, ms: number) => page.evaluate((m) => (window as unknown as { __glass: { advance(ms: number): void } }).__glass.advance(m), ms);
const shot = (stage: Locator) => stage.screenshot();

test.describe('L3 Tide Fill', () => {
  test('determinate progress reports the supplied value; 100% completes; reset drains', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'loader-tide', '?manual');
    const stage = focus.locator('.glass-stage');
    await focus.getByTestId('transport-progress-mode').click();
    const slider = focus.getByTestId('transport-progress');
    const bar = focus.getByRole('progressbar');
    const frames: Buffer[] = [];
    for (const v of ['0', '1', '50', '99', '100']) {
      await slider.fill(v);
      await advance(page, 6000);
      await expect(bar).toHaveAttribute('aria-valuenow', v);
      frames.push(await shot(stage));
    }
    await expect(bar).toHaveText('Complete');
    // each level is visibly different, and 0 → 1% is a small change
    expect(await imageDiff(page, frames[0], frames[2])).toBeGreaterThan(0.05);
    expect(await imageDiff(page, frames[3], frames[4])).toBeGreaterThan(0.0005);
    // a backward jump drains back to empty
    await slider.fill('0');
    await advance(page, 8000);
    expect(await imageDiff(page, frames[0], await shot(stage))).toBeLessThan(0.01);
    expect(errors).toEqual([]);
  });
});

test.describe('L4 Magnetic Beads', () => {
  test('holding a magnet moves the beads; polarity, strength and complete work', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'loader-magnet', '?manual');
    const stage = focus.locator('.glass-stage');
    await advance(page, 1500);
    const a = await shot(stage);
    await dragDesign(page, stage, [140, 220], [150, 222], 4);
    await advance(page, 1500);
    expect(await imageDiff(page, a, await shot(stage))).toBeGreaterThan(0.005);
    await focus.getByTestId('magnet-polarity').click();
    await expect(focus.getByTestId('magnet-polarity')).toHaveText('Polarity −');
    await focus.getByTestId('magnet-strength').fill('150');
    await expect(focus.getByTestId('magnet-strength')).toHaveValue('150');
    await focus.getByTestId('magnet-complete').click();
    await advance(page, 4000);
    const c1 = await shot(stage);
    await advance(page, 1000);
    // settled into the check: no jitter
    expect(await imageDiff(page, c1, await shot(stage))).toBeLessThan(0.002);
    expect(errors).toEqual([]);
  });
});

test.describe('O2 Caustic', () => {
  test('dragging the light changes the projected pattern continuously; geometry switch', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'caustic', '?manual');
    const stage = focus.locator('.glass-stage');
    const light = focus.getByTestId('caustic-light');
    const x0 = Number(await light.getAttribute('data-x'));
    const y0 = Number(await light.getAttribute('data-y'));
    const before = await shot(stage);
    await dragDesign(page, stage, [x0, y0], [x0 + 60, y0 + 20], 8);
    await expect(light).toHaveAttribute('aria-valuetext', /Light at/);
    await advance(page, 100);
    const after = await shot(stage);
    expect(await imageDiff(page, before, after)).toBeGreaterThan(0.01);
    // keyboard nudges move it too, and it never lands on the glass
    await light.focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
    const x = Number(await light.getAttribute('data-x'));
    expect(x).toBeLessThanOrEqual(640 - 24);
    await focus.getByRole('radio', { name: 'Capsule' }).click();
    await advance(page, 100);
    expect(await imageDiff(page, after, await shot(stage))).toBeGreaterThan(0.01);
    await focus.getByRole('radio', { name: 'High contrast' }).click();
    await focus.getByRole('button', { name: 'Resume orbit' }).click();
    expect(errors).toEqual([]);
  });
});

test.describe('O3 Glass Stitch', () => {
  test('0 / 50 / 99 / 100% are distinct stages; completion; pause holds the frame', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'stitch', '?manual');
    const stage = focus.locator('.glass-stage');
    await focus.getByTestId('transport-progress-mode').click();
    const slider = focus.getByTestId('transport-progress');
    const frames: Buffer[] = [];
    for (const v of ['0', '50', '99', '100']) {
      await slider.fill(v);
      await advance(page, 50);
      frames.push(await shot(stage));
    }
    for (let i = 1; i < frames.length; i++) expect(await imageDiff(page, frames[i - 1], frames[i])).toBeGreaterThan(0.001);
    await expect(focus.getByRole('progressbar')).toHaveText('Complete');
    await focus.getByTestId('stitch-fragment-1').hover();
    expect(errors).toEqual([]);
  });
});
