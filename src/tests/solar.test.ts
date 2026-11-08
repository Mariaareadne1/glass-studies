import { describe, expect, test } from 'vitest';
import { solarSnapTarget } from '../components/controls/SolarToggle/solarController';
import { nearestSlot } from '../components/controls/shared/selectorCore';

describe('drag release thresholds', () => {
  test('solar snaps by projected midpoint', () => {
    expect(solarSnapTarget(0.4, 0)).toBe(0);
    expect(solarSnapTarget(0.6, 0)).toBe(1);
    expect(solarSnapTarget(0.4, 2)).toBe(1); // a flick toward day carries it over
    expect(solarSnapTarget(0.7, -3)).toBe(0); // a flick back toward night
    expect(solarSnapTarget(0.02, 50)).toBe(0); // projection is capped
    expect(solarSnapTarget(1.08, 0)).toBe(1);
  });

  test('selectors settle in the nearest slot after projection', () => {
    const slots = [100, 200, 300, 400];
    expect(nearestSlot(slots, 240)).toBe(1);
    expect(nearestSlot(slots, 240, 900)).toBe(2);
    expect(nearestSlot(slots, 120, 99999)).toBe(1); // a flick reaches at most about half a slot
    expect(nearestSlot(slots, 20)).toBe(0);
    expect(nearestSlot(slots, 999)).toBe(3);
  });
});
