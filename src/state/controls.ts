import { bool, clampNumber, createStore, oneOf } from './persistence';

/** Single source of truth for every study's user-facing value. */

export const WEATHER = ['sun', 'rain', 'wind', 'snow'] as const;
export type Weather = (typeof WEATHER)[number];

export const MODES = ['nature', 'energy', 'rest', 'bloom'] as const;
export type Mode = (typeof MODES)[number];

export const DAYS = ['mon', 'tue', 'wed', 'thu'] as const;
export type Day = (typeof DAYS)[number];

export const THERMAL_MIN = 10;
export const THERMAL_MAX = 35;
export const THERMAL_STEP = 0.5;

export const solarStore = createStore<boolean>('solar', false, bool); // false = moon/night
export const atmosphereStore = createStore<Weather>('atmosphere', 'sun', oneOf(WEATHER));
export const haloStore = createStore<number>('halo', 72, clampNumber(0, 100));
export const thermalStore = createStore<number>('thermal', 22, (raw) => {
  const v = clampNumber(THERMAL_MIN, THERMAL_MAX)(raw);
  return v === null ? null : Math.round(v / THERMAL_STEP) * THERMAL_STEP;
});
export const modeStore = createStore<Mode>('mode', 'nature', oneOf(MODES));
export const forecastDayStore = createStore<Day>('forecast-day', 'mon', oneOf(DAYS));
export const forecastDetailStore = createStore<boolean>('forecast-detail', true, bool);

// ---- V3 instruments
/** Iris Dial: index into IRIS_STOPS (0 = widest aperture). */
export const IRIS_STOPS = [1.8, 2, 2.8, 4, 5.6, 8, 11, 16] as const;
export const irisStore = createStore<number>('iris', 2, (raw) => {
  const v = clampNumber(0, IRIS_STOPS.length - 1)(raw);
  return v === null ? null : Math.round(v);
});
/** Droplet Press: how many drops have been released by press-and-hold. */
export const dropletStore = createStore<number>('droplet', 0, (raw) => {
  const v = clampNumber(0, 1e6)(raw);
  return v === null ? null : Math.floor(v);
});
/** Droplet Press: the setting a completed hold toggles (a deliberate, two-way action). */
export const quietStore = createStore<boolean>('droplet-quiet', false, (raw) => (typeof raw === 'boolean' ? raw : null));
/** Drift Pad: wind direction (x, west −1 … east +1) and strength (y, calm −1 … strong +1). */
export interface DriftValue {
  x: number;
  y: number;
}
const unit = clampNumber(-1, 1);
export const driftStore = createStore<DriftValue>('wind', { x: 0, y: 0 }, (raw) => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const x = unit(r.x);
  const y = unit(r.y);
  if (x === null || y === null) return null;
  // two decimals: the value the readout shows is the value that is stored
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
});
/** Drift Pad release behaviour. */
export type DriftMode = 'spring' | 'hold';
export const driftModeStore = createStore<DriftMode>('wind-mode', 'hold', (raw) => (raw === 'spring' || raw === 'hold' ? raw : null));

export const RANGE_MIN = 0;
export const RANGE_MAX = 24;
export const RANGE_STEP = 0.25;
export const RANGE_GAP = 0.25;
export interface RangeValue {
  start: number;
  end: number;
}
export const rangeStore = createStore<RangeValue>('range-v3', { start: 9, end: 17 }, (raw) => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const a = clampNumber(RANGE_MIN, RANGE_MAX)(r.start);
  const b = clampNumber(RANGE_MIN, RANGE_MAX)(r.end);
  if (a === null || b === null || b - a < RANGE_GAP - 1e-9) return null;
  const snap = (v: number) => Math.round(v / RANGE_STEP) * RANGE_STEP;
  return { start: snap(a), end: snap(b) };
});

/** Liquid Tabs: selected tab index. */
export const TAB_NAMES = ['Overview', 'Motion', 'Optics', 'Source'] as const;
export const tabsStore = createStore<number>('tabs', 0, (raw) => {
  const v = clampNumber(0, TAB_NAMES.length - 1)(raw);
  return v === null ? null : Math.round(v);
});

export const ALL_STORES = [tabsStore, quietStore, driftModeStore, solarStore, atmosphereStore, haloStore, thermalStore, modeStore, forecastDayStore, forecastDetailStore, irisStore, dropletStore, driftStore, rangeStore];

export function resetAll(): void {
  ALL_STORES.forEach((s) => s.reset());
}
