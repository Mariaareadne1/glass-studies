import { AssemblyLoaderStage, CrystalLoaderStage, MergeLoaderStage, OrbitLoaderStage, TideLoaderStage } from '../components/loaders/LoaderStages';
import { MagneticBeads } from '../components/loaders/MagneticBeads';
import { ApertureCapture } from '../components/loaders/capture/ApertureCapture';
import { AudioRender } from '../components/loaders/audio/AudioRender';
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
    id: 'loader-tide',
    group: 'loaders',
    num: 'L2',
    title: 'Tide Fill',
    description: 'A slender glass vessel fills with clear pale water. Determinate mode fills it by volume to the supplied fraction; the surface sloshes and settles.',
    hint: 'Indeterminate tide · determinate mode in focus',
    detail:
      'Determinate mode maps the fraction to VOLUME, not height, through the vessel’s rounded caps (so 1% rises further than 1% of the height). The surface is a 24-column damped wave integrated at a fixed 1/240 s step; its mean is removed every step, so waves never change the amount shown, and it is bounded so any jump stays calm. At 100% the vessel is full and still, one bubble rises and a check appears. Indeterminate mode is a soft tide with no number.',
    Component: TideLoaderStage,
    stores: [],
    capabilities: ['Volume-true level', 'Damped 1D surface', 'Determinate mode', 'Pause · speed'],
  },
  {
    id: 'loader-morph',
    group: 'loaders',
    num: 'L3',
    title: 'Pixel Assembly',
    description: 'Luminous squares gather into a sun, a cloud, a leaf and a moon, dissolve and reassemble inside a glass tile.',
    hint: 'Loops every 6.4 s · determinate mode in focus',
    detail: 'Every square keeps its identity: shared squares are matched by approximate minimum distance, surplus squares fly out and new ones split from a neighbour, and an interrupted morph continues from where the squares are. Determinate mode assembles a chosen icon from a seeded scatter in exact proportion to the supplied fraction, and 100% is the authored bitmap, pixel for pixel. With reduced motion the icons change in place.',
    capabilities: ['Particle identity', 'Deterministic', 'Determinate mode', 'Pause · speed'],
    Component: AssemblyLoaderStage,
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
  {
    id: 'capture',
    group: 'loaders',
    num: 'L5',
    title: 'Aperture Capture',
    description: 'A glass camera aperture that does real work: preview your camera, capture a frame, process it, and download the result.',
    hint: 'Start camera (asks permission) or upload a photo',
    detail:
      'The camera starts only when you press Start camera, stops when you leave or hide the page, and nothing is uploaded: frames are drawn into a canvas, filtered locally in row chunks and encoded as a PNG you can download. The ring of light on the housing is the pipeline’s measured progress (rows processed), not a timer. Without a camera, an uploaded photo (EXIF orientation honoured where supported) runs through the same pipeline. The blades are the Iris Dial’s.',
    Component: ApertureCapture,
    stores: [],
    capabilities: ['Real camera', 'Local processing', 'Measured progress', 'PNG download'],
  },
  {
    id: 'audio',
    group: 'loaders',
    num: 'L6',
    title: 'Audio Render',
    description: 'A glass waveform that resolves as a sound is actually synthesised in your browser; then play it, scrub it and download the WAV.',
    hint: 'Pick a sound and a length · Render',
    detail:
      'Each preset is a Web Audio graph rendered by an OfflineAudioContext at 44.1 kHz. Progress is measured by suspending the render at eight points of its timeline; it resolves only when the render does. The samples are normalised to −1 dBFS (never clipping), encoded as 16-bit PCM WAV, and the waveform you see is the peak and RMS of those samples. Changing the sound or length discards the old render.',
    Component: AudioRender,
    stores: [],
    capabilities: ['OfflineAudioContext', 'Measured progress', 'WAV export', 'Real waveform'],
  },
  {
    id: 'loader-orbit',
    group: 'loaders',
    num: 'L7',
    title: 'Orbit',
    description: 'A glass bead laps a central lens, quickening and easing once per lap and leaving a comet of light behind it.',
    hint: 'Loops every 1.8 s',
    detail: 'The angle adds a single sine to a steady lap, so the bead surges and relaxes without ever stopping, and the loop closes exactly. The lens rim lights where the bead passes, using the same perimeter coordinate as the edge light. With reduced motion the bead rests at the top.',
    Component: OrbitLoaderStage,
    stores: [],
    capabilities: ['Seamless loop', 'Rests off screen', 'Pause · speed'],
  },
  {
    id: 'loader-crystal',
    group: 'loaders',
    num: 'L8',
    title: 'Crystallize',
    description: 'Frost grows ring by ring into an LED snow crystal, sparkles, then melts and falls away; the glass fogs and clears with it.',
    hint: 'Loops every 2.8 s',
    detail: 'Cells appear in order of distance from the centre with a little jitter, hold while a few catch the light, then melt from the outside in and fall. The tile’s frost follows the crystal, so the glass itself seems to freeze. With reduced motion the crystal stays and gently brightens.',
    Component: CrystalLoaderStage,
    stores: [],
    capabilities: ['Seamless loop', 'Rests off screen', 'Pause · speed'],
  },
];
