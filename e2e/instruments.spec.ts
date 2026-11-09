import { expect, test } from '@playwright/test';
import { collectErrors, dragDesign, openStudy } from './helpers';

/** Hold the mouse at a design-space point for `ms` milliseconds. */
async function holdDesign(page: import('@playwright/test').Page, stage: import('@playwright/test').Locator, pt: [number, number], ms: number) {
  const box = await stage.boundingBox();
  if (!box) throw new Error('stage not visible');
  const s = box.width / 640;
  await page.mouse.move(box.x + pt[0] * s, box.y + pt[1] * s);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test.describe('07 Iris', () => {
  test('turning the ring, wheel and keyboard step through the f-stops', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'iris');
    const dial = focus.getByRole('slider', { name: 'Aperture' });
    const stage = focus.locator('.glass-stage');
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/2\.8/);

    // turn the ring counter-clockwise by about 60° near its rim: two stops smaller
    await dragDesign(page, stage, [236, 220 - 140], [236 - 121, 220 - 70], 16);
    await expect(dial).toHaveAttribute('aria-valuenow', /^[45]$/);
    // a release flick may carry the ring one detent further
    await expect(focus.getByTestId('iris-readout')).toHaveText(/^f\/(5\.6|8)$/);

    await dial.focus();
    await page.keyboard.press('Home');
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/1\.4/);
    await page.keyboard.press('End');
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/16/);
    await page.keyboard.press('ArrowLeft');
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/11/);
    await page.mouse.move(0, 0);
    await dial.hover();
    await page.mouse.wheel(0, -120);
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/8/);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });
});

test.describe('08 Droplet', () => {
  test('a full hold releases a drop; a short press does not', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'droplet');
    const stage = focus.locator('.glass-stage');
    const count = focus.getByTestId('droplet-count');
    await expect(count).toHaveText('0 drops released');

    await holdDesign(page, stage, [320, 214], 250);
    await page.waitForTimeout(400);
    await expect(count).toHaveText('0 drops released');

    await holdDesign(page, stage, [320, 214], 1200);
    await expect(count).toHaveText('1 drop released');
    await expect(focus.getByRole('status')).toContainText('Drop released');

    // keyboard: hold Space
    await page.waitForTimeout(1900);
    await focus.getByRole('button', { name: 'Release a drop' }).focus();
    await page.keyboard.down(' ');
    await page.waitForTimeout(1150);
    await page.keyboard.up(' ');
    await expect(count).toHaveText('2 drops released');
    expect(errors).toEqual([]);
  });
});

test.describe('09 Drift', () => {
  test('dragging, throwing and keyboard move the puck within the pad', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'drift');
    const pad = focus.getByRole('slider', { name: /Mood/ });
    const stage = focus.locator('.glass-stage');
    await expect(pad).toHaveAttribute('data-value', '50,50');
    await expect(focus.getByTestId('drift-mood')).toHaveText('Balanced');

    // slow drag to the warm/lively corner
    await dragDesign(page, stage, [244, 220], [340, 120], 30);
    await page.waitForTimeout(1500);
    const [x, y] = (await pad.getAttribute('data-value'))!.split(',').map(Number);
    expect(x).toBeGreaterThan(70);
    expect(y).toBeGreaterThan(70);
    await expect(focus.getByTestId('drift-mood')).toHaveText('Lively · Warm');

    // a throw keeps drifting after release (it may bounce), then settles inside the pad
    await dragDesign(page, stage, [300, 160], [200, 200], 3);
    const atRelease = (await pad.getAttribute('data-value'))!.split(',').map(Number);
    await page.waitForTimeout(3500);
    const [x2, y2] = (await pad.getAttribute('data-value'))!.split(',').map(Number);
    for (const v of [x2, y2]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(Math.hypot(x2 - atRelease[0], y2 - atRelease[1])).toBeGreaterThan(3);

    await pad.focus();
    await page.keyboard.press('Home');
    await expect(pad).toHaveAttribute('data-value', '50,50');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(pad).toHaveAttribute('data-value', '50,35');
    await expect(pad).toHaveAttribute('aria-valuetext', /Warmth 50, energy 35/);
    expect(errors).toEqual([]);
  });
});

test.describe('10 Beads', () => {
  test('both beads drag and step by keyboard without crossing', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'beads');
    const group = focus.getByTestId('beads');
    const start = focus.getByRole('slider', { name: 'Start of active hours' });
    const end = focus.getByRole('slider', { name: 'End of active hours' });
    const stage = focus.locator('.glass-stage');
    await expect(group).toHaveAttribute('data-value', '8-18');

    // design x of an hour on the track (mirrors hourToX)
    const hx = (h: number) => 320 - 256 + 36 + (h / 24) * (512 - 72);
    await dragDesign(page, stage, [hx(8), 236], [hx(6), 236], 14);
    await expect(group).toHaveAttribute('data-value', '6-18');
    // drag the end bead far past the start: it stops two hours after it
    await dragDesign(page, stage, [hx(18), 236], [hx(2), 236], 20);
    await expect(group).toHaveAttribute('data-value', '6-8');
    await expect(focus.getByTestId('beads-readout')).toHaveText('06:00 – 08:00');

    await end.focus();
    await page.keyboard.press('End');
    await expect(group).toHaveAttribute('data-value', '6-24');
    await start.focus();
    await page.keyboard.press('ArrowRight');
    await expect(start).toHaveAttribute('aria-valuetext', '06:30');
    await page.keyboard.press('End');
    await expect(group).toHaveAttribute('data-value', '22-24');
    await expect(start).toHaveAttribute('aria-valuemax', '22');
    expect(errors).toEqual([]);
  });
});
