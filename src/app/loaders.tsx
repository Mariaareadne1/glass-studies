import { CrystalLoaderStage, MorphLoaderStage, OrbitLoaderStage, TideLoaderStage } from '../components/loaders/LoaderStages';
import type { StudyDef } from './studies';

/** Glass Loaders: looping, non-interactive pieces built from the same glass, motion and pixel systems. */
export const LOADERS: StudyDef[] = [
  {
    id: 'loader-morph',
    num: 'L1',
    title: 'Pixel Morph',
    description: 'A glass tile whose LED icon rebuilds itself square by square: dots, hourglass, diamond, drop. A light laps the rim once per beat.',
    hint: 'Loops every 4.6 s',
    detail: 'Each beat runs the same particle morph as the instruments (seeded greedy matching, staggered flight), so the loader is a quiet rehearsal of the whole pixel system. With reduced motion the icons change in place and the rim only glows.',
    Component: MorphLoaderStage,
    stores: [],
  },
  {
    id: 'loader-tide',
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
    num: 'L4',
    title: 'Crystallize',
    description: 'Frost grows ring by ring into an LED snow crystal, sparkles, then melts and falls away; the glass fogs and clears with it.',
    hint: 'Loops every 2.8 s',
    detail: 'Cells appear in order of distance from the centre with a little jitter, hold while a few catch the light, then melt from the outside in and fall. The tile’s frost follows the crystal, so the glass itself seems to freeze. With reduced motion the crystal stays and gently brightens.',
    Component: CrystalLoaderStage,
    stores: [],
  },
];
