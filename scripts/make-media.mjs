// Generates the Glass Scrubber's media from this project's own work (no third-party footage):
//  - public/media/glass-sample.mp4: ~10 s of the Merge, Pixel Assembly and Tide loaders, rendered
//    frame by frame in ?manual time from the running dev server
//  - e2e/fixtures/clip-5s.mp4, clip-20s.mp4: test clips whose white bar width encodes t / duration
// node scripts/make-media.mjs [--base=http://localhost:5373] [--fixtures-only]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split(/=(.*)/s); return [k, v ?? 'true']; }));
const base = opt.base ?? 'http://localhost:5373';
const FPS = 24;

// test fixtures: grey background, a white bar growing with time, a frame-number tick row
for (const d of [5, 20]) {
  // (drawbox evaluates its size once; overlay re-evaluates x every frame)
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x303040:s=320x180:r=${FPS}:d=${d}`,
    '-f', 'lavfi', '-i', `color=c=white:s=320x60:r=${FPS}:d=${d}`,
    '-filter_complex', `[0][1]overlay=x='-w+W*t/${d}':y=60:eval=frame`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', String(FPS), '-movflags', '+faststart', `e2e/fixtures/clip-${d}s.mp4`]);
}
console.log('fixtures written');
if (opt['fixtures-only']) process.exit(0);

const tmp = 'qa-shots/media-frames';
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
let n = 0;
const segments = [
  { id: 'loader-merge', seconds: 3.6 },
  { id: 'loader-morph', seconds: 3.4 },
  { id: 'loader-tide', seconds: 3.0 },
];
for (const seg of segments) {
  await page.goto(`${base}/?manual&env=pearl#/study/${seg.id}`);
  await page.waitForTimeout(900);
  const stage = page.locator('.focus .glass-stage');
  await page.evaluate(() => window.__glass.advance(300));
  for (let i = 0; i < Math.round(seg.seconds * FPS); i++) {
    await page.evaluate((ms) => window.__glass.advance(ms), 1000 / FPS);
    await stage.screenshot({ path: `${tmp}/f${String(n++).padStart(4, '0')}.png` });
  }
}
await browser.close();
execFileSync(ffmpeg, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${tmp}/f%04d.png`,
  '-vf', 'scale=640:-2,crop=640:360:0:(ih-360)/2', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-g', String(FPS), '-movflags', '+faststart', 'public/media/glass-sample.mp4']);
console.log(`sample written from ${n} frames`);
