import type { ComponentType } from 'react';
import type { EnvironmentKind } from '../glass/types';
import { SolarToggle } from '../components/controls/SolarToggle/SolarToggle';
import { solarStore } from '../state/controls';

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
];
