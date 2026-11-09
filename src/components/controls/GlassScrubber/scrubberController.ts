import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { BEAD, TRACK, smoked, withTint } from '../../../glass/materialPresets';
import type { GlassScene } from '../../../glass/types';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { SCRUB, timeToX, xToTime } from './scrubberMath';

/** What the stage draws; the component owns the media elements and fills these in. */
export interface ScrubberMedia {
  /** The playing video (drawn into the main frame). */
  video: HTMLVideoElement | null;
  /** Strip of real sampled frames (null until sampled). */
  strip: HTMLCanvasElement | null;
  /** A real frame sampled at the hover time (null when not hovering or not yet decoded). */
  preview: HTMLCanvasElement | null;
  previewTime: number | null;
  status: 'empty' | 'loading' | 'ready' | 'error';
  message: string;
}

/**
 * Glass Scrubber stage: the main frame and the thumbnail strip are drawn from
 * real decoded video into the stage's `under` texture, and a rounded-square
 * glass lens rides the strip – it refracts and magnifies whatever frame is
 * beneath it. While hovering, the cell under the lens is replaced by a frame
 * actually sampled at the hover time.
 */
export class ScrubberController implements StageController {
  media: ScrubberMedia = { video: null, strip: null, preview: null, previewTime: null, status: 'empty', message: '' };
  private lens = new Spring(SCRUB.strip.x, SPRINGS.track);
  private hoverX: number | null = null;
  private dragging = false;
  private playing = false;
  private dirty = true;
  private invalidate: () => void = () => undefined;

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.lens.config = r ? reduced(SPRINGS.track) : SPRINGS.track;
  }

  /** Something in the media changed (new frame, thumbnails, status). */
  refresh(): void {
    this.dirty = true;
    this.invalidate();
  }

  setPlaying(p: boolean): void {
    this.playing = p;
    this.refresh();
  }

  setHover(x: number | null): void {
    this.hoverX = x === null ? null : Math.min(SCRUB.strip.x + SCRUB.strip.w, Math.max(SCRUB.strip.x, x));
    this.refresh();
  }

  setDragging(d: boolean): void {
    this.dragging = d;
  }

  get duration(): number {
    const d = this.media.video?.duration;
    return d && Number.isFinite(d) ? d : 0;
  }

  /** Where the lens should be: under the hand while hovering/dragging, else at the playhead. */
  private lensTarget(): number {
    if (this.hoverX !== null) return this.hoverX;
    return timeToX(this.media.video?.currentTime ?? 0, this.duration);
  }

  hitStrip(x: number, y: number): boolean {
    const s = SCRUB.strip;
    return x >= s.x - 12 && x <= s.x + s.w + 12 && y >= s.y - 18 && y <= s.y + s.h + 18;
  }

  timeAt(x: number): number {
    return xToTime(x, this.duration);
  }

  get lensX(): number {
    return this.lens.x;
  }

  step(dt: number): boolean {
    const target = this.lensTarget();
    if (this.dragging || this.hoverX !== null) this.lens.snap(target);
    else this.lens.set(target);
    this.lens.step(dt);
    const moving = !this.lens.isSettled(0.05);
    const was = this.dirty;
    this.dirty = false;
    return this.playing || moving || was;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const { frame: F, strip: S } = SCRUB;
    const m = this.media;
    const lensX = this.lens.x;
    const under = ctx.paint('scrubber-under', (g) => {
      // main frame
      g.save();
      g.beginPath();
      g.roundRect(F.x, F.y, F.w, F.h, 14);
      g.fillStyle = dark ? '#15161f' : '#e9e7f0';
      g.fill();
      g.clip();
      const v = m.video;
      if (v && m.status === 'ready' && v.readyState >= 2 && v.videoWidth > 0) {
        // contain: never crop the real frame
        const k = Math.min(F.w / v.videoWidth, F.h / v.videoHeight);
        const w = v.videoWidth * k;
        const h = v.videoHeight * k;
        g.drawImage(v, F.x + (F.w - w) / 2, F.y + (F.h - h) / 2, w, h);
      } else {
        g.fillStyle = dark ? 'rgba(235,235,255,0.55)' : 'rgba(60,56,96,0.6)';
        g.font = `500 ${Math.max(13, 11 / ctx.cssScale).toFixed(1)}px "Geist Variable", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const text = m.status === 'loading' ? 'Loading video…' : m.status === 'error' ? m.message : 'No video · open a file or use the sample';
        g.fillText(text, F.x + F.w / 2, F.y + F.h / 2, F.w - 40);
      }
      g.restore();
      // strip of sampled frames
      g.save();
      g.beginPath();
      g.roundRect(S.x, S.y, S.w, S.h, 10);
      g.fillStyle = dark ? '#1b1c27' : '#dedce8';
      g.fill();
      g.clip();
      if (m.strip) g.drawImage(m.strip, S.x, S.y, S.w, S.h);
      // hover: the frame actually decoded at the hover time, centred under the lens
      if (m.preview && m.previewTime !== null && this.hoverX !== null) {
        const ph = S.h;
        const pw = (ph * 16) / 9;
        g.drawImage(m.preview, lensX - pw / 2, S.y, pw, ph);
      }
      // playhead hairline
      const px = timeToX(m.video?.currentTime ?? 0, this.duration);
      g.fillStyle = dark ? 'rgba(255,255,255,0.8)' : 'rgba(40,36,70,0.75)';
      g.fillRect(px - 0.75, S.y, 1.5, S.h);
      g.restore();
    });

    let bezel = withTint({ ...TRACK, bevel: 10, thickness: 5, frost: 0, refraction: 0.6, milk: 0.35, shadow: 0.25 }, [0.95, 0.95, 0.99], 0.06);
    let tray = withTint({ ...TRACK, bevel: 12, thickness: 6, frost: 0.05, milk: 0.4, shadow: 0.22 }, [0.92, 0.92, 0.97], 0.12);
    let lens = withTint({ ...BEAD, bevel: 26, thickness: 34, frost: 0, aberration: 0.18, specular: 1.3, milk: 0.3, shadow: 0.4 }, [0.99, 0.99, 1], 0.06);
    if (dark) {
      bezel = smoked(bezel, 0.4);
      tray = smoked(tray, 0.5);
      lens = smoked(lens, 0.2);
    }
    const L = SCRUB.lensHalf;
    return {
      env: { kind: ctx.env, glowColor: [0.9, 0.9, 1], glowPos: [lensX, S.y], glowRadius: 120, glowStrength: dark ? 0.06 : 0.03, brightness: 1, time: ctx.time },
      under,
      layers: [
        {
          shapes: [
            { cx: F.x + F.w / 2, cy: F.y + F.h / 2, hw: F.w / 2 + 6, hh: F.h / 2 + 6, radius: 20, skew: 0, material: bezel },
            { cx: S.x + S.w / 2, cy: S.y + S.h / 2, hw: S.w / 2 + 8, hh: S.h / 2 + 8, radius: 16, skew: 0, material: tray },
          ],
        },
        { shapes: [{ cx: lensX, cy: S.y + S.h / 2, hw: L, hh: L + 4, radius: SCRUB.lensRadius, skew: 0, material: lens }] },
      ],
    };
  }
}
