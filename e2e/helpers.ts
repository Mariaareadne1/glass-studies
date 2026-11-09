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

/** Fraction of pixels whose max channel difference exceeds `threshold` (0..255) between two PNGs. */
export async function imageDiff(page: Page, a: Buffer, b: Buffer, threshold = 12): Promise<number> {
  return page.evaluate(
    async ([ua, ub, t]) => {
      const load = (u: string) =>
        new Promise<HTMLImageElement>((res) => {
          const i = new Image();
          i.onload = () => res(i);
          i.src = u;
        });
      const [ia, ib] = await Promise.all([load(ua as string), load(ub as string)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const px = (img: HTMLImageElement) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, w, h).data;
      };
      const da = px(ia);
      const db = px(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > (t as number)) n++;
      }
      return n / (w * h);
    },
    [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`, threshold] as const,
  );
}
