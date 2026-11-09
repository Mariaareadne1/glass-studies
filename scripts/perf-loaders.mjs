// Frame times with the Glass Loaders section in a normal desktop viewport, then idle check after scrolling away.
// node scripts/perf-loaders.mjs [--base=http://localhost:4373] [--dpr=2] [--w=1440 --h=900]
import { chromium } from '@playwright/test';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const base = opt.base ?? 'http://localhost:4373';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(opt.w ?? 1440), height: +(opt.h ?? 900) }, deviceScaleFactor: +(opt.dpr ?? 2) });
await page.goto(base + '/');
await page.evaluate(() => document.getElementById('loaders').scrollIntoView({ block: 'center' }));
await page.waitForTimeout(800);
const stats = await page.evaluate(async () => {
  const dts = [];
  let last = performance.now();
  const end = last + 4000;
  await new Promise((done) => {
    const loop = (t) => {
      dts.push(t - last);
      last = t;
      if (t < end) requestAnimationFrame(loop);
      else done();
    };
    requestAnimationFrame(loop);
  });
  const s = dts.slice(5).sort((a, b) => a - b);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { frames: s.length, mean: s.reduce((a, b) => a + b, 0) / s.length, p95: pct(0.95), p99: pct(0.99), over33: s.filter((d) => d > 33.4).length };
});
const visibleStages = await page.evaluate(() => [...document.querySelectorAll('.glass-stage')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
const afterScrollAway = await page.evaluate(() => window.__glassLoop());
console.log(JSON.stringify({ viewport: [+(opt.w ?? 1440), +(opt.h ?? 900), +(opt.dpr ?? 2)], visibleStages, stats, afterScrollAway }, null, 2));
await browser.close();
