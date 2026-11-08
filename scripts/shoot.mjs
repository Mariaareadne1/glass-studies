// QA capture: node scripts/shoot.mjs <path> <name> [w] [h] [--dpr=2] [--do=js] [--wait=ms] [--frames=n --interval=ms] [--base=url]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split(/=(.*)/s); return [k, v ?? 'true']; }));
const [path = '/', name = 'shot', w = '1440', h = '960'] = pos;
const base = opt.base ?? 'http://localhost:5373';
mkdirSync('qa-shots', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(opt.dpr ?? 2), reducedMotion: opt.reduced ? 'reduce' : 'no-preference', colorScheme: opt.dark ? 'dark' : 'light' });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + path);
await page.waitForTimeout(+(opt.wait ?? 900));
const manual = path.includes('manual');
if (manual) await page.evaluate(() => window.__glass.advance(34));
if (opt.do) await page.evaluate(opt.do);
if (manual) await page.evaluate(() => window.__glass.advance(17));
if (opt.then) {
  await page.waitForTimeout(80);
  await page.evaluate(opt.then);
}
const clip = opt.clip ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, +opt.clip.split(',')[i]])) : undefined;
const frames = +(opt.frames ?? 1);
for (let i = 0; i < frames; i++) {
  if (i > 0) {
    // with ?manual the page clock is advanced exactly; otherwise wait real time
    if (path.includes('manual')) await page.evaluate((ms) => window.__glass.advance(ms), +(opt.interval ?? 50));
    else await page.waitForTimeout(+(opt.interval ?? 50));
  }
  const file = frames > 1 ? `qa-shots/${name}-${String(i).padStart(2, '0')}.png` : `qa-shots/${name}.png`;
  await page.screenshot({ path: file, fullPage: !!opt.full, clip });
}
const backend = await page.evaluate(() => [...document.querySelectorAll('.glass-stage')].map((e) => e.dataset.backend).join(','));
console.log(JSON.stringify({ name, backend, errors }));
await browser.close();
