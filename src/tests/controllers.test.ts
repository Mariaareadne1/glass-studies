import { describe, expect, test } from 'vitest';
import type { SceneContext } from '../glass/GlassStage';
import type { GlassScene } from '../glass/types';
import { positionToX, SOLAR, SolarController } from '../components/controls/SolarToggle/solarController';
import { ATMO_SLOTS, AtmosphereController } from '../components/controls/AtmosphereSelector/atmosphereController';
import { HALO, HaloController, valueToAngle } from '../components/controls/HaloDial/haloController';
import { tempToY, ThermalController } from '../components/controls/ThermalSlider/thermalController';
import { MODE_SLOTS, ModeController } from '../components/controls/ModeSelector/modeController';
import { FC, FC_SLOTS, ForecastController } from '../components/controls/ForecastCard/forecastController';

/** A 2D context stand-in that accepts every call (jsdom has no canvas). */
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

function settle(c: { step(dt: number): boolean }, seconds = 3): number {
  let frames = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    frames++;
    if (!c.step(1 / 60)) return frames;
  }
  return frames;
}

const lastShape = (s: GlassScene, layer: number, i = 0) => s.layers[layer].shapes[i];

describe('Solar controller', () => {
  test('thumb geometry agrees with state and the loop goes idle', () => {
    const c = new SolarController(false);
    c.setOn(true);
    expect(settle(c)).toBeLessThan(180);
    const s = c.scene(ctx());
    expect(lastShape(s, 1).cx).toBeCloseTo(positionToX(1), 1);
    expect(lastShape(s, 1).hw).toBeCloseTo(SOLAR.thumb, 1);
    expect(c.step(1 / 60)).toBe(false);
  });

  test('drag follows the pointer, rubber-bands past the end and snaps on release', () => {
    const c = new SolarController(false);
    c.beginDrag(positionToX(0));
    c.drag(positionToX(0) + 100, 400);
    c.step(1 / 60);
    expect(lastShape(c.scene(ctx()), 1).cx).toBeCloseTo(positionToX(0) + 100, 0);
    c.drag(positionToX(1) + 200, 0);
    expect(c.pos.x).toBeGreaterThan(1);
    expect(c.pos.x).toBeLessThan(1.1);
    expect(c.endDrag(0)).toBe(true);
    settle(c);
    expect(c.pos.x).toBeCloseTo(1, 3);
  });

  test('reversal mid-flight keeps velocity (continuity)', () => {
    const c = new SolarController(false);
    c.setOn(true);
    for (let i = 0; i < 8; i++) c.step(1 / 60);
    const v = c.pos.v;
    c.setOn(false);
    expect(c.pos.v).toBe(v);
    settle(c);
    expect(c.pos.x).toBeCloseTo(0, 3);
  });

  test('renders in every environment and in reduced motion', () => {
    const c = new SolarController(true);
    c.setReducedMotion(true);
    for (const env of ['pearl', 'midnight', 'atmosphere', 'optics'] as const) expect(c.scene(ctx(env)).layers).toHaveLength(2);
  });
});

describe('Atmosphere controller', () => {
  test('tile travels to the chosen slot and ambient air dies down', () => {
    const c = new AtmosphereController('sun');
    c.select('snow');
    c.scene(ctx());
    settle(c, 8);
    const s = c.scene(ctx('midnight'));
    expect(lastShape(s, 1).cx).toBeCloseTo(ATMO_SLOTS[3], 0);
    expect(c.step(1 / 60)).toBe(false);
    c.setAttention(true);
    expect(c.step(1 / 60)).toBe(true);
  });

  test('stretches while travelling', () => {
    const c = new AtmosphereController('sun');
    c.select('snow');
    let maxHW = 0;
    for (let i = 0; i < 30; i++) {
      c.step(1 / 60);
      maxHW = Math.max(maxHW, lastShape(c.scene(ctx()), 1).hw);
    }
    expect(maxHW).toBeGreaterThan(56 * 1.1);
  });
});

describe('Halo controller', () => {
  test('bead sits on the arc at the value angle', () => {
    const c = new HaloController(72);
    c.setValue(30, true);
    settle(c);
    const s = c.scene(ctx());
    const bead = lastShape(s, 1);
    const a = valueToAngle(30);
    expect(bead.cx).toBeCloseTo(HALO.cx + Math.cos(a) * HALO.arc, 3);
    expect(bead.cy).toBeCloseTo(HALO.cy + Math.sin(a) * HALO.arc, 3);
  });

  test('brighter values raise surface brightness', () => {
    const lo = new HaloController(5).scene(ctx()).env.brightness;
    const hi = new HaloController(95).scene(ctx()).env.brightness;
    expect(hi).toBeGreaterThan(lo);
  });
});

describe('Thermal controller', () => {
  test('drag maps the pointer directly and the thumb follows', () => {
    const c = new ThermalController(22);
    const t = c.beginDrag(tempToY(30), false);
    expect(t).toBeCloseTo(30, 5);
    c.step(1 / 60);
    expect(lastShape(c.scene(ctx()), 1).cy).toBeCloseTo(tempToY(30), 0);
    expect(c.drag(-500)).toBe(35);
    c.endDrag();
    c.setValue(12);
    settle(c);
    expect(lastShape(c.scene(ctx('midnight')), 1).cy).toBeCloseTo(tempToY(12), 1);
  });
});

describe('Mode controller', () => {
  test('each mode settles and bloom runs its two-step sequence', () => {
    const c = new ModeController('nature');
    for (const m of ['energy', 'rest', 'bloom'] as const) {
      c.select(m);
      c.setAttention(true);
      for (let i = 0; i < 90; i++) {
        c.step(1 / 60);
        c.scene(ctx());
      }
    }
    c.setAttention(false);
    settle(c, 6);
    expect(lastShape(c.scene(ctx()), 1).cx).toBeCloseTo(MODE_SLOTS[3], 0);
  });
});

describe('Forecast controller', () => {
  test('nested surfaces follow the resizing card', () => {
    const c = new ForecastController('mon', true);
    c.selectDay('wed');
    c.setDetailed(false);
    settle(c, 4);
    const s = c.scene(ctx());
    const card = lastShape(s, 0);
    const track = lastShape(s, 1, 0);
    expect(card.hh * 2).toBeCloseTo(FC.hMinimal, 0);
    expect(track.cy).toBeCloseTo(FC.top + FC.hMinimal - FC.dayGap, 0);
    expect(c.core.geo.y).toBeCloseTo(track.cy, 3);
    expect(lastShape(s, 2, 0).cx).toBeCloseTo(FC_SLOTS[2], 0);
  });
});

import { CanvasGlassRenderer } from '../glass/canvasRenderer';

describe('Canvas2D fallback renderer', () => {
  test('draws every controller scene without throwing', () => {
    const fake = { width: 0, height: 0, getContext: () => stub2d } as unknown as HTMLCanvasElement;
    const r = new CanvasGlassRenderer(fake);
    r.resize(1280, 880, 2);
    expect(fake.width).toBe(1280);
    const scenes = [new SolarController(true), new AtmosphereController('rain'), new HaloController(40), new ThermalController(30), new ModeController('rest'), new ForecastController('thu', false)];
    for (const c of scenes) {
      c.step(1 / 60);
      for (const env of ['pearl', 'midnight'] as const) expect(() => r.render(c.scene(ctx(env)))).not.toThrow();
    }
    r.destroy();
  });
});
