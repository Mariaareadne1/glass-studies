import { describe, expect, test } from 'vitest';
import type { SceneContext } from '../glass/GlassStage';
import { MAX_LAYERS, MAX_SHAPES_PER_LAYER } from '../glass/types';
import { phase } from '../components/loaders/loopController';
import { MORPH_BEAT, MORPH_SEQUENCE, MorphLoader } from '../components/loaders/morphLoader';
import { TIDE_PERIOD, TideLoader, tideLevel } from '../components/loaders/tideLoader';
import { ORBIT_PERIOD, OrbitLoader, orbitAngle } from '../components/loaders/orbitLoader';
import { CRYSTAL_PERIOD, CrystalLoader, crystalAmount } from '../components/loaders/crystalLoader';

const stub2d = new Proxy({} as Record<string, unknown>, {
  get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient' ? () => ({ addColorStop() {} }) : () => undefined),
  set: () => true,
}) as unknown as CanvasRenderingContext2D;

const ctx = (env: SceneContext['env'] = 'pearl'): SceneContext => ({
  width: 640,
  height: 440,
  pxPerUnit: 2,
  cssScale: 1,
  env,
  dark: env === 'midnight',
  time: 0,
  attention: 0,
  paint: (_n, draw) => {
    draw(stub2d);
    return { canvas: {} as HTMLCanvasElement, version: 1 };
  },
});

const wrapDiff = (a: number, b: number) => {
  const d = (a - b) % (Math.PI * 2);
  return Math.min(Math.abs(d), Math.PI * 2 - Math.abs(d));
};

describe('Glass Loaders loop seamlessly', () => {
  test('phase wraps into [0, 1) for any time', () => {
    expect(phase(0, 2)).toBe(0);
    expect(phase(3, 2)).toBeCloseTo(0.5);
    expect(phase(-0.5, 2)).toBeCloseTo(0.75);
  });

  test('the tide has no seam and stays inside the vessel', () => {
    for (const t of [0, 0.7, 1.9, 3.1]) expect(tideLevel(t + TIDE_PERIOD)).toBeCloseTo(tideLevel(t), 9);
    // continuous across the loop point
    expect(Math.abs(tideLevel(TIDE_PERIOD - 1e-4) - tideLevel(0))).toBeLessThan(1e-4);
    for (let t = 0; t < TIDE_PERIOD; t += 0.05) {
      expect(tideLevel(t)).toBeGreaterThan(0.1);
      expect(tideLevel(t)).toBeLessThan(0.9);
    }
  });

  test('the orbit closes exactly and never runs backwards', () => {
    expect(wrapDiff(orbitAngle(ORBIT_PERIOD - 1e-5), orbitAngle(0))).toBeLessThan(1e-3);
    let prev = orbitAngle(0);
    for (let t = 0.01; t < ORBIT_PERIOD; t += 0.01) {
      const a = orbitAngle(t);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });

  test('the crystal grows, holds, melts and is clear at the loop point', () => {
    expect(crystalAmount(0)).toBe(0);
    expect(crystalAmount(0.5)).toBe(1);
    expect(crystalAmount(0.95)).toBe(0);
    const c = new CrystalLoader();
    expect(c.states(0.5).length).toBeGreaterThan(20);
    expect(c.states(0.95)).toHaveLength(0);
  });

  test('the morph loader steps through its sequence once per beat and wraps', () => {
    const m = new MorphLoader();
    const seen: string[] = [m.currentIcon];
    for (let i = 0; i < MORPH_SEQUENCE.length; i++) {
      for (let t = 0; t < MORPH_BEAT; t += 1 / 60) m.step(1 / 60);
      seen.push(m.currentIcon);
    }
    expect(seen.slice(0, MORPH_SEQUENCE.length)).toEqual(MORPH_SEQUENCE);
    expect(seen[MORPH_SEQUENCE.length]).toBe(MORPH_SEQUENCE[0]);
  });

  test('every loader keeps asking for frames and renders within pass limits, light, dark and reduced', () => {
    for (const make of [() => new MorphLoader(), () => new TideLoader(), () => new OrbitLoader(), () => new CrystalLoader()]) {
      for (const reduced of [false, true]) {
        const l = make();
        l.setReducedMotion(reduced);
        for (let t = 0; t < CRYSTAL_PERIOD; t += 0.1) expect(l.step(0.1)).toBe(true);
        for (const env of ['pearl', 'midnight'] as const) {
          const s = l.scene(ctx(env));
          expect(s.layers.length).toBeLessThanOrEqual(MAX_LAYERS);
          for (const layer of s.layers) {
            expect(layer.shapes.length).toBeLessThanOrEqual(MAX_SHAPES_PER_LAYER);
            for (const sh of layer.shapes) expect(sh.radius).toBeLessThanOrEqual(Math.min(sh.hw, sh.hh) + 1e-6);
          }
        }
      }
    }
  });
});
