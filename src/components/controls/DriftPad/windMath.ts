import type { Pixel } from '../../../pixels/iconDefinitions';
import type { DriftValue } from '../../../state/controls';
import type { RGB } from '../../../glass/types';

export const DRIFT = {
  W: 640,
  H: 440,
  cx: 244,
  cy: 220,
  padHalf: 168,
  padRadius: 44,
  puckHalf: 38,
  puckRadius: 22,
  /** Gap kept between the puck and the pad wall. */
  inset: 14,
} as const;

/** Travel of the puck centre from the pad centre to its limit, in design units. */
export const TRAVEL = DRIFT.padHalf - DRIFT.puckHalf - DRIFT.inset;

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * The one transform between the pad and the value: design-unit position ↔
 * normalised [-1, 1]² (y up). Client coordinates reach it through the stage
 * scale (usePointerDrag), so page scroll, zoom, resize and DPR never enter.
 */
export function toValue(x: number, y: number): DriftValue {
  return { x: clampUnit((x - DRIFT.cx) / TRAVEL), y: clampUnit((DRIFT.cy - y) / TRAVEL) };
}

export function toPosition(v: DriftValue): { x: number; y: number } {
  return { x: DRIFT.cx + clampUnit(v.x) * TRAVEL, y: DRIFT.cy - clampUnit(v.y) * TRAVEL };
}

/** Strength as a 0..100 percentage for people (−1 calm → 0%, +1 strong → 100%). */
export const strengthPct = (v: DriftValue): number => Math.round(((v.y + 1) / 2) * 100);

export function directionLabel(v: DriftValue): string {
  if (Math.abs(v.x) < 0.08) return 'Still';
  const word = v.x > 0 ? 'East' : 'West';
  return Math.abs(v.x) > 0.6 ? word : `Light ${word.toLowerCase()}`;
}

/** Restrained field: pale blue to the west, warm ivory to the east, deeper with strength. */
export function fieldColor(v: DriftValue): RGB {
  const k = (v.x + 1) / 2;
  const s = (v.y + 1) / 2;
  const blue: RGB = [0.74 - 0.08 * s, 0.84 - 0.04 * s, 1.0];
  const ivory: RGB = [1.0, 0.94 - 0.05 * s, 0.84 - 0.1 * s];
  return [blue[0] + (ivory[0] - blue[0]) * k, blue[1] + (ivory[1] - blue[1]) * k, blue[2] + (ivory[2] - blue[2]) * k];
}

const INK: RGB = [0.8, 0.86, 1.0];

/**
 * A tiny pixel wind glyph for a value, on the 12×12 icon grid: three streaks
 * whose length follows strength, with a chevron on the downwind side. Near
 * zero direction it is a still, centred dash pattern. Quantised so it only
 * re-forms when it would visibly change.
 */
export function windGlyph(v: DriftValue): Pixel[] {
  const px: Pixel[] = [];
  const s = Math.round(((v.y + 1) / 2) * 4); // 0..4
  const dir = Math.abs(v.x) < 0.08 ? 0 : Math.sign(v.x);
  const len = 3 + s * 2; // 3..11
  const rows = s >= 3 ? [2, 5, 8] : s >= 1 ? [3, 6, 9] : [5];
  rows.forEach((y, k) => {
    const l = Math.max(2, len - (k === 1 ? 0 : 2));
    const x0 = dir === 0 ? Math.round((12 - l) / 2) : dir > 0 ? 0 : 12 - l;
    for (let i = 0; i < l; i++) {
      // gusty: the streak breaks once when strong
      if (s >= 3 && i === Math.floor(l * 0.4) && k !== 1) continue;
      px.push({ x: x0 + i, y, color: INK });
    }
  });
  if (dir !== 0) {
    const tip = dir > 0 ? 11 : 0;
    const back = dir > 0 ? -1 : 1;
    const cy = rows.length === 1 ? 5 : rows[1];
    for (let d = 1; d <= 2; d++) {
      for (const yy of [cy - d, cy + d]) if (yy >= 0 && yy < 12) px.push({ x: tip + back * d, y: yy, color: INK });
    }
  }
  // unique cells only
  const seen = new Set<string>();
  return px.filter((p) => {
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const glyphKey = (v: DriftValue): string => `${Math.abs(v.x) < 0.08 ? 0 : Math.sign(v.x)}|${Math.round(((v.y + 1) / 2) * 4)}`;
