import { describe, expect, test } from 'vitest';
import { GRID, haloSun, ICONS, iconPixels } from '../pixels/iconDefinitions';
import type { IconName } from '../pixels/iconDefinitions';
import { evalParticle, matchPixels, planMorph, toStates } from '../pixels/morphAlgorithm';
import { PixelMorpher } from '../pixels/PixelMorph';

describe('icon artwork', () => {
  test.each(Object.keys(ICONS) as IconName[])('%s is a valid 12×12 grid', (name) => {
    const def = ICONS[name];
    expect(def.grid).toHaveLength(GRID);
    def.grid.forEach((row) => expect(row).toHaveLength(GRID));
    expect(iconPixels(name).length).toBeGreaterThan(8);
  });

  test('halo sun gains rays with brightness', () => {
    expect(haloSun(1).length).toBeGreaterThan(haloSun(0.5).length);
    expect(haloSun(0.5).length).toBeGreaterThan(haloSun(0).length);
  });
});

describe('morph planning', () => {
  test('matching pairs each destination at most once and is deterministic', () => {
    const a = iconPixels('moon');
    const b = iconPixels('sun');
    const m1 = matchPixels(a, b, 4);
    const m2 = matchPixels(a, b, 4);
    expect(m1).toEqual(m2);
    expect(new Set(m1.map((p) => p[1])).size).toBe(m1.length);
    expect(m1.length).toBe(Math.min(a.length, b.length));
  });

  test('plan starts exactly at the source and ends exactly at the destination', () => {
    const from = toStates(iconPixels('moon'));
    const to = iconPixels('sun');
    const plan = planMorph(from, to, { seed: 3 });
    const start = plan.map((p) => evalParticle(p, 0)).filter((s) => s.alpha > 0.5);
    const end = plan.map((p) => evalParticle(p, 1)).filter((s) => s.alpha > 0.5);
    const key = (s: { x: number; y: number }) => `${Math.round(s.x)},${Math.round(s.y)}`;
    expect(new Set(start.map(key))).toEqual(new Set(from.map(key)));
    expect(new Set(end.map(key))).toEqual(new Set(to.map(key)));
  });

  test('mid-flight squares are displaced from both endpoints (a real transition, not a crossfade)', () => {
    const plan = planMorph(toStates(iconPixels('rain')), iconPixels('snow'), { seed: 2 });
    const moved = plan.filter((p) => {
      const mid = evalParticle(p, 0.55);
      return Math.hypot(mid.x - p.from.x, mid.y - p.from.y) > 0.3 && Math.hypot(mid.x - p.to.x, mid.y - p.to.y) > 0.3;
    });
    expect(moved.length).toBeGreaterThan(plan.length * 0.3);
  });

  test('interrupted morph continues from the rendered positions', () => {
    const m = new PixelMorpher(iconPixels('sun'));
    m.morphTo(iconPixels('rain'), { duration: 1 });
    m.step(0.4);
    const before = m.states();
    m.morphTo(iconPixels('wind'), { duration: 1 });
    const after = m.states();
    const key = (s: { x: number; y: number }) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`;
    const beforeKeys = new Set(before.map(key));
    expect(after.every((s) => beforeKeys.has(key(s)))).toBe(true);
  });
});
