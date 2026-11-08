import { describe, expect, test } from 'vitest';
import { perimeterLength, perimeterParam, perimeterPoint, sdRoundRect, wrapDelta } from '../glass/geometry';

const rect = { hw: 100, hh: 40, radius: 30 };
const circle = { hw: 50, hh: 50, radius: 50 };

describe('rounded-rect geometry', () => {
  test('signed distance is negative inside, zero on the edge, positive outside', () => {
    expect(sdRoundRect(0, 0, rect)).toBeCloseTo(-40);
    expect(sdRoundRect(100, 0, rect)).toBeCloseTo(0);
    expect(sdRoundRect(110, 0, rect)).toBeCloseTo(10);
  });

  test('perimeter length matches the analytic formula', () => {
    expect(perimeterLength(rect)).toBeCloseTo(4 * (70 + 10) + 2 * Math.PI * 30);
    expect(perimeterLength(circle)).toBeCloseTo(2 * Math.PI * 50);
  });

  test.each([rect, circle])('perimeterParam inverts perimeterPoint around the whole loop', (r) => {
    for (let i = 0; i < 64; i++) {
      const u = i / 64;
      const p = perimeterPoint(u, r);
      expect(Math.abs(wrapDelta(perimeterParam(p.x, p.y, r), u))).toBeLessThan(1e-4);
    }
  });

  test('parameter increases monotonically counter-clockwise without seams', () => {
    let prev = perimeterParam(rect.hw, -9.99, rect);
    for (let i = 1; i <= 200; i++) {
      const p = perimeterPoint(i / 200, rect);
      const u = perimeterParam(p.x * 1.2, p.y * 1.2, rect); // slightly outside
      expect(wrapDelta(u, prev)).toBeGreaterThanOrEqual(-1e-3);
      prev = u;
    }
  });

  test('wrapDelta is wrap-aware', () => {
    expect(wrapDelta(0.02, 0.98)).toBeCloseTo(0.04);
    expect(wrapDelta(0.98, 0.02)).toBeCloseTo(-0.04);
  });
});
