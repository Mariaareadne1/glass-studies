import { expect, test } from '@playwright/test';
import { collectErrors, imageDiff, openStudy, tapDesign } from './helpers';

test.describe('C4 Liquid Tabs', () => {
  test('click and keyboard select tabs; panel content follows; rapid 1→4→2 lands on 2', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'tabs');
    const list = focus.getByRole('tablist', { name: 'Glass Studies guide' });
    const panel = focus.getByRole('tabpanel');
    await expect(list.getByRole('tab')).toHaveCount(4);
    await expect(focus.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel).toHaveAttribute('data-tab', 'Overview');

    await focus.getByRole('tab', { name: 'Optics' }).click();
    await expect(panel).toHaveAttribute('data-tab', 'Optics');
    await expect(panel).toContainText('smooth minimum');

    // rapid 1 → 4 → 2
    await focus.getByRole('tab', { name: 'Overview' }).click();
    await focus.getByRole('tab', { name: 'Source' }).click();
    await focus.getByRole('tab', { name: 'Motion' }).click();
    await expect(panel).toHaveAttribute('data-tab', 'Motion');
    await expect(focus.getByRole('tab', { name: 'Motion' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel).toHaveAttribute('aria-labelledby', (await focus.getByRole('tab', { name: 'Motion' }).getAttribute('id'))!);

    // keyboard: automatic activation, Home / End, wrap
    await focus.getByRole('tab', { name: 'Motion' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(focus.getByRole('tab', { name: 'Optics' })).toBeFocused();
    await expect(panel).toHaveAttribute('data-tab', 'Optics');
    await page.keyboard.press('End');
    await expect(panel).toHaveAttribute('data-tab', 'Source');
    await page.keyboard.press('ArrowRight');
    await expect(panel).toHaveAttribute('data-tab', 'Overview');
    await page.keyboard.press('Home');
    await expect(focus.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabindex', '0');
    await expect(focus.getByRole('tab', { name: 'Source' })).toHaveAttribute('tabindex', '-1');

    // persists
    await focus.getByRole('tab', { name: 'Source' }).click();
    await page.reload();
    await expect(page.locator('.focus').getByRole('tabpanel')).toHaveAttribute('data-tab', 'Source');
    expect(errors).toEqual([]);
  });
});

test.describe('O1 Lens Scan', () => {
  test('pressing the sheet places the lens; 100% completes; content switches', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'lens-scan');
    const stage = focus.locator('.glass-stage');
    await expect(focus.getByTestId('lens-caption')).toHaveText(/indeterminate/);
    await tapDesign(page, stage, [320, 206]);
    const bar = focus.getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', /^(4[89]|5[012])$/);
    await focus.getByTestId('transport-progress').fill('100');
    await expect(focus.getByTestId('lens-caption')).toHaveText('✓ Scan complete');
    for (const name of ['Fine lines', 'Checker', 'Image', 'Microtype']) {
      await focus.getByRole('radio', { name }).click();
      await expect(focus.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    }
    expect(errors).toEqual([]);
  });

  test('refraction: pixels change only where the lens is', async ({ page }) => {
    const focus = await openStudy(page, 'lens-scan', '?manual');
    const stage = focus.locator('.glass-stage');
    await focus.getByRole('radio', { name: 'Checker' }).click();
    await focus.getByTestId('transport-progress-mode').click();
    await focus.getByTestId('transport-progress').fill('0');
    await page.evaluate(() => (window as unknown as { __glass: { advance(ms: number): void } }).__glass.advance(2000));
    const box = (await stage.boundingBox())!;
    const s = box.width / 640;
    // far right of the sheet (lens at the left end) vs. after moving the lens there
    const clip = { x: box.x + 450 * s, y: box.y + 150 * s, width: 120 * s, height: 110 * s };
    // the middle of the sheet is under the lens at neither end
    const middle = { x: box.x + 262 * s, y: box.y + 140 * s, width: 40 * s, height: 120 * s };
    const before = await page.screenshot({ clip });
    const untouched = await page.screenshot({ clip: middle });
    await focus.getByTestId('transport-progress').fill('100');
    await page.evaluate(() => (window as unknown as { __glass: { advance(ms: number): void } }).__glass.advance(2500));
    const after = await page.screenshot({ clip });
    expect(await imageDiff(page, before, after)).toBeGreaterThan(0.05);
    const untouchedAgain = await page.screenshot({ clip: middle });
    expect(await imageDiff(page, untouched, untouchedAgain)).toBeLessThan(0.002);
  });
});
