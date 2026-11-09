import { createContext } from 'react';

/**
 * True while the stages under this provider are hidden behind something
 * (the focused view covers the gallery). Suspended stages release their GPU
 * context, so the number of live WebGL contexts stays well under the
 * browser's limit however many studies the collection holds.
 */
export const StageSuspendContext = createContext(false);
