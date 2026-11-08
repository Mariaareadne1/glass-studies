import type { Day } from './controls';
import type { IconName } from '../pixels/iconDefinitions';

/**
 * Clearly labelled SAMPLE forecast. There is no weather service; these
 * values are fixed, internally consistent demo data (high ≥ now ≥ low).
 */
export interface DayForecast {
  label: string;
  condition: string;
  icon: IconName;
  temp: number;
  high: number;
  low: number;
  humidity: number;
  windKmh: number;
  sky: readonly [number, number, number];
}

export const SAMPLE_LOCATION = 'Lisbon';

export const FORECAST: Record<Day, DayForecast> = {
  mon: { label: 'Mon', condition: 'Clear', icon: 'sun', temp: 24, high: 26, low: 17, humidity: 48, windKmh: 9, sky: [1.0, 0.72, 0.42] },
  tue: { label: 'Tue', condition: 'Partly cloudy', icon: 'partly', temp: 21, high: 23, low: 16, humidity: 61, windKmh: 14, sky: [0.86, 0.78, 0.74] },
  wed: { label: 'Wed', condition: 'Rain', icon: 'rain', temp: 17, high: 18, low: 14, humidity: 88, windKmh: 22, sky: [0.48, 0.6, 0.9] },
  thu: { label: 'Thu', condition: 'Breezy', icon: 'wind', temp: 19, high: 20, low: 15, humidity: 66, windKmh: 31, sky: [0.45, 0.82, 0.74] },
};
