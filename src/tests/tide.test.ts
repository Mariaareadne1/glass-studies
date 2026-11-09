import { describe, expect, test } from 'vitest';
import { heightForVolume, TIDE_INTERIOR, TideLoader, TideSurface, volumeBelow } from '../components/loaders/tideLoader';
import { expectValidScene, sceneCtx } from './support/sceneCtx';

const settle = (l: TideLoader, seconds = 8) => {
  let moving = true;
  for (let t = 0; t < seconds && moving; t += 1 / 60) moving = l.step(1 / 60);
  return moving;
};

describe('Tide Fill', () => {
  test('volume maps to height through the rounded caps, monotonically', () => {
    expect(heightForVolume(0)).toBeCloseTo(0, 3);
    expect(heightForVolume(1)).toBeCloseTo(TIDE_INTERIOR.h, 3);
    expect(heightForVolume(0.5)).toBeCloseTo(TIDE_INTERIOR.h / 2, 1); // symmetric vessel
    // near the floor the vessel is narrower, so 1% of the volume rises more than 1% of the height
    expect(heightForVolume(0.01) / TIDE_INTERIOR.h).toBeGreaterThan(0.01);
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const h = heightForVolume(p);
      expect(h).toBeGreaterThan(prev);
      prev = h;
      expect(volumeBelow(h) / volumeBelow(TIDE_INTERIOR.h)).toBeCloseTo(p, 3);
    }
  });

  test('0, 1, 50, 99, 100% and backward jumps settle on the exact level (within 0.5 design units)', () => {
    const l = new TideLoader();
    l.setMode('progress');
    for (const p of [0, 0.01, 0.5, 0.99, 1, 0.2, 0.9, 0]) {
      l.setProgress(p);
      expect(settle(l)).toBe(false);
      expect(Math.abs(l.height - heightForVolume(p))).toBeLessThan(0.5);
      expect(l.complete).toBe(p >= 1);
    }
  });

  test('the surface keeps the mean (volume) and stays bounded under random jumps; then calms', () => {
    const s = new TideSurface();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400; i++) {
      if (i % 5 === 0) s.excite(rand() * 2 - 1);
      s.step(1 / 60);
      const mean = s.u.reduce((a, b) => a + b, 0) / s.u.length;
      expect(Math.abs(mean)).toBeLessThan(1e-9);
      for (const u of s.u) {
        expect(Number.isFinite(u)).toBe(true);
        expect(Math.abs(u)).toBeLessThanOrEqual(14 + 1e-9);
      }
    }
    for (let i = 0; i < 60 * 30; i++) s.step(1 / 60);
    expect(s.energy).toBeLessThan(0.01);
  });

  test('pause and speed never change the numerical progress; long idle stays stable', () => {
    const l = new TideLoader();
    l.setMode('progress');
    l.setProgress(0.62);
    l.setPlaying(false);
    l.step(5);
    l.setSpeed(1.5);
    l.setPlaying(true);
    expect(l.transport.progress).toBe(0.62);
    settle(l, 20);
    for (let i = 0; i < 60 * 60; i++) l.step(1 / 60); // a minute idle
    expect(Math.abs(l.height - heightForVolume(0.62))).toBeLessThan(0.5);
    for (const env of ['pearl', 'midnight'] as const) expectValidScene(l.scene(sceneCtx(env)));
  });
});
