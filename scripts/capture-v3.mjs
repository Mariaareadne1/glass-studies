// QA captures for the V3 instruments with real pointer/keyboard input.
// node scripts/capture-v3.mjs [--env=pearl|midnight] [--base=http://localhost:5373]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const env = opt.env ?? 'pearl';
const base = opt.base ?? 'http://localhost:5373';
const only = opt.only ? opt.only.split(',') : null;
mkdirSync('qa-shots/v3', { recursive: true });

/** Each shot: study id, file suffix, and an async action run before the capture. */
const SHOTS = [
  ['iris', 'rest', async () => {}],
  ['droplet', 'rest', async () => {}],
  ['droplet', 'hold', async (p) => { await p.locator('.focus [data-testid=droplet]').focus(); await p.keyboard.down(' '); await adv(p, 520); }],
  ['droplet', 'released', async (p) => { await p.locator('.focus [data-testid=droplet]').focus(); await p.keyboard.down(' '); await adv(p, 1000); await p.keyboard.up(' '); await adv(p, 260); }],
  ['drift', 'rest', async () => {}],
  ['drift', 'moved', async (p) => { await p.locator('.focus [data-testid=drift]').focus(); for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowRight'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowUp'); await adv(p, 120); }],
  ['beads', 'rest', async () => {}],
  ['beads', 'near', async (p) => { await p.locator('.focus [data-testid=beads-end]').focus(); for (let i = 0; i < 4; i++) await p.keyboard.press('PageDown'); await adv(p, 900); }],
];
const adv = (p, ms) => p.evaluate((m) => window.__glass.advance(m), ms);

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
for (const [id, name, act] of SHOTS) {
  if (only && !only.includes(id)) continue;
  await page.goto(`${base}/?manual&env=${env}#/study/${id}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(900);
  await adv(page, 400);
  await act(page);
  await page.waitForTimeout(60);
  await page.locator('.focus__frame').screenshot({ path: `qa-shots/v3/${id}-${name}-${env}.png` });
  await page.keyboard.up(' '); // never leave a key held into the next shot
}
await browser.close();
console.log(JSON.stringify({ env, errors }));
