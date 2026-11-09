import { createContext, useContext } from 'react';

/** Where a study is being shown: a gallery card stays editorial, the focused view adds its full controls. */
export type Presentation = 'card' | 'focus';

export const PresentationContext = createContext<Presentation>('card');

export const useIsFocused = (): boolean => useContext(PresentationContext) === 'focus';
