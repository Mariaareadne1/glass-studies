import { expect } from 'vitest';
import type { SceneContext } from '../../glass/GlassStage';
import type { GlassScene } from '../../glass/types';
import { MAX_LAYERS, MAX_SHAPES_PER_LAYER } from '../../glass/types';

/** A 2D context that accepts every call (scene() paints content in tests). */
export const stub2d = new Proxy({} as Record<string, unknown>, {
  get: (_t, k) =>
    k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient'
      ? () => ({ addColorStop() {} })
      : k === 'measureText'
        ? (t: string) => ({ width: t.length * 6 })
        : k === 'getImageData'
          ? () => ({ data: new Uint8ClampedArray(4) })
          : () => undefined,
  set: () => true,
}) as unknown as CanvasRenderingContext2D;

export const sceneCtx = (env: SceneContext['env'] = 'pearl'): SceneContext => ({
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

/** Every scene must fit the renderer's pass limits with valid, finite geometry. */
export function expectValidScene(s: GlassScene): void {
  expect(s.layers.length).toBeLessThanOrEqual(MAX_LAYERS);
  for (const layer of s.layers) {
    expect(layer.shapes.length).toBeLessThanOrEqual(MAX_SHAPES_PER_LAYER);
    for (const sh of layer.shapes) {
      for (const v of [sh.cx, sh.cy, sh.hw, sh.hh, sh.radius]) expect(Number.isFinite(v)).toBe(true);
      expect(sh.hw).toBeGreaterThan(0);
      expect(sh.hh).toBeGreaterThan(0);
      expect(sh.radius).toBeLessThanOrEqual(Math.min(sh.hw, sh.hh) + 1e-6);
    }
  }
}
