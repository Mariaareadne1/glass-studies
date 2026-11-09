import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { collectErrors } from './helpers';

/** A cheap fingerprint of what a stage shows right now. */
async function frameHash(stage: Locator): Promise<string> {
  const buf = await stage.screenshot();
  let h = 0;
  for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) >>> 0;
  return String(h);
}

const loopRunning = (page: Page) => page.evaluate(() => (window as unknown as { __glassLoop: () => { running: boolean } }).__glassLoop().running);

test('the Glass Loaders section animates every loader and announces loading', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Glass Loaders' });
  await section.scrollIntoViewIfNeeded();
  for (const name of ['Pixel Morph', 'Tide Fill', 'Orbit', 'Crystallize']) {
    await expect(section.getByRole('heading', { name, level: 3 })).toBeVisible();
  }
  await expect(section.getByRole('status')).toHaveCount(4);
  const stages = section.locator('.glass-stage');
  await expect(stages).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const a = await frameHash(stages.nth(i));
    await page.waitForTimeout(450);
    const b = await frameHash(stages.nth(i));
    expect(a, `loader ${i} should be moving`).not.toBe(b);
  }
  expect(errors).toEqual([]);
});

test('loaders rest when scrolled out of view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: 'Glass Loaders' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await loopRunning(page)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => loopRunning(page), { timeout: 4000 }).toBe(false);
});

test('a loader opens in the focused view, without a reset control', async ({ page }) => {
  await page.goto('/#/study/loader-orbit');
  const focus = page.locator('.focus');
  await expect(focus.getByRole('heading', { name: /Orbit/ })).toBeVisible();
  await expect(focus.getByRole('status')).toHaveText('Loading');
  await expect(focus.getByRole('button', { name: 'Reset study' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(focus).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('loaders keep a calm signal of activity', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/#/study/loader-tide');
    const stage = page.locator('.focus .glass-stage');
    await stage.waitFor();
    const a = await frameHash(stage);
    await page.waitForTimeout(900);
    const b = await frameHash(stage);
    expect(a).not.toBe(b); // the light breathes even though nothing travels
    expect(errors).toEqual([]);
  });
});
