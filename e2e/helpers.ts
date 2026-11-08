import type { Locator, Page } from '@playwright/test';

/** Open a study in the focused view on a fresh state. */
export async function openStudy(page: Page, id: string, query = ''): Promise<Locator> {
  await page.goto(`/${query}#/study/${id}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const focus = page.locator('.focus');
  await focus.locator('.glass-stage').waitFor();
  return focus;
}

/** Drag between two points given in the stage's design units (640×440). */
export async function dragDesign(page: Page, stage: Locator, from: [number, number], to: [number, number], steps = 12): Promise<void> {
  const box = await stage.boundingBox();
  if (!box) throw new Error('stage not visible');
  const s = box.width / 640;
  const p = (pt: [number, number]) => [box.x + pt[0] * s, box.y + pt[1] * s] as const;
  const a = p(from);
  const b = p(to);
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  await page.mouse.move(b[0], b[1], { steps });
  await page.mouse.up();
}

export async function tapDesign(page: Page, stage: Locator, pt: [number, number]): Promise<void> {
  const box = await stage.boundingBox();
  if (!box) throw new Error('stage not visible');
  const s = box.width / 640;
  await page.mouse.click(box.x + pt[0] * s, box.y + pt[1] * s);
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
