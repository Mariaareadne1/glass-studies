/** Titles per collection, in gallery order. Keep in sync with src/app registry. */
export const CATALOG: Record<string, string[]> = {
  'Weather Instruments': ['Solar', 'Atmosphere', 'Halo', 'Thermal', 'Modes', 'Forecast'],
  Controls: ['Iris', 'Droplet', 'Drift', 'Liquid Tabs', 'Beads', 'Glass Scrubber'],
  Loaders: ['Merge', 'Tide Fill', 'Pixel Assembly', 'Magnetic Beads', 'Aperture Capture', 'Audio Render', 'Orbit', 'Crystallize'],
  'Optics & Materials': ['Lens Scan', 'Caustic', 'Glass Stitch'],
};
export const TOTAL = Object.values(CATALOG).reduce((n, l) => n + l.length, 0);
