import { describe, it, expect } from 'vitest';
import { add, sub, scale, dot, cross, norm, normalize, allClose, mean, lstsq2 } from '../vec3.ts';
import type { Vec3 } from '../types.ts';

describe('vec3', () => {
  it('add', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });

  it('sub', () => {
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
  });

  it('scale', () => {
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it('dot', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('cross', () => {
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(cross([0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1]);
  });

  it('norm', () => {
    expect(norm([3, 4, 0])).toBe(5);
    expect(norm([0, 0, 0])).toBe(0);
  });

  it('normalize', () => {
    const n = normalize([3, 0, 0]);
    expect(n[0]).toBeCloseTo(1);
    expect(n[1]).toBeCloseTo(0);
    expect(n[2]).toBeCloseTo(0);
  });

  it('normalize zero vector', () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('allClose', () => {
    expect(allClose([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(allClose([1, 2, 3], [1, 2, 3.1])).toBe(false);
    expect(allClose([1, 2, 3], [1, 2, 3.001], 0.01)).toBe(true);
  });

  it('mean', () => {
    const m = mean([[0, 0, 0], [2, 4, 6]]);
    expect(m).toEqual([1, 2, 3]);
  });

  it('lstsq2 projects correctly', () => {
    const u: Vec3 = [1, 0, 0];
    const v: Vec3 = [0, 1, 0];
    const p: Vec3 = [3, 4, 0];
    const [a, b] = lstsq2(u, v, p);
    expect(a).toBeCloseTo(3);
    expect(b).toBeCloseTo(4);
  });

  it('lstsq2 non-orthogonal basis', () => {
    const u: Vec3 = [1, 1, 0];
    const v: Vec3 = [0, 1, 0];
    // p = 1*u + 1*v = (1, 2, 0)
    const p: Vec3 = [1, 2, 0];
    const [a, b] = lstsq2(u, v, p);
    expect(a).toBeCloseTo(1);
    expect(b).toBeCloseTo(1);
  });
});
