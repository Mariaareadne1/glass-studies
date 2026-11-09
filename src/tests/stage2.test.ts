import { describe, expect, test } from 'vitest';
import { SeekQueue } from '../components/controls/GlassScrubber/seekQueue';
import type { Seekable } from '../components/controls/GlassScrubber/seekQueue';
import { formatTime, SCRUB, thumbTimes, timeToX, xToTime } from '../components/controls/GlassScrubber/scrubberMath';
import { aperturePolygon, apertureRadius, fNumber, IRIS, lightAdmitted, polygonArea, SCALE_RADIUS, tickAt } from '../components/controls/IrisDial/irisController';
import { RotaryTracker, wrapDeg } from '../motion/rotary';
import { IRIS_STOPS } from '../state/controls';

/** A fake media element: seeks complete only when the test says so. */
class FakeMedia implements Seekable {
  duration = 10;
  seeking = false;
  issued: number[] = [];
  private t = 0;
  private listeners = new Set<() => void>();
  get currentTime() {
    return this.t;
  }
  set currentTime(v: number) {
    this.t = v;
    this.seeking = true;
    this.issued.push(v);
  }
  addEventListener(_t: 'seeked', l: () => void) {
    this.listeners.add(l);
  }
  removeEventListener(_t: 'seeked', l: () => void) {
    this.listeners.delete(l);
  }
  finishSeek() {
    this.seeking = false;
    this.listeners.forEach((l) => l());
  }
}

describe('Glass Scrubber', () => {
  test('rapid seeks coalesce: only the latest pending target is issued after each seeked', () => {
    const m = new FakeMedia();
    const q = new SeekQueue(m);
    q.request(1);
    q.request(2);
    q.request(3);
    q.request(4);
    expect(m.issued).toEqual([1]);
    m.finishSeek();
    expect(m.issued).toEqual([1, 4]);
    m.finishSeek();
    expect(q.busy).toBe(false);
    q.dispose();
  });

  test('targets clamp to the real duration; no out-of-bounds time', () => {
    const m = new FakeMedia();
    const q = new SeekQueue(m);
    q.request(-3);
    m.finishSeek();
    q.request(99);
    m.finishSeek();
    q.request(Number.NaN);
    expect(m.issued.every((t) => t >= 0 && t <= 10)).toBe(true);
    expect(m.issued).toContain(10);
    m.duration = Number.NaN;
    expect(q.clamp(5)).toBe(0);
  });

  test('strip position and time map exactly at 0 / 50 / 100%', () => {
    const { x, w } = SCRUB.strip;
    expect(xToTime(x, 20)).toBe(0);
    expect(xToTime(x + w / 2, 20)).toBe(10);
    expect(xToTime(x + w, 20)).toBe(20);
    expect(xToTime(x + w + 50, 20)).toBe(20);
    expect(timeToX(5, 20)).toBe(x + w / 4);
    expect(xToTime(x + 10, 0)).toBe(0);
    expect(formatTime(65.25)).toBe('1:05.3');
    expect(formatTime(Number.NaN)).toBe('0:00.0');
    expect(thumbTimes(12, 12)).toEqual(Array.from({ length: 12 }, (_, i) => i + 0.5));
  });
});

describe('Iris Dial', () => {
  test('the opening shrinks monotonically with f-number, even between stops', () => {
    let prevR = Infinity;
    let prevA = Infinity;
    for (let s = 0; s <= IRIS_STOPS.length - 1; s += 0.05) {
      const r = apertureRadius(s);
      const a = polygonArea(aperturePolygon(s));
      expect(r).toBeLessThan(prevR);
      expect(a).toBeLessThan(prevA);
      expect(r).toBeGreaterThanOrEqual(IRIS.apertureMin - 1e-9);
      prevR = r;
      prevA = a;
    }
    expect(fNumber(0)).toBe(1.8);
    expect(fNumber(IRIS_STOPS.length - 1)).toBe(16);
    // inverse-square: f/16 lets through (1.8/16)² of f/1.8's light
    expect(lightAdmitted(IRIS_STOPS.length - 1)).toBeCloseTo((1.8 / 16) ** 2, 9);
  });

  test('blade tips lie on the aperture circle: the polygon is closed, regular and gap-free', () => {
    for (const s of [0, 3.5, 7]) {
      const pts = aperturePolygon(s, 0.4);
      expect(pts).toHaveLength(IRIS.bladeCount);
      const r = apertureRadius(s);
      for (const [x, y] of pts) expect(Math.hypot(x - IRIS.cx, y - IRIS.cy)).toBeCloseTo(r, 9);
      const sides = pts.map((p, i) => Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]));
      for (const side of sides) expect(side).toBeCloseTo(sides[0], 9);
    }
  });

  test('clicking a printed number finds that stop wherever the ring has turned', () => {
    for (const displayed of [0, 2, 5]) {
      for (let i = 0; i < IRIS_STOPS.length; i++) {
        const a = -Math.PI / 2 + ((i - displayed) * IRIS.stepDeg * Math.PI) / 180;
        const hit = tickAt(IRIS.cx + Math.cos(a) * SCALE_RADIUS, IRIS.cy + Math.sin(a) * SCALE_RADIUS, displayed);
        // labels beyond ±180° from the index wrap onto others; only check the visible half-ring
        if (Math.abs(i - displayed) * IRIS.stepDeg < 170) expect(hit).toBe(i);
      }
    }
    expect(tickAt(IRIS.cx, IRIS.cy, 2)).toBeNull();
  });

  test('rotary input unwraps across ±180° without jumps', () => {
    expect(wrapDeg(350)).toBe(-10);
    expect(wrapDeg(-190)).toBe(170);
    const r = new RotaryTracker(0, 0);
    r.begin(-100, 1, 0); // just below the −x axis (≈179.4°)
    r.move(-100, -1, 16); // just above it (≈−179.4°): a 1.1° step, not −358°
    expect(Math.abs(r.total)).toBeLessThan(2);
    // a full turn in 36 steps accumulates 360°
    const t = new RotaryTracker(0, 0);
    t.begin(100, 0, 0);
    for (let k = 1; k <= 36; k++) t.move(100 * Math.cos((k * Math.PI) / 18), 100 * Math.sin((k * Math.PI) / 18), k * 16);
    expect(t.total).toBeCloseTo(360, 6);
  });
});
