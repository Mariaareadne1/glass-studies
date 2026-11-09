import { LensScan } from '../components/optics/LensScan';
import type { StudyDef } from './studies';

/** Optics & Materials: studies of what the glass does to light. */
export const OPTICS: StudyDef[] = [
  {
    id: 'lens-scan',
    group: 'optics',
    num: 'O1',
    title: 'Lens Scan',
    description: 'A thick glass lens travels over microtype, fine lines, a checkerboard or a small image, bending and magnifying only what it covers.',
    hint: 'Press the sheet to place the lens · loops when indeterminate',
    detail:
      'The sheet is drawn once into a texture beneath the glass; the WebGL pass samples it through the lens surface normal, so the displacement is real refraction and stops exactly at the lens edge. The lens is curved all the way to its centre, which magnifies slightly while staying readable. Loop mode ping-pongs on a raised cosine (no seam); determinate mode places the lens at the supplied fraction and, at 100%, settles on the result and stops.',
    Component: LensScan,
    stores: [],
    capabilities: ['Refraction', 'Texture sampling', 'Determinate mode', 'Pause · speed'],
  },
];
