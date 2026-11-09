import { LensScan } from '../components/optics/LensScan';
import { Caustic } from '../components/optics/Caustic';
import { GlassStitch } from '../components/optics/GlassStitch';
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
  {
    id: 'caustic',
    group: 'optics',
    num: 'O2',
    title: 'Caustic',
    description: 'A point light circles a clear glass lens; the lens gathers and splits the light into a moving caustic on the plane below.',
    hint: 'Drag the light · arrow keys when focused · sphere or capsule',
    detail:
      'The pattern is a photon map: about 160 000 rays from the light are refracted by the lens’s own surface profile and index (1.52, the same as the glass shader), cross the flat underside and land on the plane, where they are counted. Where light is taken away the plane darkens; where it is gathered, a soft tonemap caps it so it never blows out. Approximation: two refracting surfaces, thin-lens travel, no reflections. The glass then refracts the plane it lit.',
    Component: Caustic,
    stores: [],
    capabilities: ['Photon map', 'Same IOR as glass', 'Draggable light', 'Pause · speed'],
  },
  {
    id: 'stitch',
    group: 'optics',
    num: 'O3',
    title: 'Glass Stitch',
    description: 'Four glass fragments float apart, align and meet along complementary edges; bridges form at contact until they are one continuous panel.',
    hint: 'Loops every 6.4 s · determinate mode in focus',
    detail:
      'The fragments are the exact quadrants of the finished rounded square (a generous outer corner, small corners at the seams), so seated they tile with no cracks or overlap. They render as one smooth-union layer: as a gap closes, the fused distance field grows a narrow optical bridge across it, and at completion refraction, highlights and shadow come from a single surface: no seams are hidden under drawn rectangles. Order: top pair, bottom pair, then the halves.',
    Component: GlassStitch,
    stores: [],
    capabilities: ['Per-corner SDF', 'Smooth union', 'Determinate mode', 'Pause · speed'],
  },
];
