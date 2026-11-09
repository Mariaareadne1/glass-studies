import { expect, test } from '@playwright/test';
import { collectErrors, dragDesign, openStudy, tapDesign } from './helpers';

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

test.describe('C1 Iris', () => {
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
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/1\.8/);
    await page.keyboard.press('End');
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/16/);
    await page.keyboard.press('ArrowLeft');
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/11/);
    await page.mouse.move(0, 0);
    await dial.hover();
    await page.mouse.wheel(0, -120);
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/8/);
    await page.waitForTimeout(800);

    // click a printed number: f/2 sits one step clockwise of the index when f/1.8 is selected
    await page.keyboard.press('Home');
    await page.waitForTimeout(700);
    const a = (-90 + 30) * (Math.PI / 180);
    await tapDesign(page, stage, [236 + Math.cos(a) * 134, 220 + Math.sin(a) * 134]);
    await expect(dial).toHaveAttribute('aria-valuetext', /^f\/2,/);
    expect(errors).toEqual([]);
  });
});

test.describe('C2 Droplet', () => {
  test('only a completed hold toggles quiet mode; short press, slide-off and Escape cancel', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'droplet');
    const stage = focus.locator('.glass-stage');
    const count = focus.getByTestId('droplet-count');
    const quiet = focus.getByTestId('droplet-quiet');
    await expect(count).toHaveText('0 holds');
    await expect(quiet).toHaveAttribute('data-quiet', 'false');

    // 10% and ~80% of the 0.9 s threshold: nothing happens
    await holdDesign(page, stage, [320, 214], 90);
    await holdDesign(page, stage, [320, 214], 650);
    await page.waitForTimeout(400);
    await expect(count).toHaveText('0 holds');

    // pressing then sliding off the drop cancels, even if held long enough afterwards
    const box = (await stage.boundingBox())!;
    const s = box.width / 640;
    await page.mouse.move(box.x + 320 * s, box.y + 214 * s);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.move(box.x + 560 * s, box.y + 60 * s, { steps: 5 });
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect(count).toHaveText('0 holds');

    // a full hold completes once and arms quiet mode
    await holdDesign(page, stage, [320, 214], 1200);
    await expect(count).toHaveText('1 hold');
    await expect(quiet).toHaveAttribute('data-quiet', 'true');
    await expect(focus.getByRole('status').first()).toContainText('Quiet mode on');

    // keyboard: Escape during a Space hold cancels without closing the focused view
    await page.waitForTimeout(1900);
    const button = focus.getByRole('button', { name: /Press and hold to turn quiet mode off/ });
    await button.focus();
    await page.keyboard.down(' ');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await page.keyboard.up(' ');
    await expect(page.locator('.focus')).toBeVisible();
    await expect(count).toHaveText('1 hold');

    // a full keyboard hold reverses the setting
    await button.focus();
    await page.keyboard.down(' ');
    await page.waitForTimeout(1150);
    await page.keyboard.up(' ');
    await expect(count).toHaveText('2 holds');
    await expect(quiet).toHaveAttribute('data-quiet', 'false');
    expect(errors).toEqual([]);
  });
});

test.describe('C3 Drift', () => {
  test('drag maps to exact values, hold keeps them, spring returns to zero, keyboard and double-click', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'drift');
    const pad = focus.getByRole('slider', { name: /Wind/ });
    const stage = focus.locator('.glass-stage');
    await expect(pad).toHaveAttribute('data-value', '0.00,0.00');
    await expect(focus.getByTestId('drift-label')).toHaveText('Still');

    // drag far past the north-east corner: clamps to exactly (1, 1); hold keeps it
    await dragDesign(page, stage, [244, 220], [600, -40], 20);
    await expect(pad).toHaveAttribute('data-value', '1.00,1.00');
    await page.waitForTimeout(800);
    await expect(pad).toHaveAttribute('data-value', '1.00,1.00');
    await expect(focus.getByTestId('drift-label')).toHaveText('East');

    // spring mode: release returns the actual state to zero
    await focus.getByRole('radio', { name: 'Spring back' }).click();
    await dragDesign(page, stage, [244, 220], [120, 330], 12);
    await expect(pad).toHaveAttribute('data-value', '0.00,0.00');

    // keyboard: steps, Shift for fine, Home centres; double-click centres
    await focus.getByRole('radio', { name: 'Hold' }).click();
    await pad.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(pad).toHaveAttribute('data-value', '0.10,0.01');
    await expect(pad).toHaveAttribute('aria-valuetext', /Direction \+0\.10.*strength 51 percent/);
    await page.keyboard.press('Home');
    await expect(pad).toHaveAttribute('data-value', '0.00,0.00');
    await pad.press('ArrowLeft');
    await pad.dblclick();
    await expect(pad).toHaveAttribute('data-value', '0.00,0.00');

    // mode and value persist
    await pad.press('ArrowLeft');
    await page.reload();
    const again = page.locator('.focus').getByRole('slider', { name: /Wind/ });
    await expect(again).toHaveAttribute('data-value', '-0.05,0.00');
    expect(errors).toEqual([]);
  });
});

test.describe('C5 Beads', () => {
  test('beads drag, the window drags as a whole, crossing clamps at 15 min, taps and keys', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'beads');
    const group = focus.getByTestId('beads');
    const start = focus.getByRole('slider', { name: 'Start of active hours' });
    const end = focus.getByRole('slider', { name: 'End of active hours' });
    const stage = focus.locator('.glass-stage');
    await expect(group).toHaveAttribute('data-value', '9-17');
    await expect(focus.getByTestId('beads-span')).toHaveText('8 h window');

    const hx = (h: number) => 320 - 256 + 36 + (h / 24) * (512 - 72);
    await dragDesign(page, stage, [hx(9), 236], [hx(7), 236], 14);
    await expect(group).toHaveAttribute('data-value', '7-17');
    // the window between the beads drags as a whole: duration preserved
    await dragDesign(page, stage, [hx(12), 236], [hx(15), 236], 14);
    await expect(group).toHaveAttribute('data-value', '10-20');
    await expect(focus.getByTestId('beads-span')).toHaveText('10 h window');
    // and clamps at the end of the day
    await dragDesign(page, stage, [hx(15), 236], [hx(30), 236], 14);
    await expect(group).toHaveAttribute('data-value', '14-24');
    // crossing: the end bead stops 15 minutes after the start
    await dragDesign(page, stage, [hx(24), 236], [hx(2), 236], 20);
    await expect(group).toHaveAttribute('data-value', '14-14.25');
    await expect(focus.getByTestId('beads-readout')).toHaveText('14:00 – 14:15');
    // a tap on the bare track moves the nearer bead there
    await tapDesign(page, stage, [hx(4), 236]);
    await expect(group).toHaveAttribute('data-value', '4-14.25');

    await end.focus();
    await page.keyboard.press('ArrowRight');
    await expect(end).toHaveAttribute('aria-valuetext', '14:30');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(end).toHaveAttribute('aria-valuetext', '15:30');
    await page.keyboard.press('End');
    await start.focus();
    await page.keyboard.press('End');
    await expect(group).toHaveAttribute('data-value', '23.75-24');
    expect(errors).toEqual([]);
  });
});
