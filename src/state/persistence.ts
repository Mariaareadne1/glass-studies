import { useSyncExternalStore } from 'react';

const PREFIX = 'glass-studies:v1:';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  reset(): void;
  subscribe(l: () => void): () => void;
  readonly defaults: T;
}

function safeRead(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode / quota) – state still works in memory
  }
}

/**
 * A tiny external store persisted to localStorage. Stored values pass
 * through `validate`; anything invalid or from an older shape falls back to
 * the defaults instead of breaking a control.
 */
export function createStore<T>(key: string, defaults: T, validate: (raw: unknown) => T | null): Store<T> {
  let value: T = defaults;
  if (typeof window !== 'undefined') {
    const stored = safeRead(key);
    if (stored !== undefined) value = validate(stored) ?? defaults;
  }
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    defaults,
    get: () => value,
    set(next) {
      const v = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      const checked = validate(v);
      if (checked === null || Object.is(checked, value)) return;
      value = checked;
      safeWrite(key, value);
      emit();
    },
    reset() {
      value = defaults;
      safeWrite(key, value);
      emit();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const clampNumber = (min: number, max: number) => (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : null;

export const oneOf = <T extends string>(options: readonly T[]) => (raw: unknown): T | null =>
  typeof raw === 'string' && (options as readonly string[]).includes(raw) ? (raw as T) : null;

export const bool = (raw: unknown): boolean | null => (typeof raw === 'boolean' ? raw : null);
