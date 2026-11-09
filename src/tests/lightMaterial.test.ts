import { describe, expect, test } from 'vitest';
import { CARD, THUMB, TRACK } from '../glass/materialPresets';
import { pearlMaterial, sceneForEnv } from '../glass/lightMaterial';
import type { GlassScene } from '../glass/types';

const luminance = (rgb: readonly number[]) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

const scene = (): GlassScene => ({
  env: { kind: 'pearl', glowColor: [1, 1, 1], glowPos: [0, 0], glowRadius: 1, glowStrength: 0, brightness: 1, time: 0 },
  layers: [{ shapes: [{ cx: 0, cy: 0, hw: 10, hh: 10, radius: 4, skew: 0, material: CARD }] }],
});

describe('light-mode pearl material', () => {
  test('reduces body density and shadow for every preset', () => {
    for (const m of [TRACK, THUMB, CARD]) {
      const p = pearlMaterial(m);
      expect(p.tint[3]).toBeLessThan(m.tint[3]);
      expect(p.shadow).toBeLessThan(m.shadow);
      expect(p.frost).toBeLessThan(m.frost);
    }
  });

  test('shifts the body colour toward a brighter pearl, keeps it near neutral', () => {
    const p = pearlMaterial(CARD);
    expect(luminance(p.tint)).toBeGreaterThan(luminance(CARD.tint));
    const [r, g, b] = p.tint;
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(Math.max(...CARD.tint.slice(0, 3)) - Math.min(...CARD.tint.slice(0, 3)));
  });

  test('keeps saturated state colours (e.g. an "on" switch) mostly intact', () => {
    const on = { ...TRACK, tint: [0.36, 0.52, 1.0, 0.6] as [number, number, number, number] };
    const p = pearlMaterial(on);
    expect(p.tint[3]).toBeGreaterThan(on.tint[3] * 0.85);
    expect(p.tint[2] - p.tint[0]).toBeGreaterThan((on.tint[2] - on.tint[0]) * 0.9);
  });

  test('offsets the lighter fill with slightly stronger specular', () => {
    expect(pearlMaterial(THUMB).specular).toBeGreaterThan(THUMB.specular);
  });

  test('never mutates its input', () => {
    const before = JSON.stringify(CARD);
    pearlMaterial(CARD);
    expect(JSON.stringify(CARD)).toBe(before);
  });

  test('applies to light environments only and leaves Midnight untouched', () => {
    const s = scene();
    expect(sceneForEnv(s, 'pearl').layers[0].shapes[0].material.tint[3]).toBeLessThan(CARD.tint[3]);
    expect(sceneForEnv(s, 'atmosphere').layers[0].shapes[0].material.tint[3]).toBeLessThan(CARD.tint[3]);
    expect(sceneForEnv(s, 'midnight')).toBe(s);
    expect(s.layers[0].shapes[0].material).toBe(CARD);
  });
});
