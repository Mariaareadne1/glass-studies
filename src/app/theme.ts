import { useEffect } from 'react';
import { createStore, oneOf, useStore } from '../state/persistence';

export type Theme = 'light' | 'dark';

const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
export const themeStore = createStore<Theme>('theme', systemDark ? 'dark' : 'light', oneOf(['light', 'dark'] as const));

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useStore(themeStore);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0f17' : '#f3f1ee');
  }, [theme]);
  return [theme, themeStore.set];
}
