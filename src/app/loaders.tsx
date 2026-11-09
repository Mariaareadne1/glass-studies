import { AssemblyLoaderStage, CrystalLoaderStage, MergeLoaderStage, OrbitLoaderStage, TideLoaderStage } from '../components/loaders/LoaderStages';
import { MagneticBeads } from '../components/loaders/MagneticBeads';
import type { StudyDef } from './studies';

/** Glass Loaders: looping, non-interactive pieces built from the same glass, motion and pixel systems. */
export const LOADERS: StudyDef[] = [
  {
    id: 'loader-merge',
    group: 'loaders',
    num: 'L1',
    title: 'Merge',
    description: 'Three pearl droplets orbit, two touch and draw a liquid neck, fuse, take in the third and split again.',
    hint: 'Loops every 4.8 s · determinate mode in focus',
    detail:
      'The droplets render as ONE optical surface: a smooth minimum of their distance fields, with refraction and highlights taken from the fused field, so the neck bends the grid beneath like the droplets do. Radii grow with the square root of the gathered mass, so merging conserves area. Every frame is a pure function of the clock (or of the supplied fraction in determinate mode, where 100% is one bead with a check).',
    Component: MergeLoaderStage,
    stores: [],
    capabilities: ['SDF smooth union', 'Area-conserving', 'Determinate mode', 'Pause · speed'],
  },
  {
    id: 'loader-morph',
    group: 'loaders',
    num: 'L1',
    title: 'Pixel Assembly',
    description: 'Luminous squares gather into a sun, a cloud, a leaf and a moon, dissolve and reassemble inside a glass tile.',
    hint: 'Loops every 6.4 s · determinate mode in focus',
    detail: 'Every square keeps its identity: shared squares are matched by approximate minimum distance, surplus squares fly out and new ones split from a neighbour, and an interrupted morph continues from where the squares are. Determinate mode assembles a chosen icon from a seeded scatter in exact proportion to the supplied fraction, and 100% is the authored bitmap, pixel for pixel. With reduced motion the icons change in place.',
    capabilities: ['Particle identity', 'Deterministic', 'Determinate mode', 'Pause · speed'],
    Component: AssemblyLoaderStage,
    stores: [],
  },
  {
    id: 'loader-tide',
    group: 'loaders',
    num: 'L2',
    title: 'Tide Fill',
    description: 'A glass vessel slowly fills and drains. The surface sways, a bright meniscus clings to the wall and small LED bubbles rise.',
    hint: 'Loops every 3.6 s',
    detail: 'The level follows a raised cosine, so the tide turns softly at both ends and the loop has no seam. The water is painted beneath the glass and refracted through the vessel wall. With reduced motion the level holds still and only the light breathes.',
    Component: TideLoaderStage,
    stores: [],
  },
  {
    id: 'loader-orbit',
    group: 'loaders',
    num: 'L3',
    title: 'Orbit',
    description: 'A glass bead laps a central lens, quickening and easing once per lap and leaving a comet of light behind it.',
    hint: 'Loops every 1.8 s',
    detail: 'The angle adds a single sine to a steady lap, so the bead surges and relaxes without ever stopping, and the loop closes exactly. The lens rim lights where the bead passes, using the same perimeter coordinate as the edge light. With reduced motion the bead rests at the top.',
    Component: OrbitLoaderStage,
    stores: [],
  },
  {
    id: 'loader-crystal',
    group: 'loaders',
    num: 'L4',
    title: 'Crystallize',
    description: 'Frost grows ring by ring into an LED snow crystal, sparkles, then melts and falls away; the glass fogs and clears with it.',
    hint: 'Loops every 2.8 s',
    detail: 'Cells appear in order of distance from the centre with a little jitter, hold while a few catch the light, then melt from the outside in and fall. The tile’s frost follows the crystal, so the glass itself seems to freeze. With reduced motion the crystal stays and gently brightens.',
    Component: CrystalLoaderStage,
    stores: [],
  },
  {
    id: 'loader-magnet',
    group: 'loaders',
    num: 'L4',
    title: 'Magnetic Beads',
    description: 'Four clear glass beads slide in a pearl track, drawn toward invisible magnets, repelling before they touch; then the polarity flips.',
    hint: 'Press the track to hold a magnet · polarity and strength in focus',
    detail:
      'A physically inspired simulation, not exact electromagnetism: magnet forces fall off as 1/(d + 38), every force and speed is capped, beads repel at short range and are separated positionally, and integration runs in fixed 1/240 s steps with damping, so long frames and resumes cannot explode. The cycle is deterministic from a seed. “Complete” draws the beads into a resting check mark, after which the loop stops.',
    Component: MagneticBeads,
    stores: [],
    capabilities: ['Fixed-step physics', 'Bounded forces', 'Draggable magnet', 'Pause · speed'],
  },
];
