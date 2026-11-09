// Pixel regression between two running builds for every study's focused view.
// node scripts/regress.mjs [--a=http://localhost:5375] [--b=http://localhost:5373] [--env=pearl] [--only=a,b]
// Prints mean absolute difference (0..255) and % of pixels that differ by > 10 levels.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const env = opt.env ?? 'pearl';
const A = opt.a ?? 'http://localhost:5375';
const B = opt.b ?? 'http://localhost:5373';
const ids = opt.only ? opt.only.split(',') : ['solar', 'atmosphere', 'halo', 'thermal', 'modes', 'forecast', 'iris', 'droplet', 'drift', 'beads', 'loader-morph', 'loader-tide', 'loader-orbit', 'loader-crystal'];
mkdirSync('qa-shots/regress', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function shoot(base, id) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/?manual&env=${env}#/study/${id}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__glass?.advance(600));
  await page.waitForTimeout(100);
  const buf = await page.locator('.focus__frame .glass-stage').first().screenshot();
  await page.close();
  return buf;
}
const cmp = await browser.newPage();
let worst = 0;
for (const id of ids) {
  const a = await shoot(A, id);
  const b = await shoot(B, id);
  writeFileSync(`qa-shots/regress/${id}-a.png`, a);
  writeFileSync(`qa-shots/regress/${id}-b.png`, b);
  const r = await cmp.evaluate(async ([ua, ub]) => {
    const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const data = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = data(ia), db = data(ib);
    let sum = 0, big = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      sum += d; if (d > 10) big++;
    }
    return { mean: sum / (w * h), pct: (100 * big) / (w * h) };
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
  worst = Math.max(worst, r.pct);
  console.log(`${id.padEnd(16)} mean ${r.mean.toFixed(3)}  >10: ${r.pct.toFixed(3)}%`);
}
await browser.close();
console.log(`worst ${worst.toFixed(3)}%`);
