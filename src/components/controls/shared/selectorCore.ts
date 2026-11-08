import { perimeterLength } from '../../../glass/geometry';
import type { EdgeLightParams, RGB } from '../../../glass/types';
import { Deformer } from '../../../motion/deformation';
import type { Deform } from '../../../motion/deformation';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import type { Pixel } from '../../../pixels/iconDefinitions';
import { PixelMorpher } from '../../../pixels/PixelMorph';
import type { StaggerMode } from '../../../pixels/morphAlgorithm';
import { rubber } from './math';

export interface SelectorGeometry {
  /** Slot centres along x (design units). */
  slots: readonly number[];
  y: number;
  tileHW: number;
  tileHH: number;
  tileRadius: number;
}

export interface SelectorTuning {
  stretchGain: number;
  maxStretch: number;
  leanAmp: number;
  edgeGain: number;
}

/** Nearest slot to a position after projecting it forward by velocity. */
export function nearestSlot(slots: readonly number[], x: number, vx = 0): number {
  const projected = x + vx * 0.1;
  let best = 0;
  for (let i = 1; i < slots.length; i++) {
    if (Math.abs(slots[i] - projected) < Math.abs(slots[best] - projected)) best = i;
  }
  return best;
}

/**
 * Shared engine for the sliding-tile selectors (Atmosphere, Modes, the
 * Forecast day picker): one glass tile on a spring travelling between slots,
 * velocity-driven deformation, a traveling edge light and a pixel morph.
 */
export class SelectorCore {
  readonly geo: SelectorGeometry;
  readonly pos: Spring;
  index: number;
  private deformer: Deformer;
  readonly edge: EdgeLight;
  readonly morph: PixelMorpher;
  private tuning: SelectorTuning;
  dragging = false;
  private grab = 0;
  private reducedMotion = false;
  deform: Deform = { along: 1, across: 1, lean: 0 };

  constructor(geo: SelectorGeometry, index: number, icon: readonly Pixel[], tuning: Partial<SelectorTuning> = {}) {
    this.geo = geo;
    this.index = index;
    this.tuning = { stretchGain: 0.0008, maxStretch: 0.22, leanAmp: 1, edgeGain: 2.4, ...tuning };
    this.pos = new Spring(geo.slots[index], SPRINGS.travel);
    this.deformer = new Deformer(this.tuning.stretchGain, this.tuning.maxStretch);
    this.edge = new EdgeLight(0.2, this.tuning.edgeGain);
    this.morph = new PixelMorpher(icon);
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.pos.config = r ? reduced(SPRINGS.travel) : SPRINGS.travel;
  }

  get isReduced(): boolean {
    return this.reducedMotion;
  }

  /** Select a slot; returns true when this was a change. */
  select(i: number, icon: readonly Pixel[], stagger: StaggerMode = 'sweep-x', duration = 0.62): boolean {
    if (i === this.index && this.pos.target === this.geo.slots[i]) return false;
    const dir = this.geo.slots[i] >= this.pos.x ? 1 : -1;
    const changed = i !== this.index;
    this.index = i;
    if (!this.dragging) this.pos.set(this.geo.slots[i]);
    if (changed) {
      this.edge.impulse(0.8, dir);
      if (this.reducedMotion) this.morph.show(icon);
      else this.morph.morphTo(icon, { seed: i * 13 + 5, stagger, direction: dir, duration });
    }
    return changed;
  }

  hitTile(x: number, y: number): boolean {
    return Math.abs(x - this.pos.x) <= this.geo.tileHW + 6 && Math.abs(y - this.geo.y) <= this.geo.tileHH + 6;
  }

  beginDrag(x: number): void {
    this.dragging = true;
    this.grab = x - this.pos.x;
    this.edge.impulse(0.4);
  }

  drag(x: number, vx: number): void {
    const s = this.geo.slots;
    const lo = s[0];
    const hi = s[s.length - 1];
    const raw = x - this.grab;
    const span = hi - lo;
    const t = (raw - lo) / span;
    const p = t < 0 ? rubber(t) : t > 1 ? 1 + rubber(t - 1) : t;
    this.pos.snap(lo + p * span, vx);
  }

  /** Returns the slot the tile settles into. */
  endDrag(vx: number): number {
    this.dragging = false;
    const i = nearestSlot(this.geo.slots, this.pos.x, vx);
    this.pos.v = Math.max(-3000, Math.min(3000, vx));
    this.pos.set(this.geo.slots[i]);
    return i;
  }

  step(dt: number): boolean {
    if (!this.dragging) this.pos.step(dt);
    const v = this.pos.v;
    this.deform = this.reducedMotion ? { along: 1, across: 1, lean: 0 } : this.deformer.update(v, dt);
    this.deform = { ...this.deform, lean: this.deform.lean * this.tuning.leanAmp };
    const per = perimeterLength({ hw: this.geo.tileHW, hh: this.geo.tileHH, radius: this.geo.tileRadius });
    this.edge.update(this.reducedMotion ? 0 : v, per, dt);
    const morphing = this.morph.step(dt);
    const settled = this.pos.isSettled(0.05);
    if (settled && !this.dragging) this.pos.settle();
    return this.dragging || !settled || morphing || this.deformer.active || this.edge.active;
  }

  /** Continuous position as a fractional slot index (for colour blending). */
  get fractionalIndex(): number {
    const s = this.geo.slots;
    const x = this.pos.x;
    if (x <= s[0]) return 0;
    for (let i = 0; i < s.length - 1; i++) {
      if (x <= s[i + 1]) return i + (x - s[i]) / (s[i + 1] - s[i]);
    }
    return s.length - 1;
  }

  tile(): { cx: number; cy: number; hw: number; hh: number; radius: number; skew: number } {
    const d = this.deform;
    return {
      cx: this.pos.x,
      cy: this.geo.y,
      hw: this.geo.tileHW * d.along,
      hh: this.geo.tileHH * d.across,
      radius: this.geo.tileRadius,
      skew: d.lean,
    };
  }

  edgeParams(color: RGB): EdgeLightParams {
    return this.edge.params(color);
  }
}
