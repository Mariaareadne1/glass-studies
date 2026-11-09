import type { SceneContext } from '../../glass/GlassStage';
import { BEAD, smoked, withTint } from '../../glass/materialPresets';
import type { ContentLayer, GlassScene } from '../../glass/types';
import { Spring } from '../../motion/spring';
import { LOADER, LoopController } from '../loaders/loopController';
import type { LoopMode } from '../loaders/loopController';

export type ScanContent = 'text' | 'lines' | 'checker' | 'image';
export const SCAN_CONTENTS: { id: ScanContent; label: string }[] = [
  { id: 'text', label: 'Microtype' },
  { id: 'lines', label: 'Fine lines' },
  { id: 'checker', label: 'Checker' },
  { id: 'image', label: 'Image' },
];

export const SCAN = {
  /** Track the lens centre travels along, in design units. */
  x0: 128,
  x1: 512,
  y: 206,
  half: 62,
  radius: 30,
  /** The sampled sheet. */
  sheet: { x: 56, y: 124, w: 528, h: 164 },
  period: 4.2,
} as const;

/** Lens centre for a 0..1 position along the track. */
export const scanX = (p: number): number => SCAN.x0 + (SCAN.x1 - SCAN.x0) * Math.min(1, Math.max(0, p));
/** Seamless ping-pong for the loop: a raised cosine, so both turns are soft and the loop has no seam. */
export const scanLoop = (t: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / SCAN.period);

const WORDS =
  'light bends where the glass is thick and passes straight where it is thin a lens is only a surface with a slope every highlight here is computed from that slope refraction is not blur the sheet beneath is sampled through the surface normal'.split(
    ' ',
  );

/**
 * Lens Scan: a thick rounded-square lens travels over a sheet of microtype,
 * fine lines, a checkerboard or a tiny image. The sheet is drawn into the
 * stage's `under` canvas (a texture); the WebGL pass samples that texture
 * through the lens surface normal, so only what the lens covers is displaced.
 * Loop mode ping-pongs; determinate mode places the lens exactly at the
 * supplied fraction and, at 100%, settles on the result and stops.
 */
export class LensScanController extends LoopController {
  override readonly supportsProgress = true;
  content: ScanContent = 'text';
  private sheet: ContentLayer | null = null;
  private sheetKey = '';
  private pos = new Spring(scanLoop(0.6), { stiffness: 170, damping: 24, mass: 1 });

  constructor() {
    super(0.6);
  }

  setContent(c: ScanContent): void {
    this.content = c;
    this.invalidate();
  }

  /** Current lens position 0..1 along the track. */
  get position(): number {
    return this.pos.x;
  }

  get complete(): boolean {
    return this.transport.mode === 'progress' && this.transport.progress >= 1 && Math.abs(this.pos.x - 1) < 0.002;
  }

  protected override onModeChange(_m: LoopMode): void {
    this.invalidate();
  }

  override step(dt: number): boolean {
    const playing = super.step(dt);
    if (this.transport.mode === 'progress') {
      this.pos.set(this.transport.progress);
      this.pos.step(dt);
      // settled at a fixed position: stop asking for frames
      return !this.pos.isSettled(0.0005);
    }
    if (!playing) return false;
    this.pos.snap(this.reducedMotion ? 0.5 : scanLoop(this.t));
    return true;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { sheet } = SCAN;
    const ink = dark ? 'rgba(232,230,248,0.86)' : 'rgba(54,52,78,0.88)';
    const faint = dark ? 'rgba(232,230,248,0.2)' : 'rgba(54,52,78,0.16)';
    const done = this.complete;
    const key = `${this.content}|${done}|${dark}|${ctx.pxPerUnit}`;
    // the sheet only changes with content, theme or completion: reuse the texture otherwise
    const under = key === this.sheetKey && this.sheet ? this.sheet : ctx.paint('lens-sheet', (g) => {
      g.save();
      g.beginPath();
      g.roundRect(sheet.x, sheet.y, sheet.w, sheet.h, 18);
      g.fillStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)';
      g.fill();
      g.clip();
      drawContent(g, this.content, sheet, ink, faint, dark);
      if (done) {
        // the result the scan was looking for, grounded under the lens
        g.fillStyle = dark ? 'rgba(150,220,170,0.22)' : 'rgba(80,170,110,0.16)';
        g.beginPath();
        g.roundRect(SCAN.x1 - SCAN.half + 6, SCAN.y - SCAN.half + 6, SCAN.half * 2 - 12, SCAN.half * 2 - 12, 22);
        g.fill();
      }
      g.restore();
    });
    this.sheet = under;
    this.sheetKey = key;
    let lens = withTint({ ...BEAD, bevel: 58, thickness: 54, frost: 0, aberration: 0.14, specular: 1.25, milk: 0.35, shadow: 0.42 }, [0.98, 0.98, 1], 0.08);
    if (dark) lens = smoked(lens, 0.25);
    const x = scanX(this.pos.x);
    return {
      env: { kind: ctx.env, glowColor: [0.9, 0.9, 1], glowPos: [x, SCAN.y], glowRadius: 120, glowStrength: dark ? 0.08 : 0.03, brightness: 1, time: ctx.time },
      under,
      layers: [
        {
          shapes: [
            {
              cx: x,
              cy: SCAN.y,
              hw: SCAN.half,
              hh: SCAN.half,
              radius: SCAN.radius,
              skew: 0,
              material: lens,
              edge: done ? { head: 0.62, intensity: 0.55, color: [0.7, 0.95, 0.78], direction: 1, width: 0.5, trail: 0.05 } : undefined,
            },
          ],
        },
      ],
    };
  }
}

