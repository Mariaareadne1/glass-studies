import { sdRoundRect } from '../../glass/geometry';

/**
 * Caustic photon map, CPU. Light from a point source passes a glass lens
 * floating above the studio plane; every photon that crosses the lens is
 * refracted by the lens surface and lands somewhere else, so the plane gets
 * darker where light was taken away and brighter where it is gathered.
 *
 * The lens surface uses the SAME profile as the WebGL glass shader (a convex
 * squircle bevel: h(t) = (1 − (1 − t)^4)^(1/4) over the bevel width) and the
 * same index of refraction (1.52), so the pattern is tied to the glass you see.
 * Approximation (stated in the study): refraction at the curved top surface
 * and the flat bottom, thin-lens travel inside the glass, no reflections.
 */
export interface LensGeometry {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  radius: number;
  bevel: number;
  thickness: number;
}

export interface LightSource {
  x: number;
  y: number;
  /** Height above the plane, design units. */
  z: number;
}

export const IOR = 1.52;
/** Height of the lens underside above the plane. */
export const LENS_HEIGHT = 70;

export interface CausticGrid {
  /** Resolution of the irradiance map. */
  cols: number;
  rows: number;
  /** Stage area the map covers. */
  x0: number;
  y0: number;
  w: number;
  h: number;
}

type V3 = [number, number, number];

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** GLSL-style refract: i and n unit, n facing against i. Null on total internal reflection. */
export function refract3(i: V3, n: V3, eta: number): V3 | null {
  const d = n[0] * i[0] + n[1] * i[1] + n[2] * i[2];
  const k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return null;
  const s = eta * d + Math.sqrt(k);
  return [eta * i[0] - s * n[0], eta * i[1] - s * n[1], eta * i[2] - s * n[2]];
}

/** Surface height of the lens top above its underside at (x, y); 0 outside. Mirrors the shader profile. */
export function lensHeight(g: LensGeometry, x: number, y: number): number {
  const sd = sdRoundRect(x - g.cx, y - g.cy, g);
  if (sd >= 0) return 0;
  const t = Math.min(1, -sd / g.bevel);
  const om = 1 - t;
  return g.thickness * Math.pow(Math.max(0, 1 - om * om * om * om), 0.25);
}

/** Upward surface normal from the height field by central differences. */
export function lensNormal(g: LensGeometry, x: number, y: number): V3 {
  const e = 0.6;
  const dx = (lensHeight(g, x + e, y) - lensHeight(g, x - e, y)) / (2 * e);
  const dy = (lensHeight(g, x, y + e) - lensHeight(g, x, y - e)) / (2 * e);
  return norm([-dx, -dy, 1]);
}

/**
 * Trace one photon aimed at (x, y) on the lens plane: returns where it lands
 * on the studio plane (z = 0), or null if it is totally internally reflected.
 */
export function tracePhoton(g: LensGeometry, light: LightSource, x: number, y: number): { x: number; y: number } | null {
  const zTop = LENS_HEIGHT + lensHeight(g, x, y);
  const dir = norm([x - light.x, y - light.y, zTop - light.z]);
  let d: V3 = dir;
  if (zTop > LENS_HEIGHT + 1e-6 || sdRoundRect(x - g.cx, y - g.cy, g) < 0) {
    // enter through the curved top (normal faces up, against the downward ray)
    const n = lensNormal(g, x, y);
    const inside = refract3(dir, n, 1 / IOR);
    if (!inside) return null;
    // leave through the flat underside
    const out = refract3(norm(inside), [0, 0, 1], IOR);
    if (!out) return null;
    d = norm(out);
  }
  if (d[2] >= -1e-6) return null;
  const s = LENS_HEIGHT / -d[2];
  return { x: x + d[0] * s, y: y + d[1] * s };
}

/**
 * Irradiance relative to an unobstructed plane (1 = unchanged, <1 shadow,
 * >1 gathered light) on `grid`. Photons are emitted on a regular lattice in
 * the lens plane and splatted bilinearly; the lattice covers the projection of
 * the map area, so un-refracted light lands uniformly.
 */
export function causticField(g: LensGeometry, light: LightSource, grid: CausticGrid, density = 3): Float32Array {
  const { cols, rows, x0, y0, w, h } = grid;
  const acc = new Float32Array(cols * rows);
  // emit in the lens plane over the area that projects onto the map
  const shrink = (light.z - LENS_HEIGHT) / light.z; // plane → lens-plane scale about the light
  const ex0 = light.x + (x0 - light.x) * shrink;
  const ey0 = light.y + (y0 - light.y) * shrink;
  const ew = w * shrink;
  const eh = h * shrink;
  const nx = cols * density;
  const ny = rows * density;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const px = ex0 + ((i + 0.5) / nx) * ew;
      const py = ey0 + ((j + 0.5) / ny) * eh;
      const hit = tracePhoton(g, light, px, py);
      if (!hit) continue;
      const fx = ((hit.x - x0) / w) * cols - 0.5;
      const fy = ((hit.y - y0) / h) * rows - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      for (let k = 0; k < 4; k++) {
        const cx = ix + (k & 1);
        const cy = iy + (k >> 1);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        acc[cy * cols + cx] += (k & 1 ? tx : 1 - tx) * (k >> 1 ? ty : 1 - ty);
      }
    }
  }
  const uniform = density * density;
  for (let k = 0; k < acc.length; k++) acc[k] /= uniform;
  return acc;
}

/** Soft highlight compression: caps gathered light so the caustic never blows out. */
export const tonemap = (ratio: number, gain: number): number => 1 - Math.exp(-Math.max(0, ratio - 1) * gain);
