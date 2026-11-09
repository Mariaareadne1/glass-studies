// Frames from each Glass Loader across one loop: node scripts/capture-loaders.mjs [--env=pearl] [--reduced]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const env = opt.env ?? 'pearl';
const base = opt.base ?? 'http://localhost:5373';
const LOOPS = { 'loader-morph': 4600, 'loader-tide': 3600, 'loader-orbit': 1800, 'loader-crystal': 2800 };
const FRAMES = 6;
mkdirSync('qa-shots/loaders', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1, reducedMotion: opt.reduced ? 'reduce' : 'no-preference' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const tag = `${env}${opt.reduced ? '-reduced' : ''}`;
for (const [id, loop] of Object.entries(LOOPS)) {
  await page.goto(`${base}/?manual&env=${env}#/study/${id}`);
  await page.waitForTimeout(900);
  const files = [];
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate((ms) => window.__glass.advance(ms), i === 0 ? 50 : loop / FRAMES);
    const f = `qa-shots/loaders/${id}-${tag}-${i}.png`;
    await page.locator('.focus__frame').screenshot({ path: f });
    files.push(f);
  }
  execFileSync(ffmpeg, ['-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', `${files.map((_, i) => `[${i}]`).join('')}hstack=${files.length},scale=2400:-1`, `qa-shots/loaders/${id}-${tag}-strip.png`]);
}
await browser.close();
console.log(JSON.stringify({ tag, errors }));
