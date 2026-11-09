// Frame-time probe for single focused views (heavy V3 studies).
// node scripts/perf-focus.mjs [--base=http://localhost:4373] [--ids=caustic,stitch,...] [--dpr=2]
import { chromium } from '@playwright/test';
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const base = opt.base ?? 'http://localhost:4373';
const ids = (opt.ids ?? 'caustic,stitch,loader-merge,loader-magnet,tabs,lens-scan,loader-tide').split(',');
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +(opt.dpr ?? 2) });
for (const id of ids) {
  await p.goto(`${base}/#/study/${id}`);
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => new Promise((res) => {
    const t = [];
    let last = performance.now();
    const f = (now) => { t.push(now - last); last = now; if (t.length < 240) requestAnimationFrame(f); else res(t); };
    requestAnimationFrame(f);
  }));
  const s = [...r].sort((a, b) => a - b);
  const q = (k) => s[Math.min(s.length - 1, Math.floor(k * s.length))];
  console.log(`${id.padEnd(15)} mean ${(r.reduce((a, b) => a + b, 0) / r.length).toFixed(1)} ms  p95 ${q(0.95).toFixed(1)}  p99 ${q(0.99).toFixed(1)}  >33ms ${r.filter((x) => x > 33).length}`);
}
await b.close();
