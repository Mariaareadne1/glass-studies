import { LOADERS } from './loaders';
import { OPTICS } from './optics';
import { STUDIES } from './studies';
import type { StudyDef, StudyGroup } from './studies';

export const ALL_STUDIES: StudyDef[] = [...STUDIES, ...LOADERS, ...OPTICS];

export interface GroupDef {
  id: StudyGroup;
  eyebrow: string;
  title: string;
  lede: string;
}

export const GROUPS: GroupDef[] = [
  {
    id: 'originals',
    eyebrow: 'The first six',
    title: 'Weather Instruments',
    lede: 'The original collection: switches, selectors, a dial, a slider and a card, each with its own way of moving.',
  },
  {
    id: 'controls',
    eyebrow: 'Interactive controls',
    title: 'Controls',
    lede: 'Precision instruments in pearl glass. Each one sets a real value you can read back, by pointer, touch or keyboard.',
  },
  {
    id: 'loaders',
    eyebrow: 'Waiting, honestly',
    title: 'Loaders',
    lede: 'Indeterminate loops never show a number. Determinate ones follow a supplied fraction, and two of them do real work in your browser: a camera capture and an audio render.',
  },
  {
    id: 'optics',
    eyebrow: 'Light and material',
    title: 'Optics & Materials',
    lede: 'Studies of what the glass does to light: magnification, focused caustics, and separate surfaces fusing into one.',
  },
];

export const studiesIn = (g: StudyGroup): StudyDef[] => ALL_STUDIES.filter((s) => s.group === g);
