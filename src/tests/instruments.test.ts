import { describe, expect, test } from 'vitest';
import type { SceneContext } from '../glass/GlassStage';
import { MAX_LAYERS, MAX_SHAPES_PER_LAYER } from '../glass/types';
import type { GlassScene } from '../glass/types';
import { apertureRadius, detentAfterRelease, formatStop, IrisController, lightAdmitted, stopFromRotation } from '../components/controls/IrisDial/irisController';
import { HoldGesture } from '../components/controls/DropletPress/holdGesture';
import { DROP, DropletController } from '../components/controls/DropletPress/dropletController';
import { DriftController } from '../components/controls/DriftPad/driftController';
import { DRIFT, directionLabel, strengthPct, toPosition, toValue, TRAVEL, windGlyph } from '../components/controls/DriftPad/windMath';
import { formatHour, formatSpan, moveBead, moveWindow, nearestBead, snapHour } from '../components/controls/RangeBeads/rangeMath';
import { hourToX, RANGE, RangeController, xToHour } from '../components/controls/RangeBeads/rangeController';
import { IRIS_STOPS, RANGE_GAP, rangeStore } from '../state/controls';

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

const run = (c: { step(dt: number): boolean }, seconds: number) => {
  let last = true;
  for (let t = 0; t < seconds; t += 1 / 60) last = c.step(1 / 60);
  return last;
};

/** Every scene must fit the renderer's pass limits. */
function expectRenderable(s: GlassScene) {
  expect(s.layers.length).toBeLessThanOrEqual(MAX_LAYERS);
  for (const l of s.layers) {
    expect(l.shapes.length).toBeLessThanOrEqual(MAX_SHAPES_PER_LAYER);
    for (const sh of l.shapes) {
      expect(sh.radius).toBeLessThanOrEqual(Math.min(sh.hw, sh.hh) + 1e-6);
      expect(Number.isFinite(sh.cx + sh.cy + sh.hw + sh.hh)).toBe(true);
    }
  }
}

describe('Iris Dial', () => {
  test('aperture closes monotonically from wide open to the smallest stop', () => {
    for (let i = 1; i < IRIS_STOPS.length; i++) expect(apertureRadius(i)).toBeLessThan(apertureRadius(i - 1));
    expect(lightAdmitted(0)).toBeCloseTo(1, 5);
    expect(lightAdmitted(IRIS_STOPS.length - 1)).toBeLessThan(0.05);
  });

  test('turning the ring clockwise opens up; release lands on a detent', () => {
    expect(stopFromRotation(4, 60)).toBe(2);
    expect(stopFromRotation(4, -30)).toBe(5);
    expect(detentAfterRelease(2.4, 0)).toBe(2);
    expect(detentAfterRelease(2.4, -200)).toBe(3); // a counter-clockwise flick carries one further
    expect(detentAfterRelease(-3, 0)).toBe(0);
    expect(formatStop(2)).toBe('f/2.8');
  });

  test('settles on the chosen stop and goes idle; scenes are renderable in both studios', () => {
    const c = new IrisController(0);
    c.setStop(5);
    expect(run(c, 3)).toBe(false);
    expect(c.display.x).toBeCloseTo(5, 3);
    expectRenderable(c.scene(ctx()));
    expectRenderable(c.scene(ctx('midnight')));
  });

  test('turning past an end stop rubber-bands instead of running away', () => {
    const c = new IrisController(0);
    c.dragging = true;
    c.turnTo(-4);
    expect(c.display.x).toBeLessThan(0);
    expect(c.display.x).toBeGreaterThan(-0.4);
  });
});

