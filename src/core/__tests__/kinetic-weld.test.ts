import { describe, it, expect } from 'vitest';
import { VertexWelder } from '../kinetic/weld.ts';

describe('VertexWelder', () => {
  it('gives one id per distinct point', () => {
    const w = new VertexWelder();
    expect(w.id([0, 0, 0])).toBe(0);
    expect(w.id([1, 0, 0])).toBe(1);
    expect(w.id([0, 0, 0])).toBe(0);
    expect(w.count).toBe(2);
  });

  it('merges points inside the tolerance', () => {
    const w = new VertexWelder(1e-6);
    const a = w.id([1, 2, 3]);
    expect(w.id([1 + 1e-9, 2 - 1e-9, 3])).toBe(a);
    expect(w.count).toBe(1);
  });

  it('merges across a bucket boundary', () => {
    // Two points a hair apart but on opposite sides of a bucket edge: a plain
    // rounded key would split them, which would silently break adjacency.
    const eps = 1e-6;
    const w = new VertexWelder(eps);
    const onBoundary = 5 * eps;
    const a = w.id([onBoundary - 1e-12, 0, 0]);
    const b = w.id([onBoundary + 1e-12, 0, 0]);
    expect(b).toBe(a);
    expect(w.count).toBe(1);
  });

  it('keeps points further apart than the tolerance separate', () => {
    const w = new VertexWelder(1e-6);
    const a = w.id([0, 0, 0]);
    const b = w.id([1e-4, 0, 0]);
    expect(b).not.toBe(a);
  });
});
