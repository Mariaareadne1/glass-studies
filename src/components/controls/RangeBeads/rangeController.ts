import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { BEAD, TRACK, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, GlassShape, RGB } from '../../../glass/types';
import { Deformer } from '../../../motion/deformation';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { ledPixels } from '../../../pixels/iconDefinitions';
import { drawPixels } from '../../../pixels/PixelMorph';
import { RANGE_MAX, RANGE_MIN } from '../../../state/controls';
import type { RangeValue } from '../../../state/controls';
import { DOT_GAP, glassInk, ledGlow } from '../shared/ink';
import { clamp, mixRGB, rgba, smoothstep } from '../shared/math';
import type { BeadId } from './rangeMath';

export const RANGE = {
  W: 640,
  H: 440,
  cx: 320,
  cy: 236,
  trackHW: 256,
  trackHH: 16,
  trackRadius: 12,
  /** Beads stand slightly proud of the track; at the minimum gap they just touch. */
  bead: 20,
  /** Inset of the 00:00 and 24:00 positions from the track ends. */
  inset: 36,
  /** Bead distance below which the glass bridge starts to form. */
  bridgeAt: 96,
} as const;

const X0 = RANGE.cx - RANGE.trackHW + RANGE.inset;
const X1 = RANGE.cx + RANGE.trackHW - RANGE.inset;
export const hourToX = (h: number): number => X0 + ((h - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * (X1 - X0);
export const xToHour = (x: number): number => RANGE_MIN + clamp((x - X0) / (X1 - X0)) * (RANGE_MAX - RANGE_MIN);

const DAWN: RGB = [1.0, 0.72, 0.42];
const DUSK: RGB = [0.62, 0.6, 1.0];

/**
 * Dual Range Beads: two glass beads choose an active-hours window. Each bead
 * tracks the hand exactly and stretches with its speed; as they approach,
 * a thin glass bridge grows between them so they read as liquid about to
 * merge. The window between them glows from dawn gold to dusk violet.
 */
export class RangeController implements StageController {
  private start: Spring;
  private end: Spring;
  private deform = { start: new Deformer(0.0011, 0.2), end: new Deformer(0.0011, 0.2) };
  private shape = { start: { along: 1, across: 1, lean: 0 }, end: { along: 1, across: 1, lean: 0 } };
  private edge = new EdgeLight(0.25, 2);
  private invalidate: () => void = () => undefined;
  private reducedMotion = false;
  dragging: BeadId | null = null;

  constructor(r: RangeValue) {
    this.start = new Spring(hourToX(r.start), SPRINGS.track);
    this.end = new Spring(hourToX(r.end), SPRINGS.track);
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.start.config = this.end.config = r ? reduced(SPRINGS.track) : SPRINGS.track;
  }

  setRange(r: RangeValue): void {
    for (const id of ['start', 'end'] as const) {
      if (this.dragging === id) continue;
      const s = this[id];
      if (this.reducedMotion) s.snap(hourToX(r[id]));
      else s.set(hourToX(r[id]));
    }
    this.invalidate();
  }

  hitTrack(x: number, y: number): boolean {
    return Math.abs(x - RANGE.cx) <= RANGE.trackHW + 10 && Math.abs(y - RANGE.cy) <= RANGE.bead + 16;
  }

  beadX(id: BeadId): number {
    return this[id].x;
  }

  /** Direct drag: the bead sits exactly under the hand (already clamped by the caller). */
  dragBead(id: BeadId, hour: number): void {
    const s = this[id];
    const x = hourToX(hour);
    const now = performance.now();
    const dt = Math.max((now - this.lastDrag) / 1000, 1 / 120);
    this.lastDrag = now;
    s.snap(x, clamp((x - s.x) / dt, -3000, 3000));
    this.invalidate();
  }

  private lastDrag = 0;

  touch(strength: number): void {
    this.edge.impulse(strength);
    this.invalidate();
  }

  step(dt: number): boolean {
    let moving = false;
    for (const id of ['start', 'end'] as const) {
      const s = this[id];
      if (this.dragging !== id) s.step(dt);
      else s.v *= Math.exp(-dt * 12); // a held bead's speed fades when the hand pauses
      this.shape[id] = this.reducedMotion ? { along: 1, across: 1, lean: 0 } : this.deform[id].update(s.v, dt, 0.9);
      const settled = s.isSettled(0.05);
      if (settled && this.dragging !== id) s.settle();
      if (!settled || this.deform[id].active) moving = true;
    }
    const v = Math.max(Math.abs(this.start.v), Math.abs(this.end.v));
    this.edge.update(this.reducedMotion ? 0 : v, 2 * (RANGE.trackHW + RANGE.trackHH) * 2, dt);
    return moving || this.dragging !== null || this.edge.active;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    const xs = this.start.x;
    const xe = this.end.x;
    const gap = xe - xs;
    const merge = smoothstep(RANGE.bridgeAt, RANGE.bead * 2 - 4, gap);
    const { cx, cy, trackHW, trackHH, trackRadius, bead: R } = RANGE;

    let track = withTint(TRACK, [0.86, 0.86, 0.95], 0.34);
    track = { ...track, bevel: 18, thickness: 10, milk: 0.85 };
    const beadMat = (c: RGB) => {
      let m = withTint({ ...BEAD, bevel: R, thickness: 26, frost: 0.05, aberration: 0.7, specular: 1.45 }, mixRGB([0.98, 0.97, 1], c, 0.18), 0.28);
      m = { ...withGlow(m, c, 0.2 + 0.2 * merge), halo: 0.3 + 0.3 * merge };
      return dark ? smoked(m, 0.35) : m;
    };
    const bridgeMat = (() => {
      let m = withTint({ ...BEAD, bevel: 10, thickness: 14, frost: 0.05, specular: 1.3 }, mixRGB(DAWN, DUSK, 0.5), 0.25);
      m = withGlow(m, mixRGB(DAWN, DUSK, 0.5), 0.3);
      return dark ? smoked(m, 0.35) : m;
    })();
    if (dark) track = smoked(track);

    const under = ctx.paint('range-under', (g) => {
      // the chosen window glows inside the track, dawn gold to dusk violet
      g.save();
      g.beginPath();
      g.roundRect(cx - trackHW + 5, cy - trackHH + 5, (trackHW - 5) * 2, (trackHH - 5) * 2, trackRadius - 5);
      g.clip();
      const fill = g.createLinearGradient(xs, 0, xe, 0);
      fill.addColorStop(0, rgba(DAWN, dark ? 0.6 : 0.72));
      fill.addColorStop(1, rgba(DUSK, dark ? 0.6 : 0.72));
      g.fillStyle = fill;
      g.fillRect(xs, cy - trackHH, Math.max(0, gap), trackHH * 2);
      g.restore();
      // hour scale below the track
      g.font = `500 ${Math.max(11, 9 / ctx.cssScale).toFixed(1)}px "Geist Mono Variable", ui-monospace, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      for (let h = RANGE_MIN; h <= RANGE_MAX; h++) {
        const x = hourToX(h);
        const major = h % 6 === 0;
        const inside = x >= xs - 1 && x <= xe + 1;
        g.fillStyle = dark ? `rgba(235,235,255,${major ? 0.55 : inside ? 0.4 : 0.22})` : `rgba(60,56,96,${major ? 0.55 : inside ? 0.42 : 0.22})`;
        const s = major ? 3.2 : 2.2;
        g.fillRect(x - s / 2, cy + trackHH + 14, s, s);
        if (major) g.fillText(String(h).padStart(2, '0'), x, cy + trackHH + 24);
      }
    });

    const beadShape = (id: BeadId, x: number): GlassShape => {
      const d = this.shape[id];
      return { cx: x, cy, hw: R * d.along, hh: R * d.across, radius: R * Math.min(d.along, d.across), skew: 0, material: beadMat(id === 'start' ? DAWN : DUSK) };
    };
    const shapes: GlassShape[] = [beadShape('start', xs), beadShape('end', xe)];
    if (merge > 0.01) {
      // the liquid bridge: a thin slab spanning the gap, thickening as the beads close in
      const hh = 3 + 9 * merge;
      shapes.unshift({ cx: (xs + xe) / 2, cy, hw: Math.max(hh, gap / 2), hh, radius: hh, skew: 0, material: bridgeMat });
    }
    const which = this.dragging ?? (Math.abs(this.end.v) > Math.abs(this.start.v) ? 'end' : 'start');
    shapes[shapes.length - (which === 'end' ? 1 : 2)].edge = this.edge.params(mixRGB(which === 'end' ? DUSK : DAWN, [1, 1, 1], 0.35));

    const icons = ctx.paint('range-icons', (g) => {
      const ink = glassInk(dark);
      const opts = { gap: DOT_GAP, ink, glow: 2, glowAlpha: ledGlow(dark, 0.4) };
      drawPixels(g, ledPixels('sun').map((p) => ({ ...p, alpha: 1, size: 1 })), xs, cy, 2.1, ctx.pxPerUnit, { ...opts, scaleX: this.shape.start.along, scaleY: this.shape.start.across });
      drawPixels(g, ledPixels('moon').map((p) => ({ ...p, alpha: 1, size: 1 })), xe, cy, 2.1, ctx.pxPerUnit, { ...opts, scaleX: this.shape.end.along, scaleY: this.shape.end.across });
    });

    return {
      env: {
        kind: ctx.env,
        glowColor: mixRGB(DAWN, DUSK, 0.5),
        glowPos: [(xs + xe) / 2, cy],
        glowRadius: 200 + gap * 0.5,
        glowStrength: dark ? 0.14 : 0.08,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        { shapes: [{ cx, cy, hw: trackHW, hh: trackHH, radius: trackRadius, skew: 0, material: track }] },
        { shapes, above: icons },
      ],
    };
  }
}
