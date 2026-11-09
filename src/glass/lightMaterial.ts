import type { EnvironmentKind, GlassScene, MaterialParams, RGB } from './types';

/**
 * V2.1 light-mode material: on pale studios the glass should read as clear,
 * pearlescent and background-reactive rather than smoked. Every study keeps its
 * own state colours; this pass only thins the body, shifts it toward pearl and
 * hands edge definition to optics and highlights instead of dark fill.
 * Midnight keeps its smoked variant untouched.
 */
const PEARL_BODY: RGB = [0.965, 0.96, 0.99];

export const LIGHT_MODE = {
  density: 0.6, // scale applied to body absorption (tint alpha) for neutral bodies
  pearlShift: 0.32, // how far the body colour moves toward pearl
  shadow: 0.6,
  frost: 0.8,
  specular: 1.12,
  milk: 1.06,
} as const;

const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

/** 0 for near-neutral bodies, 1 for strongly coloured ones (state colours such as an "on" switch). */
function saturation(rgb: readonly number[]): number {
  const chroma = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
  return Math.min(1, Math.max(0, (chroma - 0.25) / 0.25));
}

export function pearlMaterial(m: MaterialParams): MaterialParams {
  // neutral bodies thin out and move toward pearl; saturated state colours are spared
  const sat = saturation(m.tint);
  const k = LIGHT_MODE.pearlShift * (1 - sat);
  const density = mix(LIGHT_MODE.density, 0.95, sat);
  return {
    ...m,
    tint: [mix(m.tint[0], PEARL_BODY[0], k), mix(m.tint[1], PEARL_BODY[1], k), mix(m.tint[2], PEARL_BODY[2], k), m.tint[3] * density],
    shadow: m.shadow * LIGHT_MODE.shadow,
    frost: m.frost * LIGHT_MODE.frost,
    specular: m.specular * LIGHT_MODE.specular,
    milk: Math.min(1.1, m.milk * LIGHT_MODE.milk),
  };
}

/** Returns the scene to render for an environment: light studios get the pearl material. */
export function sceneForEnv(scene: GlassScene, env: EnvironmentKind): GlassScene {
  if (env === 'midnight') return scene;
  return {
    ...scene,
    layers: scene.layers.map((layer) => ({
      ...layer,
      shapes: layer.shapes.map((s) => ({ ...s, material: pearlMaterial(s.material) })),
    })),
  };
}
