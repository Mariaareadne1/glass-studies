// Side-by-side V1 vs V2 captures of every study (focused view) plus galleries.
// node scripts/compare.mjs [--env=pearl] [--only=solar,halo] [--tag=round1]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const env = opt.env ?? 'pearl';
const tag = opt.tag ?? 'cmp';
const only = opt.only ? opt.only.split(',') : ['solar', 'atmosphere', 'halo', 'thermal', 'modes', 'forecast'];
const bases = { v1: 'http://localhost:5372', v2: 'http://localhost:5373' };
mkdirSync('qa-shots/compare', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [ver, base] of Object.entries(bases)) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 2 });
  for (const id of only) {
    await page.goto(`${base}/?manual&env=${env}#/study/${id}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__glass?.advance(400));
    const frame = page.locator('.focus__frame');
    await frame.screenshot({ path: `qa-shots/compare/${tag}-${id}-${ver}.png` });
  }
  await page.close();
}
await browser.close();
for (const id of only) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', `qa-shots/compare/${tag}-${id}-v1.png`, '-i', `qa-shots/compare/${tag}-${id}-v2.png`, '-filter_complex', '[0][1]scale2ref[a][b];[a][b]hstack,scale=1800:-1', `qa-shots/compare/${tag}-${id}.png`]);
}
console.log('done', only.map((id) => `qa-shots/compare/${tag}-${id}.png`).join(' '));
