import type { ComponentType } from 'react';
import type { EnvironmentKind } from '../glass/types';
import { SolarToggle } from '../components/controls/SolarToggle/SolarToggle';
import { AtmosphereSelector } from '../components/controls/AtmosphereSelector/AtmosphereSelector';
import { ForecastCard } from '../components/controls/ForecastCard/ForecastCard';
import { HaloDial } from '../components/controls/HaloDial/HaloDial';
import { ModeSelector } from '../components/controls/ModeSelector/ModeSelector';
import { ThermalSlider } from '../components/controls/ThermalSlider/ThermalSlider';
import { IrisDial } from '../components/controls/IrisDial/IrisDial';
import { DropletPress } from '../components/controls/DropletPress/DropletPress';
import { DriftPad } from '../components/controls/DriftPad/DriftPad';
import { RangeBeads } from '../components/controls/RangeBeads/RangeBeads';
import { atmosphereStore, driftStore, dropletStore, forecastDayStore, forecastDetailStore, haloStore, irisStore, modeStore, rangeStore, solarStore, thermalStore } from '../state/controls';

export interface StudyDef {
  id: string;
  num: string;
  title: string;
  description: string;
  hint: string;
  detail: string;
  Component: ComponentType<{ env: EnvironmentKind }>;
  /** Stores reset by the focused view's "Reset study". */
  stores: { reset(): void }[];
}

export const STUDIES: StudyDef[] = [
  {
    id: 'solar',
    num: '01',
    title: 'Solar',
    description: 'A day and night toggle. The glass tile stretches as it travels while the moon breaks into squares that settle into a sun.',
    hint: 'Drag, click either side, or use ← →',
    detail:
      'The pixel morph is scrubbed by the thumb itself, so dragging halfway leaves the icon halfway between moon and sun. Release projects the thumb forward by its velocity and snaps to the nearer end.',
    Component: SolarToggle,
    stores: [solarStore],
  },
  {
    id: 'atmosphere',
    num: '02',
    title: 'Atmosphere',
    description: 'A four-position weather selector. One liquid tile stretches between slots while sun rays break into rain, drift into wind and crystallise into snow.',
    hint: 'Click a slot, drag the tile, or use ← → Home End',
    detail:
      'The tile is a single piece of glass on a spring; its stretch is a second spring chasing velocity, so arrival compresses once on its own. Each change sends a short pass of weather through the air around the instrument.',
    Component: AtmosphereSelector,
    stores: [atmosphereStore],
  },
  {
    id: 'halo',
    num: '03',
    title: 'Halo',
    description: 'A circular brightness dial. The arc, the glass bead, the sun’s rays and the light on the surface all follow one value.',
    hint: 'Drag around the dial · wheel or arrow keys when focused',
    detail:
      'Angles map onto a 270° sweep. Inside the bottom gap the value clamps to the nearer end, and a jump straight across the gap is refused, so the dial never flips from 0 to 100.',
    Component: HaloDial,
    stores: [haloStore],
  },
  {
    id: 'thermal',
    num: '04',
    title: 'Thermal',
    description: 'A vertical temperature slider. The thumb tracks your finger exactly; the capsule, the card and the air warm with it.',
    hint: 'Drag the thumb or press the track · ↑ ↓ in 0.5° steps',
    detail:
      'A demonstration set point between 10 °C and 35 °C, not a measurement. While dragging there is no spring between pointer and thumb, so precise values are easy to hit; keyboard steps glide on a stiff spring.',
    Component: ThermalSlider,
    stores: [thermalStore],
  },
  {
    id: 'modes',
    num: '05',
    title: 'Modes',
    description: 'Four modes, each with its own small animation: a leaf bends, a bolt charges, stars drift, a bud opens.',
    hint: 'Click a mode, drag the tile, or use ← →',
    detail:
      'The tile is heavier than Atmosphere’s: it stretches less and leans into its travel. Signature animations play on arrival and while you are engaged with the study, then rest.',
    Component: ModeSelector,
    stores: [modeStore],
  },
  {
    id: 'forecast',
    num: '06',
    title: 'Forecast',
    description: 'A compound weather card with three layers of glass: a day selector, a detail toggle that resizes the card, and a changing sky.',
    hint: 'Pick a day · toggle detailed view (top right)',
    detail:
      'Sample data only; there is no weather service. The card height is a spring, and every nested glass surface is derived from it each frame, so refraction and highlights stay attached while it resizes.',
    Component: ForecastCard,
    stores: [forecastDayStore, forecastDetailStore],
  },
  {
    id: 'iris',
    num: '07',
    title: 'Iris',
    description: 'An aperture dial. Turn the glass ring and seven blades close over a small sun; the f-number scale rides past a fixed index and clicks into each stop.',
    hint: 'Turn the ring · wheel or arrow keys when focused',
    detail:
      'The ring is turned, not pointed at: rotation is accumulated from your hand, so you can grip anywhere. Release projects the ring forward by its angular speed and settles into the nearest of eight detents, each passed detent sending a click of light around the rim.',
    Component: IrisDial,
    stores: [irisStore],
  },
  {
    id: 'droplet',
    num: '08',
    title: 'Droplet',
    description: 'A press-and-hold button. The glass drop flattens and spreads under your finger while water rises inside; hold to the top and it releases.',
    hint: 'Press and hold the drop · or hold Space / Enter',
    detail:
      'Holding fills the drop over 0.9 s and confirms the moment it is full, even before you let go. Let go early and the water drains back. Pressure is a spring that overshoots on release, so the drop bounces back into shape.',
    Component: DropletPress,
    stores: [dropletStore],
  },
  {
    id: 'drift',
    num: '09',
    title: 'Drift',
    description: 'A two-axis mood pad. Throw the glass puck and it drifts across a calm-to-lively, cool-to-warm field, slows with friction and bounces softly off the walls.',
    hint: 'Drag or throw the puck · arrow keys when focused',
    detail:
      'While held, the puck follows the hand exactly. On release it keeps the hand’s velocity, decays exponentially and loses 58% of its speed at each wall, compressing against it on a spring. Its icon re-forms when it crosses into another quadrant of the field.',
    Component: DriftPad,
    stores: [driftStore],
  },
  {
    id: 'beads',
    num: '10',
    title: 'Beads',
    description: 'A dual range for active hours. Two glass beads slide along one track; as they approach, a thin bridge of glass grows between them, as if they were about to merge.',
    hint: 'Drag either bead · arrow keys in half hours',
    detail:
      'Beads never cross and always keep at least two hours apart, where they just touch. Each bead sits exactly under the hand and stretches with its speed; keyboard steps glide on a stiff spring. The bridge is a third glass slab whose thickness follows the distance between the beads.',
    Component: RangeBeads,
    stores: [rangeStore],
  },
];
