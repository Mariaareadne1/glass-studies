import { expect, test } from '@playwright/test';
import { CATALOG, TOTAL } from './catalog';
import { collectErrors } from './helpers';

test('gallery renders every study without errors and switches theme', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Glass Studies' })).toBeVisible();
  await expect(page.locator('article.study')).toHaveCount(TOTAL);
  for (const [collection, names] of Object.entries(CATALOG)) {
    const region = page.getByRole('region', { name: collection, exact: true });
    await expect(region.locator('article.study')).toHaveCount(names.length);
    for (const name of names) await expect(region.getByRole('heading', { name, exact: true, level: 3 })).toBeAttached();
  }
  // only stages near the viewport hold a GPU context; the first one is live
  await expect(page.locator('.glass-stage').first()).toHaveAttribute('data-backend', /webgl2|canvas2d/);
  const live = await page.locator('.glass-stage').evaluateAll((els) => els.filter((e) => (e as HTMLElement).dataset.backend).length);
  expect(live).toBeLessThan(TOTAL);
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#study-halo').scrollIntoViewIfNeeded();
  await page.getByRole('slider', { name: 'Brightness' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('slider', { name: 'Brightness' })).toHaveAttribute('aria-valuenow', '100');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('focused view opens, switches backdrop and returns with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open Solar in focused view' }).click();
  const dialog = page.getByRole('dialog', { name: /Solar/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Optics test' }).click();
  await expect(dialog).toHaveAttribute('data-env', 'optics');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Solar', exact: true })).toBeFocused();
});

test('fallback renderer is functional and labelled', async ({ page }) => {
  await page.goto('/?fallback');
  await expect(page.locator('.glass-stage').first()).toHaveAttribute('data-backend', 'canvas2d');
  await expect(page.getByText('Frosted fallback · no refraction').first()).toBeVisible();
  const sw = page.getByRole('switch', { name: 'Daylight' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});
