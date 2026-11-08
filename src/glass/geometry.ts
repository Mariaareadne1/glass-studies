/**
 * Rounded-rectangle geometry shared by the CPU fallback, the edge-light
 * system and the unit tests. The GLSL in shaders.ts mirrors these functions
 * exactly, so the perimeter coordinate is identical on CPU and GPU.
 *
 * Convention: y axis points UP, the perimeter starts at the bottom of the
 * right edge and runs counter-clockwise. Circles are rounded rects whose
 * radius equals both half extents.
 */

const HALF_PI = Math.PI / 2;

export interface RRect {
  hw: number;
  hh: number;
  radius: number;
}

export function clampRadius(r: RRect): number {
  return Math.max(0, Math.min(r.radius, r.hw, r.hh));
}

/** Signed distance to a rounded rect centred at the origin (negative inside). */
export function sdRoundRect(x: number, y: number, rect: RRect): number {
  const r = clampRadius(rect);
  const qx = Math.abs(x) - (rect.hw - r);
  const qy = Math.abs(y) - (rect.hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

export function perimeterLength(rect: RRect): number {
  const r = clampRadius(rect);
  const ax = rect.hw - r;
  const ay = rect.hh - r;
  return 4 * (ax + ay) + 2 * Math.PI * r;
}

/**
 * Normalised perimeter coordinate (0..1) of the boundary point nearest to (x, y).
 */
export function perimeterParam(x: number, y: number, rect: RRect): number {
  const r = clampRadius(rect);
  const ax = rect.hw - r;
  const ay = rect.hh - r;
  const total = 4 * (ax + ay) + 2 * Math.PI * r;
  if (total <= 0) return 0;

  let qx = x;
  let qy = y;
  // Inside the inner rectangle: project onto the nearest straight edge line.
  if (Math.abs(qx) <= ax && Math.abs(qy) <= ay) {
    if (ax - Math.abs(qx) < ay - Math.abs(qy)) qx = (qx >= 0 ? 1 : -1) * (ax + 1e-6);
    else qy = (qy >= 0 ? 1 : -1) * (ay + 1e-6);
  }

  const qc = 2 * ay + r * HALF_PI; // start of top edge
  let s: number;
  if (qx > ax && Math.abs(qy) <= ay) {
    s = qy + ay; // right edge, upward
  } else if (Math.abs(qx) <= ax && qy > ay) {
    s = qc + (ax - qx); // top edge, leftward
  } else if (qx < -ax && Math.abs(qy) <= ay) {
    s = qc + 2 * ax + r * HALF_PI + (ay - qy); // left edge, downward
  } else if (Math.abs(qx) <= ax && qy < -ay) {
    s = 4 * ay + 3 * r * HALF_PI + 2 * ax + (qx + ax);
  } else {
    // Corner: angle about the corner centre, mapped into its quarter.
    const cx = qx > 0 ? ax : -ax;
    const cy = qy > 0 ? ay : -ay;
    let a = Math.atan2(qy - cy, qx - cx);
    if (a < 0) a += 2 * Math.PI;
    const quadrant = qx > 0 ? (qy > 0 ? 0 : 3) : qy > 0 ? 1 : 2;
    const lo = quadrant * HALF_PI;
    a = Math.min(Math.max(a, lo), lo + HALF_PI);
    const starts = [
      2 * ay,
      2 * ay + r * HALF_PI + 2 * ax,
      4 * ay + r * Math.PI + 2 * ax,
      4 * ay + 3 * r * HALF_PI + 4 * ax,
    ];
    s = starts[quadrant] + r * (a - lo);
  }
  const u = s / total;
  return u - Math.floor(u);
}

/** Point on the boundary at normalised perimeter coordinate u. */
export function perimeterPoint(u: number, rect: RRect): { x: number; y: number; nx: number; ny: number } {
  const r = clampRadius(rect);
  const ax = rect.hw - r;
  const ay = rect.hh - r;
  const total = 4 * (ax + ay) + 2 * Math.PI * r;
  let s = (u - Math.floor(u)) * total;
  const arc = r * HALF_PI;
  const corner = (cx: number, cy: number, a0: number, len: number) => {
    const a = a0 + (r > 0 ? len / r : 0);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  };
  if (s <= 2 * ay) return { x: ax + r, y: -ay + s, nx: 1, ny: 0 };
  s -= 2 * ay;
  if (s <= arc) return corner(ax, ay, 0, s);
  s -= arc;
  if (s <= 2 * ax) return { x: ax - s, y: ay + r, nx: 0, ny: 1 };
  s -= 2 * ax;
  if (s <= arc) return corner(-ax, ay, HALF_PI, s);
  s -= arc;
  if (s <= 2 * ay) return { x: -ax - r, y: ay - s, nx: -1, ny: 0 };
  s -= 2 * ay;
  if (s <= arc) return corner(-ax, -ay, Math.PI, s);
  s -= arc;
  if (s <= 2 * ax) return { x: -ax + s, y: -ay - r, nx: 0, ny: -1 };
  s -= 2 * ax;
  return corner(ax, -ay, 3 * HALF_PI, Math.min(s, arc));
}

/** Signed wrap-aware difference a - b on the unit circle, in (-0.5, 0.5]. */
export function wrapDelta(a: number, b: number): number {
  const d = a - b;
  return d - Math.round(d);
}
