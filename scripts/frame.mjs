// Capture focused-view frames of one study with scripted actions in ?manual time.
// node scripts/frame.mjs --id=tabs --env=pearl --steps='[{"do":"js","adv":160,"shot":"name"}]' [--base=http://localhost:5373] [--w=1200 --h=820]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const base = opt.base ?? 'http://localhost:5373';
const env = opt.env ?? 'pearl';
const steps = JSON.parse(opt.steps ?? '[{"shot":"rest"}]');
const out = opt.out ?? 'qa-shots/frames';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +(opt.w ?? 1200), height: +(opt.h ?? 820) }, deviceScaleFactor: +(opt.dpr ?? 2) });
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
// helpers available to step scripts: __key(sel, key, n) sends keydowns to an element in the focused view;
// __click(text) clicks a focused-view button by its text
await page.addInitScript(() => {
  window.__key = (sel, key, n = 1, shift = false) => {
    const el = document.querySelector('.focus ' + sel);
    el.focus();
    for (let i = 0; i < n; i++) el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, shiftKey: shift }));
  };
  window.__range = (sel, v) => {
    const r = document.querySelector('.focus ' + sel);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, String(v));
    r.dispatchEvent(new Event('input', { bubbles: true }));
  };
  window.__click = (text) => [...document.querySelectorAll('.focus button')].find((b) => b.textContent.trim() === text)?.click();
});
await page.goto(`${base}/?manual&env=${env}#/study/${opt.id}`);
if (!opt.keep) { await page.evaluate(() => localStorage.clear()); await page.reload(); }
await page.waitForTimeout(900);
await page.evaluate(() => window.__glass?.advance(500));
for (const s of steps) {
  if (s.do) await page.evaluate(s.do);
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.adv) await page.evaluate((ms) => window.__glass?.advance(ms), s.adv);
  await page.waitForTimeout(60);
  if (s.shot) {
    const target = page.locator(s.sel ?? '.focus__frame');
    await target.screenshot({ path: `${out}/${opt.id}-${env}-${s.shot}.png` });
    console.log(`${out}/${opt.id}-${env}-${s.shot}.png`);
  }
  if (s.log) console.log(s.shot ?? 'log', JSON.stringify(await page.evaluate(s.log)));
}
await browser.close();
