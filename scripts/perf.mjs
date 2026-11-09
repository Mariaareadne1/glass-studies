// Performance probe: all six studies on screen, continuous interaction, frame-time stats.
// node scripts/perf.mjs [--base=http://localhost:4373] [--all]
// --all: every study and all four loaders on screen at once (loaders never idle while visible)
import { chromium } from '@playwright/test';

const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:4373';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const all = process.argv.includes('--all');
const page = await browser.newPage({ viewport: { width: 1440, height: all ? 4300 : 2300 }, deviceScaleFactor: 2 });
await page.goto(base + '/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1500);

const idleBefore = await page.evaluate(() => window.__glassLoop());
const stats = await page.evaluate(async (all) => {
  const dts = [];
  let last = performance.now();
  let run = true;
  const loop = (t) => {
    dts.push(t - last);
    last = t;
    if (run) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // drive every study for ~4 s
  const sw = document.querySelector('[data-testid=solar-switch]');
  const atmo = [...document.querySelectorAll('[data-testid=atmosphere] [role=radio]')];
  const modes = [...document.querySelectorAll('[data-testid=modes] [role=radio]')];
  const days = [...document.querySelectorAll('[data-testid=forecast-days] [role=radio]')];
  const halo = document.querySelector('[data-testid=halo]');
  const thermal = document.querySelector('[data-testid=thermal]');
  const key = (el, k) => el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const iris = document.querySelector('[data-testid=iris]');
  const drift = document.querySelector('[data-testid=drift]');
  const beads = document.querySelector('[data-testid=beads-end]');
  for (let i = 0; i < 16; i++) {
    key(sw, i % 2 ? 'ArrowLeft' : 'ArrowRight');
    key(atmo[0], 'ArrowRight');
    key(modes[0], 'ArrowRight');
    key(days[0], 'ArrowRight');
    key(halo, i % 2 ? 'PageDown' : 'PageUp');
    key(thermal, i % 2 ? 'PageDown' : 'PageUp');
    if (all) {
      key(iris, i % 2 ? 'Home' : 'End');
      key(drift, ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'][i % 4]);
      key(beads, i % 2 ? 'PageDown' : 'PageUp');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  run = false;
  const s = dts.slice(5).sort((a, b) => a - b);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { frames: s.length, mean: s.reduce((a, b) => a + b, 0) / s.length, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), over33: s.filter((d) => d > 33.4).length };
}, all);
// note: in --all mode the loaders stay on screen, so idleAfter reports a running loop by design (see perf-loaders.mjs for the idle check)
await page.waitForTimeout(4000);
const idleAfter = await page.evaluate(() => window.__glassLoop());
const contexts = await page.evaluate(() => document.querySelectorAll('.glass-stage canvas').length);
console.log(JSON.stringify({ idleBefore, stats, idleAfter, canvases: contexts }, null, 2));
await browser.close();
