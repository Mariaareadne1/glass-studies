import { describe, expect, test } from 'vitest';
import { reduced, Spring, SPRINGS } from '../motion/spring';
import { Deformer } from '../motion/deformation';
import { EdgeLight } from '../motion/edgeLight';

const run = (s: Spring, seconds: number, dt = 1 / 60) => {
  const xs: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    s.step(dt);
    xs.push(s.x);
  }
  return xs;
};

describe('spring', () => {
  test('settles at the target with one restrained overshoot', () => {
    const s = new Spring(0, SPRINGS.travel);
    s.set(1);
    const xs = run(s, 2);
    const peak = Math.max(...xs);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.06);
    expect(s.isSettled(1e-3)).toBe(true);
    // after the first peak and its rebound, no visible wobble remains
    const iPeak = xs.indexOf(peak);
    const rebound = xs.slice(iPeak).findIndex((x) => x < 1) + iPeak;
    const later = xs.slice(rebound + 20);
    expect(Math.max(...later.map((x) => Math.abs(x - 1)))).toBeLessThan(0.006);
  });

  test('retargeting keeps velocity continuous', () => {
    const s = new Spring(0, SPRINGS.travel);
    s.set(1);
    run(s, 0.1);
    const v = s.v;
    s.set(0);
    expect(s.v).toBe(v);
    s.step(1 / 240);
    expect(Math.abs(s.v - v)).toBeLessThan(Math.abs(v) * 0.2 + 0.5);
  });

  test('is stable with large and irregular frame deltas', () => {
    const s = new Spring(0, SPRINGS.deform);
    s.set(100);
    for (const dt of [0.5, 0.001, 0.2, 0.07, 1]) s.step(dt);
    expect(Number.isFinite(s.x)).toBe(true);
    run(s, 3);
    expect(s.x).toBeCloseTo(100, 1);
  });

  test('reduced-motion config never overshoots', () => {
    const s = new Spring(0, reduced(SPRINGS.travel));
    s.set(1);
    expect(Math.max(...run(s, 2))).toBeLessThanOrEqual(1.0001);
  });
});

describe('deformation', () => {
  test('stretches while moving and compresses once after an abrupt stop', () => {
    const d = new Deformer(0.001, 0.2);
    let along = 1;
    for (let i = 0; i < 20; i++) along = d.update(800, 1 / 60).along;
    expect(along).toBeGreaterThan(1.05);
    let min = 2;
    for (let i = 0; i < 60; i++) min = Math.min(min, d.update(0, 1 / 60).along);
    expect(min).toBeLessThan(1);
    for (let i = 0; i < 120; i++) along = d.update(0, 1 / 60).along;
    expect(along).toBeCloseTo(1, 2);
    expect(d.active).toBe(false);
  });
});

describe('edge light', () => {
  test('head advances with motion and wraps; light fades after settling', () => {
    const e = new EdgeLight(0.95, 2);
    e.update(600, 400, 0.1);
    expect(e.head).toBeGreaterThanOrEqual(0);
    expect(e.head).toBeLessThan(1);
    expect(e.level).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) e.update(0, 400, 1 / 60);
    expect(e.active).toBe(false);
  });
});