describe('Droplet Press', () => {
  /** A fake monotonic clock: tests advance time explicitly. */
  const clock = () => {
    const c = { t: 0, now: () => c.t };
    return c;
  };
  const hold = (h: HoldGesture, c: { t: number }, seconds: number, frame = 1 / 60): number => {
    let confirms = 0;
    for (let t = 0; t < seconds - 1e-9; t += frame) {
      c.t += frame;
      if (h.update()) confirms++;
    }
    return confirms;
  };

  test('only a completed hold activates: releases at 10% and 80% do nothing, 100% fires once', () => {
    for (const [frac, want] of [[0.1, 0], [0.8, 0], [1.05, 1]] as const) {
      const c = clock();
      const h = new HoldGesture(c.now, 0.9, 1.4);
      h.press();
      const n = hold(h, c, 0.9 * frac);
      h.release();
      expect(n + hold(h, c, 2)).toBe(want);
    }
  });

  test('the threshold is elapsed time, not frame count: 4 fps confirms at the same moment as 60 fps', () => {
    const c = clock();
    const h = new HoldGesture(c.now, 0.9, 1.4);
    h.press();
    expect(hold(h, c, 0.75, 0.25)).toBe(0);
    expect(hold(h, c, 0.25, 0.25)).toBe(1);
    expect(h.phase).toBe('confirmed');
  });

  test('cancel (Escape, lost capture, blur) aborts and a new press restarts the timer from zero', () => {
    const c = clock();
    const h = new HoldGesture(c.now, 0.9, 1.4);
    h.press();
    hold(h, c, 0.7);
    h.cancel();
    expect(hold(h, c, 0.2)).toBe(0);
    expect(h.phase).toBe('idle');
    h.press();
    expect(hold(h, c, 0.6)).toBe(0); // 0.6 s of a fresh hold is not enough
    expect(hold(h, c, 0.35)).toBe(1);
  });

  test('after the rest the gesture is ready again and the fill has drained', () => {
    const c = clock();
    const h = new HoldGesture(c.now, 0.5, 0.5);
    h.press();
    hold(h, c, 0.6);
    h.release();
    hold(h, c, 1.5);
    expect(h.phase).toBe('idle');
    expect(h.visual).toBe(0);
    h.press();
    expect(h.phase).toBe('holding');
  });

  test('dozens of repeated holds each activate exactly once', () => {
    const c = clock();
    const h = new HoldGesture(c.now, 0.9, 1.4);
    let total = 0;
    for (let i = 0; i < 30; i++) {
      h.press();
      total += hold(h, c, 1.0);
      h.release();
      total += hold(h, c, 1.6);
    }
    expect(total).toBe(30);
  });

  test('the drop flattens and spreads with conserved area, then the loop goes idle', () => {
    const c = clock();
    const d = new DropletController(c.now);
    let confirmed = 0;
    d.onConfirm = () => confirmed++;
    const runD = (s: number) => {
      let moving = true;
      for (let t = 0; t < s; t += 1 / 60) {
        c.t += 1 / 60;
        moving = d.step(1 / 60);
      }
      return moving;
    };
    d.press();
    runD(0.4);
    const pressed = d.shape();
    expect(pressed.hw).toBeGreaterThan(DROP.r);
    expect(pressed.hh).toBeLessThan(DROP.r);
    expect((pressed.hw * pressed.hh) / (DROP.r * DROP.r)).toBeCloseTo(1, 1);
    runD(0.8);
    expect(confirmed).toBe(1);
    d.release();
    expect(runD(4)).toBe(false);
    expect(d.shape().hw).toBeCloseTo(DROP.r, 1);
    expectRenderable(d.scene(ctx()));
    expectRenderable(d.scene(ctx('midnight')));
  });
});

describe('Drift Pad', () => {
  test('corners and centre map to exact normalised values, and round-trip', () => {
    expect(toValue(DRIFT.cx, DRIFT.cy)).toEqual({ x: 0, y: 0 });
    expect(toValue(DRIFT.cx + TRAVEL, DRIFT.cy - TRAVEL)).toEqual({ x: 1, y: 1 });
    expect(toValue(DRIFT.cx - TRAVEL, DRIFT.cy + TRAVEL)).toEqual({ x: -1, y: -1 });
    // beyond the pad clamps to the edge
    expect(toValue(DRIFT.cx + 999, DRIFT.cy + 999)).toEqual({ x: 1, y: -1 });
    for (const v of [{ x: 0.25, y: -0.6 }, { x: -1, y: 1 }]) {
      const p = toPosition(v);
      const back = toValue(p.x, p.y);
      expect(back.x).toBeCloseTo(v.x, 9);
      expect(back.y).toBeCloseTo(v.y, 9);
    }
    expect(strengthPct({ x: 0, y: -1 })).toBe(0);
    expect(strengthPct({ x: 0, y: 1 })).toBe(100);
    expect(directionLabel({ x: 0.02, y: 0 })).toBe('Still');
    expect(directionLabel({ x: -0.9, y: 0 })).toBe('West');
  });

  test('the wind glyph points downwind, lengthens with strength and stays on the grid', () => {
    const calmEast = windGlyph({ x: 0.8, y: -0.8 });
    const strongEast = windGlyph({ x: 0.8, y: 0.9 });
    const strongWest = windGlyph({ x: -0.8, y: 0.9 });
    expect(strongEast.length).toBeGreaterThan(calmEast.length);
    const meanX = (px: { x: number }[]) => px.reduce((a, p) => a + p.x, 0) / px.length;
    expect(meanX(strongEast)).toBeLessThan(meanX(strongWest) + 12);
    for (const g of [calmEast, strongEast, strongWest, windGlyph({ x: 0, y: 0 })]) {
      for (const p of g) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(12);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(12);
      }
    }
  });

  test('hold mode keeps the exact value and does not drift; spring mode returns the state and orb to zero', () => {
    const c = new DriftController({ x: 0, y: 0 });
    c.setMode('hold');
    c.beginDrag();
    c.dragTo(DRIFT.cx + TRAVEL * 0.5, DRIFT.cy - TRAVEL * 0.25);
    const held = c.release();
    expect(held.x).toBeCloseTo(0.5, 9);
    expect(held.y).toBeCloseTo(0.25, 9);
    expect(run(c, 3)).toBe(false);
    expect(c.value.x).toBeCloseTo(0.5, 9);
    expect(c.value.y).toBeCloseTo(0.25, 9);

    c.setMode('spring');
    c.beginDrag();
    c.dragTo(DRIFT.cx - TRAVEL, DRIFT.cy + TRAVEL);
    expect(c.release()).toEqual({ x: 0, y: 0 });
    expect(run(c, 4)).toBe(false);
    expect(Math.abs(c.value.x)).toBeLessThan(0.002);
    expect(Math.abs(c.value.y)).toBeLessThan(0.002);
    expectRenderable(c.scene(ctx()));
    expectRenderable(c.scene(ctx('midnight')));
  });
});

