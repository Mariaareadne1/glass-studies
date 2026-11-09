// Side-by-side captures of studies (focused view) from two running builds.
// node scripts/compare.mjs [--env=pearl] [--only=solar,halo] [--tag=round1]
//   [--a=http://localhost:5372 --b=http://localhost:5373]   (default: V1 tag worktree | current)
//   [--do="js run after load"] [--adv=ms advanced after --do]  (e.g. capture a mid-transition "active" frame)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const env = opt.env ?? 'pearl';
const tag = opt.tag ?? 'cmp';
const only = opt.only ? opt.only.split(',') : ['solar', 'atmosphere', 'halo', 'thermal', 'modes', 'forecast'];
const bases = { a: opt.a ?? 'http://localhost:5372', b: opt.b ?? 'http://localhost:5373' };
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
    if (opt.do) {
      await page.evaluate(opt.do);
      await page.waitForTimeout(80);
      await page.evaluate((ms) => window.__glass?.advance(ms), +(opt.adv ?? 0));
    }
    const frame = page.locator('.focus__frame');
    await frame.screenshot({ path: `qa-shots/compare/${tag}-${id}-${ver}.png` });
  }
  await page.close();
}
await browser.close();
for (const id of only) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', `qa-shots/compare/${tag}-${id}-a.png`, '-i', `qa-shots/compare/${tag}-${id}-b.png`, '-filter_complex', '[0][1]scale2ref[a][b];[a][b]hstack,scale=1800:-1', `qa-shots/compare/${tag}-${id}.png`]);
}
console.log('done', only.map((id) => `qa-shots/compare/${tag}-${id}.png`).join(' '));
