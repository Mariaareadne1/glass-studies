import { expect, test } from '@playwright/test';

test('mobile: single column, no horizontal overflow, touch toggles and drags', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const cards = page.locator('article.study');
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1); // stacked, not side by side

  const stage = page.locator('#study-solar .glass-stage');
  const box = (await stage.boundingBox())!;
  const s = box.width / 640;
  await page.touchscreen.tap(box.x + 500 * s, box.y + 220 * s);
  await expect(page.getByRole('switch', { name: 'Daylight' })).toHaveAttribute('aria-checked', 'true');

  // touch drag on Thermal via synthetic pointer events (touch type)
  await page.locator('#study-thermal').scrollIntoViewIfNeeded();
  const t = page.locator('#study-thermal .glass-stage__overlay');
  const tb = (await t.boundingBox())!;
  const ts = tb.width / 640;
  const y22 = 356 + ((92 - 356) * 12) / 25;
  await t.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: tb.x + 232 * ts, clientY: tb.y + y22 * ts, button: 0, buttons: 1 });
  for (let i = 1; i <= 8; i++) {
    await t.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: tb.x + 232 * ts, clientY: tb.y + (y22 + i * 10) * ts, buttons: 1 });
  }
  await t.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: tb.x + 232 * ts, clientY: tb.y + (y22 + 80) * ts });
  const v = Number(await page.getByRole('slider', { name: 'Temperature' }).getAttribute('aria-valuenow'));
  expect(v).toBeLessThan(22);
});