function drawContent(g: CanvasRenderingContext2D, content: ScanContent, sheet: { x: number; y: number; w: number; h: number }, ink: string, faint: string, dark: boolean): void {
  if (content === 'text') {
    g.fillStyle = ink;
    g.font = '500 10.5px "Geist Mono Variable", ui-monospace, monospace';
    g.textBaseline = 'middle';
    let i = 0;
    for (let y = sheet.y + 18; y < sheet.y + sheet.h - 8; y += 15) {
      let x = sheet.x + 16;
      while (x < sheet.x + sheet.w - 20) {
        const w = WORDS[i++ % WORDS.length];
        g.fillText(w, x, y);
        x += g.measureText(w).width + 7;
      }
    }
  } else if (content === 'lines') {
    g.strokeStyle = ink;
    g.lineWidth = 1;
    for (let x = sheet.x; x < sheet.x + sheet.w; x += 5) {
      g.beginPath();
      g.moveTo(x + 0.5, sheet.y);
      g.lineTo(x + 0.5, sheet.y + sheet.h);
      g.stroke();
    }
    g.strokeStyle = faint;
    for (let y = sheet.y; y < sheet.y + sheet.h; y += 20) {
      g.beginPath();
      g.moveTo(sheet.x, y + 0.5);
      g.lineTo(sheet.x + sheet.w, y + 0.5);
      g.stroke();
    }
  } else if (content === 'checker') {
    const c = 12;
    for (let y = 0; y < sheet.h; y += c)
      for (let x = 0; x < sheet.w; x += c) {
        if (((x / c) | 0) % 2 === ((y / c) | 0) % 2) continue;
        g.fillStyle = ink;
        g.fillRect(sheet.x + x, sheet.y + y, c, c);
      }
  } else {
    // a tiny procedural landscape: sky gradient, sun, layered hills, pixel trees
    const sky = g.createLinearGradient(0, sheet.y, 0, sheet.y + sheet.h);
    sky.addColorStop(0, dark ? '#2b2f52' : '#cfd9f2');
    sky.addColorStop(1, dark ? '#4a3d5e' : '#f4e3d6');
    g.fillStyle = sky;
    g.fillRect(sheet.x, sheet.y, sheet.w, sheet.h);
    g.fillStyle = dark ? '#f1e6c8' : '#ffd08a';
    g.beginPath();
    g.arc(sheet.x + sheet.w * 0.72, sheet.y + 52, 22, 0, Math.PI * 2);
    g.fill();
    const hills = dark ? ['#3e4466', '#2f3452', '#23273e'] : ['#b9c6e0', '#98a8cc', '#7c8cb5'];
    hills.forEach((col, k) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(sheet.x, sheet.y + sheet.h);
      for (let x = 0; x <= sheet.w; x += 8) g.lineTo(sheet.x + x, sheet.y + 96 + k * 18 - 16 * Math.sin(x / (60 + k * 25) + k));
      g.lineTo(sheet.x + sheet.w, sheet.y + sheet.h);
      g.fill();
    });
    g.fillStyle = dark ? '#1a1d2e' : '#4b5a86';
    for (let x = 30; x < sheet.w; x += 46) {
      const base = sheet.y + 130 + 8 * Math.sin(x);
      g.fillRect(sheet.x + x, base - 14, 4, 14);
      g.fillRect(sheet.x + x - 4, base - 22, 12, 10);
    }
  }
  // a quiet ruler under everything: the lens displacement is easy to read on it
  g.fillStyle = faint;
  for (let x = sheet.x + 8; x < sheet.x + sheet.w; x += 8) g.fillRect(x, sheet.y + sheet.h - (x % 40 === 0 ? 10 : 5), 1, x % 40 === 0 ? 10 : 5);
}

export const LENS_STAGE = LOADER;
