import { expect, test } from '@playwright/test';
import { collectErrors, dragDesign, openStudy, tapDesign } from './helpers';

test.describe('01 Solar', () => {
  test('click, drag, keyboard and rapid reversal all land on a valid state', async ({ page }) => {
    const errors = collectErrors(page);
    const focus = await openStudy(page, 'solar');
    const sw = focus.getByRole('switch', { name: 'Daylight' });
    const stage = focus.locator('.glass-stage');
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    await tapDesign(page, stage, [500, 220]); // click the day side
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await tapDesign(page, stage, [150, 220]); // click the night side
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    // drag the thumb most of the way and release past the midpoint
    await dragDesign(page, stage, [198, 220], [400, 220]);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    // a short drag back that does not reach the midpoint returns to day
    await dragDesign(page, stage, [442, 220], [400, 222], 20);
    await expect(sw).toHaveAttribute('aria-checked', 'true');

    await sw.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'true');

    // rapid reversals mid-animation
    for (let i = 0; i < 7; i++) await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(900);
    expect(errors).toEqual([]);
  });

  test('state persists across reloads and resets', async ({ page }) => {
    const focus = await openStudy(page, 'solar');
    await focus.getByRole('switch', { name: 'Daylight' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.reload();
    await expect(page.locator('.focus').getByRole('switch', { name: 'Daylight' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Reset study' }).click();
    await expect(page.locator('.focus').getByRole('switch', { name: 'Daylight' })).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('02 Atmosphere', () => {
  test('selecting rain changes state, label and atmosphere; keyboard and drag work', async ({ page }) => {
    const focus = await openStudy(page, 'atmosphere');
    const group = focus.getByRole('radiogroup', { name: 'Weather' });
    await focus.getByRole('radio', { name: 'Rain' }).click();
    await expect(group).toHaveAttribute('data-value', 'rain');
    await expect(focus.getByRole('radio', { name: 'Rain' })).toHaveAttribute('aria-checked', 'true');
    await expect(focus.locator('.slot-labels .is-active')).toHaveText('Rain');

    await focus.getByRole('radio', { name: 'Rain' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group).toHaveAttribute('data-value', 'wind');
    await page.keyboard.press('End');
    await expect(group).toHaveAttribute('data-value', 'snow');
    await page.keyboard.press('Home');
    await expect(group).toHaveAttribute('data-value', 'sun');

    // drag the tile from Sun to the third slot (after it has settled from the keyboard move)
    await page.waitForTimeout(800);
    const stage = focus.locator('.glass-stage');
    await dragDesign(page, stage, [132, 204], [382, 204]);
    await expect(group).toHaveAttribute('data-value', 'wind');

    // rapid switching never strands the selection
    for (const n of ['Snow', 'Sun', 'Rain', 'Snow', 'Wind']) await focus.getByRole('radio', { name: n }).click({ delay: 10 });
    await expect(group).toHaveAttribute('data-value', 'wind');
  });
});

test.describe('03 Halo', () => {
  test('dragging changes the percentage; keys, Home/End and wheel work', async ({ page }) => {
    const focus = await openStudy(page, 'halo');
    const slider = focus.getByRole('slider', { name: 'Brightness' });
    const readout = focus.getByTestId('halo-readout');
    await expect(slider).toHaveAttribute('aria-valuenow', '72');
    await expect(readout).toHaveText('72%');

    const stage = focus.locator('.glass-stage');
    // drag to the top of the dial (270° = 50%)
    await dragDesign(page, stage, [320 + 122 * Math.cos((334 * Math.PI) / 180), 214 + 122 * Math.sin((334 * Math.PI) / 180)], [320, 214 - 122]);
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    await expect(readout).toHaveText('50%');

    // dragging through the bottom gap never flips across the ends
    await dragDesign(page, stage, [320, 92], [320 + 100, 214 + 100]);
    await dragDesign(page, stage, [320 + 100, 214 + 100], [320 - 100, 214 + 100]);
    await expect(slider).toHaveAttribute('aria-valuenow', '100');

    await slider.focus();
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageUp');
    await expect(slider).toHaveAttribute('aria-valuenow', '11');
    await page.keyboard.press('End');
    await expect(readout).toHaveText('100%');
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 300);
    await expect(slider).toHaveAttribute('aria-valuenow', '99');
  });
});

test.describe('04 Thermal', () => {
  test('dragging up increases temperature with exact endpoints', async ({ page }) => {
    const focus = await openStudy(page, 'thermal');
    const slider = focus.getByRole('slider', { name: 'Temperature' });
    const readout = focus.getByTestId('thermal-readout');
    await expect(slider).toHaveAttribute('aria-valuenow', '22');
    const stage = focus.locator('.glass-stage');
    const y22 = 356 + ((92 - 356) * 12) / 25;
    await dragDesign(page, stage, [232, y22], [232, y22 - 60]);
    const up = Number(await slider.getAttribute('aria-valuenow'));
    expect(up).toBeGreaterThan(26);
    await expect(readout).toContainText(String(up).replace(/\.0$/, ''));

    await dragDesign(page, stage, [232, 92 + ((356 - 92) * (35 - up)) / 25], [232, 30]);
    await expect(slider).toHaveAttribute('aria-valuenow', '35');
    await dragDesign(page, stage, [232, 92], [232, 430], 30);
    await expect(slider).toHaveAttribute('aria-valuenow', '10');
    await expect(readout).toContainText('10');

    await slider.focus();
    await page.keyboard.press('ArrowUp');
    await expect(slider).toHaveAttribute('aria-valuenow', '10.5');
    await page.keyboard.press('PageUp');
    await expect(readout).toContainText('15.5');
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuetext', '35 degrees Celsius');
  });
});

test.describe('05 Modes', () => {
  test('selecting Rest changes mode, description and palette', async ({ page }) => {
    const focus = await openStudy(page, 'modes');
    const group = focus.getByRole('radiogroup', { name: 'Mode' });
    await focus.getByRole('radio', { name: 'Rest' }).click();
    await expect(group).toHaveAttribute('data-value', 'rest');
    await expect(focus.getByTestId('mode-line')).toContainText('moon');
    await expect(focus.locator('.slot-labels .is-active')).toHaveText('Rest');
    await expect(focus.locator('.slot-labels .is-active')).toHaveCSS('color', 'rgb(91, 76, 216)');
    await focus.getByRole('radio', { name: 'Rest' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group).toHaveAttribute('data-value', 'bloom');
    await expect(focus.getByTestId('mode-line')).toContainText('bud');
  });
});

test.describe('06 Forecast', () => {
  test('day selection changes data; toggle resizes and hides details; no pointer conflicts', async ({ page }) => {
    const focus = await openStudy(page, 'forecast');
    const temp = focus.getByTestId('forecast-temp');
    await expect(temp).toContainText('24');
    await focus.getByRole('radio', { name: 'Wed' }).click();
    await expect(temp).toContainText('17');
    await expect(focus.getByTestId('forecast')).toHaveAttribute('data-day', 'wed');
    await expect(focus.locator('.fc__cond')).toContainText('Rain');

    const toggle = focus.getByRole('switch', { name: 'Detailed view' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    const stage = focus.locator('.glass-stage');
    const daysBefore = await focus.getByRole('radio', { name: 'Thu' }).boundingBox();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(focus.getByTestId('forecast-details')).toHaveAttribute('aria-hidden', 'true');
    await expect(focus.getByTestId('forecast')).toHaveAttribute('data-day', 'wed'); // toggle did not change the day
    await page.waitForTimeout(900);
    const daysAfter = await focus.getByRole('radio', { name: 'Thu' }).boundingBox();
    expect(daysAfter!.y).toBeLessThan(daysBefore!.y - 20); // the day row moved up with the card

    // the day selector still works at its new position
    await focus.getByRole('radio', { name: 'Thu' }).click();
    await expect(temp).toContainText('19');
    await expect(toggle).toHaveAttribute('aria-checked', 'false'); // selecting a day did not toggle
    await dragDesign(page, stage, [320 + 138, 54 + 246 - 52], [320 - 138, 54 + 246 - 52]);
    await expect(focus.getByTestId('forecast')).toHaveAttribute('data-day', 'mon');
    await toggle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
