import { RANGE_GAP, RANGE_MAX, RANGE_MIN, RANGE_STEP } from '../../../state/controls';
import type { RangeValue } from '../../../state/controls';

export type BeadId = 'start' | 'end';

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
  const d = r.end - r.start;
  return Number.isInteger(d) ? `${d} h` : `${Math.floor(d)} h 30`;
}
