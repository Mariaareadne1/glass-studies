import { describe, expect, test } from 'vitest';
import { ASSEMBLY_SEQUENCE, AssemblyLoader, assemblyPlan, assemblyStates, scatterFor } from '../components/loaders/assemblyLoader';
import { iconPixels } from '../pixels/iconDefinitions';

const key = (s: { x: number; y: number }) => `${Math.round(s.x)},${Math.round(s.y)}`;

describe('Pixel Assembly', () => {
  test('100% is the authored bitmap exactly, for every icon', () => {
    for (const name of ASSEMBLY_SEQUENCE) {
      const target = iconPixels(name);
      const end = assemblyStates(assemblyPlan(target), 1);
      expect(end).toHaveLength(target.length);
      end.forEach((s, i) => {
        expect(s.x).toBe(target[i].x);
        expect(s.y).toBe(target[i].y);
        expect(s.alpha).toBe(1);
        expect(s.size).toBe(1);
        expect(s.color).toEqual(target[i].color);
      });
    }
  });

  test('intermediate frames keep every particle, finite and inside a bounded cloud', () => {
    const plan = assemblyPlan(iconPixels('leaf'));
    for (const p of [0, 0.2, 0.5, 0.8]) {
      const st = assemblyStates(plan, p);
      expect(st).toHaveLength(plan.length);
      for (const s of st) {
        expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
        expect(Math.abs(s.x - 5.5)).toBeLessThan(13);
        expect(Math.abs(s.y - 5.5)).toBeLessThan(13);
      }
    }
  });

  test('assembly is deterministic and reversible: the same fraction gives the same picture', () => {
    const plan = assemblyPlan(iconPixels('moon'));
    const a = assemblyStates(plan, 0.43);
    assemblyStates(plan, 0.9);
    const b = assemblyStates(plan, 0.43);
    expect(b).toEqual(a);
    expect(scatterFor(iconPixels('moon'), 5)).toEqual(scatterFor(iconPixels('moon'), 5));
  });

  test('the loop lands on each authored icon and retargets mid-morph without dropping squares', () => {
    const l = new AssemblyLoader();
    for (let i = 0; i < Math.round((4 * 1.6 + 1.2) * 60); i++) l.step(1 / 60);
    // settled on an icon: the drawn set equals that icon's cells
    const settled = new Set(l.states().map(key));
    const want = new Set(iconPixels(l.currentIcon).map(key));
    expect(settled).toEqual(want);
    // interrupt: switch to determinate and back mid-flight, nothing explodes
    l.setMode('progress');
    l.setProgress(0.5);
    expect(l.states().every((s) => Number.isFinite(s.x))).toBe(true);
    l.setMode('loop');
    expect(l.states().length).toBe(iconPixels(l.currentIcon).length);
  });

  test('pause freezes the loop exactly; speed scales it', () => {
    const l = new AssemblyLoader();
    l.step(0.5);
    const t0 = l.time;
    l.setPlaying(false);
    expect(l.step(1)).toBe(false);
    expect(l.time).toBe(t0);
    l.setPlaying(true);
    l.setSpeed(1.5);
    l.step(1);
    expect(l.time).toBeCloseTo(t0 + 1.5, 6);
    l.restart();
    expect(l.time).toBeCloseTo(0.2, 6);
  });
});
