/**
 * The mazes the folding page ships with, and the little codec that keeps them.
 *
 * The second half of this file is the one that earns its keep: it takes every
 * stored design, decodes it against a surface built here and now, and asks the
 * geometry whether it really is a perfect maze in every shape its object shuts
 * into. A stored design is a set of numbers that mean whatever the surface
 * says they mean, so anything that changes how a surface is built would
 * quietly turn these into nonsense. This is what refuses to let that happen
 * quietly — for every object, because a cache entry filed under the wrong one
 * would be caught by nothing else.
 */
import { describe, it, expect } from 'vitest';
import { decodeOpenClasses, encodeOpenClasses } from '../kinetic/stored-design.ts';
import {
  CUBE_RING_DESIGNS, cubeRingDesigns,
} from '../kinetic/mechanisms/cube-ring-designs.ts';
import { createCubeRing } from '../kinetic/mechanisms/cube-ring.ts';
import {
  CUBE_RING_OBJECTS, cubeRingRulings,
} from '../kinetic/mechanisms/cube-ring-objects.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { stateStats } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { UnionFind } from '../graph.ts';

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
      const back = decodeOpenClasses({ cells: 0, seed: 0, classCount, open: text });
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
  it('offers a few at every ruling of every object', () => {
    let counted = 0;
    for (const object of CUBE_RING_OBJECTS) {
      const rulings = cubeRingRulings(object);
      expect(rulings.length).toBeGreaterThanOrEqual(2);
      for (const cells of rulings) {
        const designs = cubeRingDesigns(object.id, cells);
        expect(designs.length).toBeGreaterThanOrEqual(2);
        counted += designs.length;
      }
    }
    // Nothing filed under an object that is not on offer: a design nobody can
    // ask for is a design nothing checks.
    expect(CUBE_RING_DESIGNS.length).toBe(counted);
  });

  for (const object of CUBE_RING_OBJECTS) for (const cells of cubeRingRulings(object)) {
    it(`is a perfect maze in every pose of the ${object.id} at ${cells} cells`, () => {
      const mech = createCubeRing(object, { cells });
      const surface = buildSurface(mech, { maxStates: mech.states.length });
      const designs = cubeRingDesigns(object.id, cells);
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

  // A face no pose shows is still printed, and still seen mid-fold. Its grid
  // lines are walls like any other, and a design draws one tree across each
  // such face rather than leaving it ruled solid — which is what it did when
  // those lines were taken for rim, one class a side.
  for (const id of ['diamond-ring', 'frame-loop']) {
    it(`draws a tree across every face the ${id} never shows`, () => {
      const object = CUBE_RING_OBJECTS.find(o => o.id === id)!;
      const cells = cubeRingRulings(object)[1]!;
      const mech = createCubeRing(object, { cells });
      const surface = buildSurface(mech, { maxStates: mech.states.length });
      const shown = new Uint8Array(surface.cellCount);
      for (let state = 0; state < surface.stateCount; state++) {
        surface.visibleOfState(state).forEach((bit, cell) => { if (bit) shown[cell] = 1; });
      }
      const hidden = [...shown.keys()].filter(cell => !shown[cell]);
      expect(hidden.length).toBe(8 * cells * cells);
      for (const cell of hidden) {
        for (let side = surface.sideStart[cell]!; side < surface.sideStart[cell + 1]!; side++) {
          expect(surface.classKind[surface.classOf[side]!]).not.toBe('rim');
        }
      }
      for (const stored of cubeRingDesigns(id, cells)) {
        const open = decodeOpenClasses(stored);
        const faces = new UnionFind<number>();
        const tree = new UnionFind<number>();
        let openWalls = 0;
        for (const e of surface.internalEdges) {
          if (shown[e.a]) continue;
          faces.union(e.a, e.b);
          if (!open.has(e.classId)) continue;
          expect(tree.connected(e.a, e.b)).toBe(false);
          tree.union(e.a, e.b);
          openWalls++;
        }
        const faceCount = new Set(hidden.map(cell => faces.find(cell))).size;
        expect(faceCount).toBe(8);
        expect(openWalls).toBe(hidden.length - faceCount);
      }
    });
  }
});
