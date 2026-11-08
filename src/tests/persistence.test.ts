import { beforeEach, describe, expect, test } from 'vitest';
import { clampNumber, createStore, oneOf } from '../state/persistence';

beforeEach(() => localStorage.clear());

describe('persistent store', () => {
  test('falls back to defaults for invalid or outdated stored values', () => {
    localStorage.setItem('glass-studies:v1:x', JSON.stringify('purple'));
    const s = createStore('x', 'sun', oneOf(['sun', 'rain'] as const));
    expect(s.get()).toBe('sun');
    localStorage.setItem('glass-studies:v1:y', '{not json');
    expect(createStore('y', 5, clampNumber(0, 10)).get()).toBe(5);
  });

  test('clamps, persists, notifies and resets', () => {
    const s = createStore('z', 50, clampNumber(0, 100));
    let calls = 0;
    s.subscribe(() => calls++);
    s.set(140);
    expect(s.get()).toBe(100);
    expect(JSON.parse(localStorage.getItem('glass-studies:v1:z') ?? 'null')).toBe(100);
    expect(createStore('z', 50, clampNumber(0, 100)).get()).toBe(100);
    s.reset();
    expect(s.get()).toBe(50);
    expect(calls).toBe(2);
  });

  test('ignores invalid writes', () => {
    const s = createStore('w', 'sun', oneOf(['sun', 'rain'] as const));
    s.set('hail' as 'sun');
    expect(s.get()).toBe('sun');
  });
});
