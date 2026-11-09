import { RANGE_GAP, RANGE_MAX, RANGE_MIN, RANGE_STEP } from '../../../state/controls';
import type { RangeValue } from '../../../state/controls';

export type BeadId = 'start' | 'end';
/** What a drag is moving: one bead, or the whole window between them. */
export type DragTarget = BeadId | 'window';

export const snapHour = (h: number): number => Math.round(h / RANGE_STEP) * RANGE_STEP;

/**
 * Move one bead, keeping the window valid: beads never cross and always keep
 * at least RANGE_GAP between them; values stay within the day.
 */
export function moveBead(range: RangeValue, which: BeadId, hour: number): RangeValue {
  if (which === 'start') {
    const start = Math.min(Math.max(hour, RANGE_MIN), range.end - RANGE_GAP);
    return { start, end: range.end };
  }
  const end = Math.max(Math.min(hour, RANGE_MAX), range.start + RANGE_GAP);
  return { start: range.start, end };
}

/**
 * Move the whole window by `delta` hours, preserving its duration exactly and
 * clamping at the ends of the day (crossing policy: beads clamp, never swap).
 */
export function moveWindow(range: RangeValue, delta: number): RangeValue {
  const span = range.end - range.start;
  const start = Math.min(Math.max(range.start + delta, RANGE_MIN), RANGE_MAX - span);
  return { start, end: start + span };
}

/** Which bead a press at `hour` should pick up: the nearer one; ties go toward the side pressed. */
export function nearestBead(range: RangeValue, hour: number): BeadId {
  const ds = Math.abs(hour - range.start);
  const de = Math.abs(hour - range.end);
  if (ds === de) return hour < range.start ? 'start' : 'end';
  return ds < de ? 'start' : 'end';
}

export function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatSpan(r: RangeValue): string {
  const mins = Math.round((r.end - r.start) * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
