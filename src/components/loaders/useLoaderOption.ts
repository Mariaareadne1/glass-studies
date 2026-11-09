import { useSyncExternalStore } from 'react';
import type { LoopController } from './loopController';

/**
 * Reads a loader option through the loader's own change notifications and
 * returns a setter that writes to the controller (the controller is the single
 * source of truth; the UI never keeps a copy that could drift).
 */
export function useLoaderOption<T>(ctrl: LoopController, read: () => T, write: (v: T) => void): [T, (v: T) => void] {
  const value = useSyncExternalStore((l) => ctrl.subscribe(l), read);
  return [value, (v: T) => {
    write(v);
    ctrl.notify();
  }];
}
