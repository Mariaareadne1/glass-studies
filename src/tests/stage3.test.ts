import { describe, expect, test } from 'vitest';
import { causticField, lensHeight, refract3, tonemap, tracePhoton } from '../components/optics/causticField';
import type { CausticGrid } from '../components/optics/causticField';
import { CausticController, clampLight, lensFor } from '../components/optics/causticController';
import { fragments, STITCH, StitchController, stitchLoopStage } from '../components/optics/stitchController';
import { MAG, MagnetSim } from '../components/loaders/magnetSim';
import { MagneticLoader } from '../components/loaders/magneticLoader';
import { LOADER } from '../components/loaders/loopController';
import { expectValidScene, sceneCtx } from './support/sceneCtx';

const GRID: CausticGrid = { cols: 80, rows: 55, x0: 0, y0: 0, w: 640, h: 440 };

/** Centre of the brightest gathered light (ratio > 1.3). */
function brightCentroid(f: Float32Array): { x: number; y: number; peak: number } {
  let sx = 0;
  let sy = 0;
  let w = 0;
  let peak = 0;
  for (let k = 0; k < f.length; k++) {
    peak = Math.max(peak, f[k]);
    if (f[k] < 1.3) continue;
    const x = ((k % GRID.cols) + 0.5) * (GRID.w / GRID.cols);
    const y = (Math.floor(k / GRID.cols) + 0.5) * (GRID.h / GRID.rows);
    sx += x * (f[k] - 1);
    sy += y * (f[k] - 1);
    w += f[k] - 1;
  }
  return { x: sx / w, y: sy / w, peak };
}

describe('Caustic', () => {
  test('refraction obeys Snell: normal incidence passes straight, grazing totally reflects', () => {
    expect(refract3([0, 0, -1], [0, 0, 1], 1 / 1.52)).toEqual([0, 0, -1]);
    const inside = refract3([Math.sin(1.2), 0, -Math.cos(1.2)], [0, 0, 1], 1.52);
    expect(inside).toBeNull();
  });

  test('light outside the lens lands exactly where it was aimed (uniform field away from the glass)', () => {
    const g = lensFor('sphere');
    const p = tracePhoton(g, { x: 100, y: 100, z: 560 }, 560, 60);
    expect(p).not.toBeNull();
    // straight line from the light through (560, 60) at lens height down to the plane
    const s = 560 / (560 - 70);
    expect(p!.x).toBeCloseTo(100 + (560 - 100) * s, 6);
    const f = causticField(g, { x: 100, y: 100, z: 560 }, GRID);
    expect(f[2 * GRID.cols + GRID.cols - 3]).toBeCloseTo(1, 1);
  });

  test('the lens gathers light (peak > 1) and the caustic moves continuously, opposite the light', () => {
    const g = lensFor('sphere');
    let prev: number | null = null;
    for (const lx of [80, 140, 200, 260]) {
      const c = brightCentroid(causticField(g, { x: lx, y: 196, z: 560 }, GRID));
      expect(c.peak).toBeGreaterThan(1.5);
      // light moves right → the caustic (cast away from the light) moves left, by a bounded step
      if (prev !== null) {
        expect(c.x).toBeLessThan(prev);
        expect(prev - c.x).toBeLessThan(60);
      }
      prev = c.x;
    }
  });

  test('geometry matters: sphere and capsule cast different patterns; the profile matches the shader', () => {
    const l = { x: 120, y: 120, z: 560 };
    const a = brightCentroid(causticField(lensFor('sphere'), l, GRID));
    const b = brightCentroid(causticField(lensFor('capsule'), l, GRID));
    expect(Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.peak - b.peak)).toBeGreaterThan(1);
    const g = lensFor('sphere');
    expect(lensHeight(g, g.cx, g.cy)).toBeCloseTo(g.thickness, 6);
    expect(lensHeight(g, g.cx + g.hw + 1, g.cy)).toBe(0);
    expect(tonemap(1, 1)).toBe(0);
    expect(tonemap(4, 1)).toBeLessThan(1);
    expect(tonemap(4, 1)).toBeGreaterThan(tonemap(2, 1));
  });

  test('the fast field equals a brute-force trace of every photon (interior cells)', () => {
    const g = lensFor('capsule');
    const light = { x: 150, y: 120, z: 560 };
    const fast = causticField(g, light, GRID, 2);
    // reference: trace every lattice photon, splat bilinearly
    const { cols, rows, w, h } = GRID;
    const ref = new Float32Array(cols * rows);
    const shrink = (light.z - 70) / light.z;
    const ex0 = light.x + (0 - light.x) * shrink;
    const ey0 = light.y + (0 - light.y) * shrink;
    const nx = cols * 2;
    const ny = rows * 2;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const hit = tracePhoton(g, light, ex0 + ((i + 0.5) / nx) * w * shrink, ey0 + ((j + 0.5) / ny) * h * shrink);
        if (!hit) continue;
        const fx = (hit.x / w) * cols - 0.5;
        const fy = (hit.y / h) * rows - 0.5;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        for (let k = 0; k < 4; k++) {
          const cx = ix + (k & 1);
          const cy = iy + (k >> 1);
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
          ref[cy * cols + cx] += ((k & 1 ? fx - ix : 1 - (fx - ix)) * (k >> 1 ? fy - iy : 1 - (fy - iy))) / 4;
        }
      }
    let worst = 0;
    for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) worst = Math.max(worst, Math.abs(fast[y * cols + x] - ref[y * cols + x]));
    expect(worst).toBeLessThan(1e-4);
  });

  test('the light handle can never sit on the glass, and scenes are valid', () => {
    for (const shape of ['sphere', 'capsule'] as const) {
      const g = lensFor(shape);
      const p = clampLight(g.cx + 3, g.cy - 2, shape);
      expect(Math.hypot((p.x - g.cx) / (g.hw + 34), (p.y - g.cy) / (g.hh + 34))).toBeGreaterThanOrEqual(0.999);
    }
    const c = new CausticController();
    c.placeLight(10, 10);
    expect(c.lightMode).toBe('hand');
    expect(c.step(1 / 60)).toBe(false); // a held light is still: no frames needed
    for (const env of ['pearl', 'midnight'] as const) expectValidScene(c.scene(sceneCtx(env)));
  });
});

