import { describe, it, expect } from 'vitest';
import { createRng } from '../prng.ts';

describe('createRng', () => {
  it('is deterministic with same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const vals = Array.from({ length: 10 }, () => a.next());
    const vals2 = Array.from({ length: 10 }, () => b.next());
    expect(vals).not.toEqual(vals2);
  });

  it('next() returns values in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(max) returns values in [0, max)', () => {
    const rng = createRng(456);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('shuffle is a permutation', () => {
    const rng = createRng(789);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const original = [...arr];
    rng.shuffle(arr);
    expect(arr.sort((a, b) => a - b)).toEqual(original);
  });

  it('shuffle is deterministic', () => {
    const a = createRng(99);
    const b = createRng(99);
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];
    a.shuffle(arr1);
    b.shuffle(arr2);
    expect(arr1).toEqual(arr2);
  });

  it('choice picks from array', () => {
    const rng = createRng(42);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.choice(items));
    }
  });
});