describe('Dual Range Beads', () => {
  test('beads never cross and keep the minimum gap', () => {
    const r = { start: 8, end: 18 };
    expect(moveBead(r, 'start', 20)).toEqual({ start: 18 - RANGE_GAP, end: 18 });
    expect(moveBead(r, 'end', 3)).toEqual({ start: 8, end: 8 + RANGE_GAP });
    expect(moveBead(r, 'start', -5).start).toBe(0);
    expect(moveBead(r, 'end', 30).end).toBe(24);
  });

  test('a press picks the nearer bead; formatting reads naturally', () => {
    expect(nearestBead({ start: 8, end: 18 }, 9)).toBe('start');
    expect(nearestBead({ start: 8, end: 18 }, 16)).toBe('end');
    expect(snapHour(7.74)).toBe(7.75);
    expect(snapHour(7.6)).toBe(7.5);
    expect(formatHour(7.25)).toBe('07:15');
    expect(formatSpan({ start: 8, end: 18.5 })).toBe('10 h 30 min');
    expect(formatSpan({ start: 9, end: 17 })).toBe('8 h');
    expect(formatSpan({ start: 9, end: 9.25 })).toBe('15 min');
  });

  test('moving the window preserves its duration and clamps at the ends of the day', () => {
    const r = { start: 9, end: 17 };
    expect(moveWindow(r, 2)).toEqual({ start: 11, end: 19 });
    expect(moveWindow(r, 20)).toEqual({ start: 16, end: 24 });
    expect(moveWindow(r, -20)).toEqual({ start: 0, end: 8 });
    for (const d of [-30, -3.25, 0, 0.75, 9, 99]) {
      const m = moveWindow(r, d);
      expect(m.end - m.start).toBeCloseTo(8, 9);
      expect(m.start).toBeGreaterThanOrEqual(0);
      expect(m.end).toBeLessThanOrEqual(24);
    }
  });

  test('crossing attempts clamp at the 15-minute gap (no swap)', () => {
    const r = { start: 9, end: 17 };
    expect(moveBead(r, 'start', 23)).toEqual({ start: 16.75, end: 17 });
    expect(moveBead(r, 'end', 1)).toEqual({ start: 9, end: 9.25 });
  });

  test('hour and track position round-trip within the track', () => {
    for (const h of [0, 6.5, 12, 24]) expect(xToHour(hourToX(h))).toBeCloseTo(h, 6);
    expect(hourToX(0)).toBeGreaterThan(RANGE.cx - RANGE.trackHW);
    expect(hourToX(24)).toBeLessThan(RANGE.cx + RANGE.trackHW);
  });

  test('the store rejects windows narrower than the gap', () => {
    rangeStore.set({ start: 10, end: 10.1 });
    expect(rangeStore.get().end - rangeStore.get().start).toBeGreaterThanOrEqual(RANGE_GAP);
    rangeStore.reset();
  });

  test('close beads grow a glass bridge; the scene stays within pass limits', () => {
    const c = new RangeController({ start: 8, end: 10 });
    const near = c.scene(ctx());
    expect(near.layers[1].shapes).toHaveLength(3);
    expectRenderable(near);
    const far = new RangeController({ start: 2, end: 22 }).scene(ctx('midnight'));
    expect(far.layers[1].shapes).toHaveLength(2);
    expectRenderable(far);
    c.setRange({ start: 4, end: 20 });
    expect(run(c, 3)).toBe(false);
  });
});
