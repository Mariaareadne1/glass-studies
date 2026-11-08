import { describe, expect, test } from 'vitest';
import { FORECAST } from '../state/forecastData';
import { DAYS } from '../state/controls';
import { valueFromAngle, valueToAngle } from '../components/controls/HaloDial/haloController';
import { snapTemp, tempToY, yToTemp, iconForTemp, THERMAL_Y0, THERMAL_Y1 } from '../components/controls/ThermalSlider/thermalController';

describe('sample forecast data', () => {
  test('every day is internally consistent', () => {
    for (const d of DAYS) {
      const f = FORECAST[d];
      expect(f.low).toBeLessThanOrEqual(f.temp);
      expect(f.temp).toBeLessThanOrEqual(f.high);
      expect(f.humidity).toBeGreaterThan(0);
      expect(f.humidity).toBeLessThanOrEqual(100);
    }
  });
});

describe('halo angular mapping', () => {
  test('maps the 270° sweep to 0..100', () => {
    expect(valueFromAngle(135, 50)).toBeCloseTo(0);
    expect(valueFromAngle(270, 50)).toBeCloseTo(50);
    expect(valueFromAngle(45, 50)).toBeCloseTo(100);
    expect(valueFromAngle(-90, 50)).toBeCloseTo(50);
  });
  test('round-trips value → angle → value', () => {
    for (const v of [0, 13, 50, 72, 99, 100]) {
      const deg = (valueToAngle(v) * 180) / Math.PI;
      expect(valueFromAngle(deg, v)).toBeCloseTo(v, 6);
    }
  });
  test('the bottom gap clamps to the nearer end and never jumps across', () => {
    expect(valueFromAngle(100, 5)).toBe(0); // gap, near the start
    expect(valueFromAngle(80, 95)).toBe(100); // gap, near the end
    expect(valueFromAngle(136, 98)).toBe(100); // crossing 100 → 0 is refused
    expect(valueFromAngle(44, 2)).toBe(0); // crossing 0 → 100 is refused
  });
});

describe('thermal vertical mapping', () => {
  test('up is warmer and the ends are exact', () => {
    expect(tempToY(10)).toBeCloseTo(THERMAL_Y0);
    expect(tempToY(35)).toBeCloseTo(THERMAL_Y1);
    expect(tempToY(30)).toBeLessThan(tempToY(20));
    expect(yToTemp(THERMAL_Y0 + 50)).toBe(10);
    expect(yToTemp(THERMAL_Y1 - 50)).toBe(35);
    expect(yToTemp(tempToY(22.5))).toBeCloseTo(22.5);
  });
  test('snaps to half degrees inside bounds', () => {
    expect(snapTemp(22.26)).toBe(22.5);
    expect(snapTemp(9)).toBe(10);
    expect(snapTemp(40)).toBe(35);
  });
  test('illustration thresholds', () => {
    expect(iconForTemp(12)).toBe('snow');
    expect(iconForTemp(22)).toBe('partly');
    expect(iconForTemp(30)).toBe('sun');
  });
});