describe('Glass Stitch', () => {
  test('seated fragments tile the panel exactly: no cracks, no overlap', () => {
    const f = fragments(1);
    const q = STITCH.half / 2;
    const xs = f.map((p) => [p.cx - q, p.cx + q]);
    const ys = f.map((p) => [p.cy - q, p.cy + q]);
    expect(Math.min(...xs.map((x) => x[0]))).toBeCloseTo(LOADER.cx - STITCH.half, 9);
    expect(Math.max(...xs.map((x) => x[1]))).toBeCloseTo(LOADER.cx + STITCH.half, 9);
    expect(Math.min(...ys.map((y) => y[0]))).toBeCloseTo(LOADER.cy - STITCH.half, 9);
    // the seams: left pieces end exactly where right pieces begin
    expect(f[0].cx + q).toBeCloseTo(f[1].cx - q, 9);
    expect(f[0].cy + q).toBeCloseTo(f[2].cy - q, 9);
    // the outer corner of each piece is the panel's corner radius; seam corners are small
    f.forEach((p) => expect([...p.radii].sort((a, b) => a - b)).toEqual([STITCH.inner, STITCH.inner, STITCH.inner, STITCH.outer]));
  });

  test('joins happen in order and are reversible; the loop closes', () => {
    const gapX = (s: number, i: number, j: number) => Math.abs(fragments(s)[j].cx - fragments(s)[i].cx);
    // halfway through the first half, the top pair has closed more than the bottom pair
    expect(gapX(0.3, 0, 1)).toBeLessThan(gapX(0.3, 2, 3));
    expect(fragments(0.42)).toEqual(fragments(0.42));
    expect(stitchLoopStage(0)).toBe(0);
    expect(stitchLoopStage(1 - 1e-12)).toBeCloseTo(0, 6);
    const s = new StitchController();
    s.setMode('progress');
    for (const p of [0, 0.5, 0.99, 1]) {
      s.setProgress(p);
      const scene = s.scene(sceneCtx());
      expectValidScene(scene);
      expect(scene.layers[0].union).toBeGreaterThan(0);
      // the bonding core only exists once the last seam is closing
      expect(scene.layers[0].shapes.length).toBe(p >= 0.8 ? 5 : 4);
    }
  });
});

describe('Magnetic Beads', () => {
  test('thousands of steps under strong attraction and huge frame times stay finite, contained and apart', () => {
    const sim = new MagnetSim(9);
    sim.strength = 2;
    sim.magnets = [{ x: MAG.cx, y: MAG.cy, polarity: 1 }];
    for (let i = 0; i < 4000; i++) {
      sim.step(i % 50 === 0 ? 5 : 1 / 60); // occasional absurd dt
      for (const b of sim.beads) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx)).toBe(true);
        expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(MAG.maxSpeed + 1e-6);
      }
      expect(sim.contained).toBe(true);
      expect(sim.maxOverlap).toBeLessThan(1.5);
    }
  });

  test('a magnet exactly on a bead is not a singularity', () => {
    const sim = new MagnetSim(1);
    const b = sim.beads[0];
    sim.magnets = [{ x: b.x, y: b.y, polarity: 1 }];
    sim.step(1 / 60);
    expect(Number.isFinite(sim.beads[0].x)).toBe(true);
  });

  test('pause does not explode on resume; complete settles into the check and stops', () => {
    const l = new MagneticLoader();
    for (let i = 0; i < 120; i++) l.step(1 / 60);
    l.setPlaying(false);
    const before = l.sim.beads.map((b) => ({ ...b }));
    l.step(30);
    expect(l.sim.beads).toEqual(before);
    l.setPlaying(true);
    l.step(0.05);
    expect(Math.max(...l.sim.beads.map((b) => Math.hypot(b.vx, b.vy)))).toBeLessThanOrEqual(MAG.maxSpeed);
    l.setComplete(true);
    let moving = true;
    for (let i = 0; i < 60 * 10 && moving; i++) moving = l.step(1 / 60);
    expect(moving).toBe(false);
    expect(l.sim.kinetic).toBeLessThan(0.5);
    for (const env of ['pearl', 'midnight'] as const) expectValidScene(l.scene(sceneCtx(env)));
  });

  test('the same seed reproduces the same run', () => {
    const run = () => {
      const s = new MagnetSim(5);
      s.magnets = [{ x: MAG.cx - 100, y: MAG.cy, polarity: 1 }];
      for (let i = 0; i < 300; i++) s.step(1 / 60);
      return s.beads;
    };
    expect(run()).toEqual(run());
  });
});
