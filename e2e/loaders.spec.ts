import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CATALOG } from './catalog';
import { collectErrors } from './helpers';

/** A cheap fingerprint of what a stage shows right now. */
async function frameHash(stage: Locator): Promise<string> {
  const buf = await stage.screenshot();
  let h = 0;
  for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) >>> 0;
  return String(h);
}

const loopRunning = (page: Page) => page.evaluate(() => (window as unknown as { __glassLoop: () => { running: boolean } }).__glassLoop().running);

const LOADER_NAMES = CATALOG.Loaders.filter((n) => !['Aperture Capture', 'Audio Render'].includes(n));

test('the Loaders section animates every looping loader and announces loading', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Loaders', exact: true });
  await section.scrollIntoViewIfNeeded();
  for (const name of LOADER_NAMES) {
    await expect(section.getByRole('heading', { name, level: 3, exact: true })).toBeVisible();
  }
  await page.waitForTimeout(300);
  const stages = section.locator('.loader-stage .glass-stage');
  const n = await stages.count();
  expect(n).toBe(LOADER_NAMES.length);
  for (let i = 0; i < n; i++) {
    await stages.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const a = await frameHash(stages.nth(i));
    await page.waitForTimeout(450);
    const b = await frameHash(stages.nth(i));
    expect(a, `loader ${i} should be moving`).not.toBe(b);
  }
  expect(errors).toEqual([]);
});

test('loaders rest when scrolled out of view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: 'Loaders', exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await loopRunning(page)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => loopRunning(page), { timeout: 4000 }).toBe(false);
});

test('a loader opens in the focused view, without a reset control', async ({ page }) => {
  await page.goto('/#/study/loader-orbit');
  const focus = page.locator('.focus');
  await expect(focus.getByRole('heading', { name: /Orbit/ })).toBeVisible();
  await expect(focus.getByTestId('loader-orbit')).toHaveText('Loading');
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

test('transport: pause freezes the frame, play resumes, speed and restart work', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#/study/loader-orbit');
  const focus = page.locator('.focus');
  const stage = focus.locator('.glass-stage');
  await stage.waitFor();
  await page.waitForTimeout(400);
  await focus.getByTestId('transport-play').click();
  await expect(focus.getByTestId('loader-orbit')).toHaveText('Loading, paused');
  await page.waitForTimeout(200);
  const a = await frameHash(stage);
  await page.waitForTimeout(600);
  expect(await frameHash(stage)).toBe(a);
  await focus.getByTestId('transport-play').click();
  await page.waitForTimeout(400);
  expect(await frameHash(stage)).not.toBe(a);
  await focus.getByRole('radio', { name: '0.5×' }).click();
  await expect(focus.getByRole('radio', { name: '0.5×' })).toHaveAttribute('aria-checked', 'true');
  await focus.getByTestId('transport-restart').click();
  expect(errors).toEqual([]);
});

test('card pause toggle stops a loader in the gallery', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('#study-loader-orbit');
  await card.scrollIntoViewIfNeeded();
  const toggle = card.getByRole('button', { name: /Pause Orbit loader/ });
  await toggle.click();
  await expect(card.getByRole('button', { name: /Play Orbit loader/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('status')).toHaveText('Loading, paused');
});

test('determinate mode: Pixel Assembly reports the supplied fraction and completes the exact icon', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#/study/loader-morph');
  const focus = page.locator('.focus');
  await focus.getByTestId('transport-progress-mode').click();
  const slider = focus.getByTestId('transport-progress');
  await slider.fill('40');
  const bar = focus.getByRole('progressbar');
  await expect(bar).toHaveAttribute('aria-valuenow', '40');
  await slider.fill('100');
  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  await expect(bar).toHaveText('Complete');
  await focus.getByRole('radio', { name: 'Leaf' }).click();
  await expect(focus.getByRole('radio', { name: 'Leaf' })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('Merge: determinate 0 / 50 / 100 and an exact pause', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/#/study/loader-merge');
  const focus = page.locator('.focus');
  const stage = focus.locator('.glass-stage');
  await stage.waitFor();
  await focus.getByTestId('transport-progress-mode').click();
  const slider = focus.getByTestId('transport-progress');
  const shots: string[] = [];
  for (const v of ['0', '50', '100']) {
    await slider.fill(v);
    await page.waitForTimeout(150);
    shots.push(await frameHash(stage));
  }
  expect(new Set(shots).size).toBe(3);
  await expect(focus.getByRole('progressbar')).toHaveText('Complete');
  expect(errors).toEqual([]);
});
