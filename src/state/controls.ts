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

export const ALL_STORES = [solarStore, atmosphereStore, haloStore, thermalStore, modeStore, forecastDayStore, forecastDetailStore];

export function resetAll(): void {
  ALL_STORES.forEach((s) => s.reset());
}
