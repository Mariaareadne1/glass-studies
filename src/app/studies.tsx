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
import { LiquidTabs } from '../components/controls/LiquidTabs/LiquidTabs';
import { GlassScrubber } from '../components/controls/GlassScrubber/GlassScrubber';
import { atmosphereStore, driftStore, dropletStore, forecastDayStore, forecastDetailStore, haloStore, irisStore, modeStore, rangeStore, solarStore, tabsStore, thermalStore } from '../state/controls';

export type StudyGroup = 'originals' | 'controls' | 'loaders' | 'optics';

export interface StudyDef {
  id: string;
  group: StudyGroup;
  num: string;
  title: string;
  description: string;
  hint: string;
  detail: string;
  Component: ComponentType<{ env: EnvironmentKind }>;
  /** Stores reset by the focused view's "Reset study". */
  stores: { reset(): void }[];
  /** What the study genuinely does, listed in the focused view (e.g. "Refraction", "Camera"). */
  capabilities?: string[];
}

export const STUDIES: StudyDef[] = [
  {
    id: 'solar',
    group: 'originals',
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
    group: 'originals',
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
    group: 'originals',
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
    group: 'originals',
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
    group: 'originals',
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
    group: 'originals',
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
    group: 'controls',
    num: 'C1',
    title: 'Iris',
    description: 'An aperture dial from f/1.8 to f/16. Turn the glass ring or click a printed stop; seven blades close over a small sun.',
    hint: 'Turn the ring or click a number · ← → Home End',
    detail: 'Rotation is accumulated from your hand with angles unwrapped across ±180°, so you can grip anywhere and turn past the seam without a jump. The blades are one disc with the aperture polygon cut out, and the radius follows 1/N, so the opening shrinks monotonically; the readout shows (1.8/N)² of the light as an illustration, not an exposure measurement. Release projects the ring by its angular speed into the nearest of eight detents.',
    Component: IrisDial,
    stores: [irisStore],
  },
  {
    id: 'droplet',
    group: 'controls',
    num: 'C2',
    title: 'Droplet',
    description: 'Press and hold the glass drop for 0.9 s to turn Quiet mode on or off. It flattens, fills and confirms; let go early and nothing happens.',
    hint: 'Press and hold · Space / Enter · Esc cancels',
    detail: 'The threshold is elapsed time on a monotonic clock, not a frame count, so a slow device takes exactly as long. Releasing early, sliding off the drop, Escape, a lost pointer capture or leaving the window all cancel. A completed hold toggles the setting; reversing it needs a new hold. The drop keeps its area as it flattens.',
    Component: DropletPress,
    stores: [dropletStore],
  },
  {
    id: 'drift',
    group: 'controls',
    num: 'C3',
    title: 'Drift',
    description: 'A two-axis wind pad: drag the glass orb to set direction and strength. It holds where you leave it, or springs back to calm.',
    hint: 'Drag · arrows (Shift fine) · Home or double-click centres',
    detail: 'One transform maps the hand to [−1, 1]² and the value is never smoothed: the orb sits exactly under your finger while the glass stretch follows on a softer spring. In Spring back mode the value itself returns to zero on release. Near a wall the orb compresses toward it. The pixel glyph shows the wind: streaks lengthen with strength and point downwind.',
    Component: DriftPad,
    stores: [driftStore],
  },
  {
    id: 'tabs',
    group: 'controls',
    num: 'C4',
    title: 'Liquid Tabs',
    description: 'A tab selector whose single glass membrane flows between Overview, Motion, Optics and Source, drawing out a liquid neck as it travels.',
    hint: 'Click a tab · ← → Home End',
    detail:
      'The membrane is measured from the real tab buttons and drawn as three shapes fused into one optical surface: a leading lobe, a trailing lobe and an area-preserving neck that thins as they separate. Retargeting keeps both springs’ positions and velocities, so a rapid 1→4→2 flows on without splitting. Arrow keys move focus and selection together (automatic activation).',
    Component: LiquidTabs,
    stores: [tabsStore],
    capabilities: ['ARIA tabs', 'Fused refraction', 'Interruptible', 'Real panels'],
  },
  {
    id: 'beads',
    group: 'controls',
    num: 'C5',
    title: 'Beads',
    description: 'A focus window on a 24-hour track. Two glass beads mark start and end; drag either, or drag the window between them; close beads fuse.',
    hint: 'Drag a bead or the window · tap the track · ← → 15 min, Shift 1 h',
    detail: 'One range model in 15-minute steps with a 15-minute minimum: crossing attempts clamp, beads never swap. Dragging the interior moves the whole window and keeps its duration; a tap on the bare track moves the nearer bead there. Beads and the neck between them are one fused glass surface, so near the limit they merge like liquid; a press on fused beads is resolved by the first movement.',
    Component: RangeBeads,
    stores: [rangeStore],
  },
  {
    id: 'scrubber',
    group: 'controls',
    num: 'C6',
    title: 'Glass Scrubber',
    description: 'A real video timeline. A glass lens rides a strip of frames sampled from the video, magnifying them; dragging seeks the actual media.',
    hint: 'Drag or hover the strip · ← → seek 5 s · open your own video',
    detail:
      'The main frame and every thumbnail are decoded from the video itself and drawn beneath the glass, so the lens refracts real frames. Hovering samples the frame at that time on a separate decoder; dragging maps the strip onto currentTime through a seek queue that coalesces requests, so fast scrubs never race the decoder. Your own files stay on this device (an object URL, revoked when replaced). The sample clip is rendered from this collection’s loaders.',
    Component: GlassScrubber,
    stores: [],
    capabilities: ['Real media', 'Seek queue', 'Local files only', 'Keyboard ±5 s'],
  },
];
