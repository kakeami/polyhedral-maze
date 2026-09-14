/**
 * The mazes the folding page ships with, and the little codec that keeps them.
 *
 * The second half of this file is the one that earns its keep: it takes every
 * stored design, decodes it against a surface built here and now, and asks the
 * geometry whether it really is a perfect maze in all six poses. A stored
 * design is a set of numbers that mean whatever the surface says they mean, so
 * anything that changes how a surface is built would quietly turn these into
 * nonsense. This is what refuses to let that happen quietly.
 */
import { describe, it, expect } from 'vitest';
import { decodeOpenClasses, encodeOpenClasses } from '../kinetic/stored-design.ts';
import {
  INFINITY_CUBE_DESIGNS, INFINITY_CUBE_RULINGS, infinityCubeDesigns,
} from '../kinetic/mechanisms/infinity-cube-designs.ts';
import { createInfinityCube } from '../kinetic/mechanisms/infinity-cube.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { stateStats } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';

describe('writing a design down', () => {
  it('comes back the same, at any size', () => {
    const rng = createRng(7);
    // Sizes either side of where the packing lands awkwardly: bits that do not
    // fill a byte, bytes that do not fill three.
    for (const classCount of [1, 7, 8, 9, 23, 24, 25, 272, 696, 1312]) {
      const open = new Set<number>();
      for (let classId = 0; classId < classCount; classId++) {
        if (rng.next() < 0.4) open.add(classId);
      }
      const text = encodeOpenClasses(open, classCount);
      const back = decodeOpenClasses({ cells: 0, classCount, open: text });
      expect([...back].sort((a, b) => a - b)).toEqual([...open].sort((a, b) => a - b));
    }
  });

  it('refuses a class the surface does not have', () => {
    expect(() => encodeOpenClasses([12], 10)).toThrow(/outside a surface/);
  });

  it('is about a third of the size of the numbers it stands for', () => {
    const open = Array.from({ length: 348 }, (_, i) => i * 2);
    const text = encodeOpenClasses(open, 696);
    expect(text.length).toBeLessThan(open.join(',').length / 3);
  });
});

describe('the mazes the folding page ships with', () => {
  it('offers a few at each ruling', () => {
    expect(INFINITY_CUBE_RULINGS.length).toBeGreaterThanOrEqual(2);
    for (const cells of INFINITY_CUBE_RULINGS) {
      expect(infinityCubeDesigns(cells).length).toBeGreaterThanOrEqual(2);
    }
    expect(INFINITY_CUBE_DESIGNS.length).toBe(
      INFINITY_CUBE_RULINGS.reduce((n, cells) => n + infinityCubeDesigns(cells).length, 0),
    );
  });

  for (const cells of INFINITY_CUBE_RULINGS) {
    it(`is a perfect maze in every pose, at ${cells} cells across a face`, () => {
      const mech = createInfinityCube({ cells });
      const surface = buildSurface(mech, { maxStates: mech.states.length });
      const designs = infinityCubeDesigns(cells);
      for (const stored of designs) {
        expect(stored.classCount).toBe(surface.classCount);
        const open = decodeOpenClasses(stored);
        for (let state = 0; state < surface.stateCount; state++) {
          const stats = stateStats(surface, { open }, state);
          expect(stats.perfect).toBe(true);
          // One passage fewer than the cells on show — and that is a different
          // number in a cube and in a plank, which is the whole difficulty.
          expect(stats.edges).toBe(surface.visibleCount[state]! - 1);
        }
      }
      // Two designs that were the same maze would be a generator that had
      // stopped varying its seed.
      const shapes = new Set(designs.map(d => d.open));
      expect(shapes.size).toBe(designs.length);
    });
  }
});
