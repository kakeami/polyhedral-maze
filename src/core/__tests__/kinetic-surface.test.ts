import { describe, it, expect } from 'vitest';
import { buildSurface, buildSurfaceByState, type KineticSurface } from '../kinetic/surface.ts';
import { decomposeByPlacement } from '../kinetic/placement-pairs.ts';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { createJoinedPair } from '../kinetic/mechanisms/joined.ts';
import { createInfinityCube } from '../kinetic/mechanisms/infinity-cube.ts';
import type { Mechanism } from '../kinetic/types.ts';
import { IDENTITY } from '../kinetic/types.ts';

/**
 * A surface can be built two ways — a state at a time, or out of pairs of
 * pieces and the placements they take relative to one another — and the second
 * is the one every mechanism that never folds shut now gets. They have to
 * agree on everything, and on two things in particular that no state ever
 * touches: the numbering of the side classes, and the *order* of
 * `internalEdges`, which `generateKineticMaze` shuffles with the seeded rng
 * and which therefore helps name the maze.
 */
function expectSameSurface(want: KineticSurface, got: KineticSurface): void {
  expect(got.cellCount).toBe(want.cellCount);
  expect(got.stateCount).toBe(want.stateCount);
  expect(got.sideCount).toBe(want.sideCount);
  expect(got.classCount).toBe(want.classCount);
  expect(got.hidesCells).toBe(want.hidesCells);
  expect([...got.classOf]).toEqual([...want.classOf]);
  expect(got.classKind).toEqual(want.classKind);
  expect(got.classSides.map(s => [...s])).toEqual(want.classSides.map(s => [...s]));
  expect([...got.cutClasses]).toEqual([...want.cutClasses]);
  expect([...got.alwaysVisible]).toEqual([...want.alwaysVisible]);
  expect([...got.visibleCount]).toEqual([...want.visibleCount]);
  expect(got.internalEdges.map(e => `${e.a}-${e.b}#${e.classId}`)).toEqual(
    want.internalEdges.map(e => `${e.a}-${e.b}#${e.classId}`),
  );

  const keys = (adj: readonly { a: number; b: number; classId: number; intra: boolean }[]): string[] =>
    adj
      .map(e => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}#${e.classId}${e.intra ? 'i' : 'x'}`)
      .sort();
  for (let s = 0; s < want.stateCount; s++) {
    expect(keys(got.adjByState[s]!)).toEqual(keys(want.adjByState[s]!));
    expect([...got.visibleByState[s]!]).toEqual([...want.visibleByState[s]!]);
  }
}

function surfacesOf(mech: Mechanism): [KineticSurface, KineticSurface] {
  const limit = { maxStates: mech.states.length };
  return [buildSurfaceByState(mech, limit), buildSurface(mech, limit)];
}

describe('the two ways of building a surface', () => {
  it('agree on a stack of rings', () => {
    const [want, got] = surfacesOf(createStack({ sides: 6, layers: 4, cols: 3, rows: 3 }));
    expectSameSurface(want, got);
  });

  it('agree on a stack whose faces are not square', () => {
    const [want, got] = surfacesOf(createStack({ sides: 5, layers: 3, cols: 2, rows: 3 }));
    expectSameSurface(want, got);
  });

  it('agree on two solids glued at a face', () => {
    const [want, got] = surfacesOf(createJoinedPair({ shape: 'j3', gon: 6, n: 4 }));
    expectSameSurface(want, got);
  });

  it('agree on a joint whose halves are pyramids', () => {
    const [want, got] = surfacesOf(createJoinedPair({ shape: 'j1', gon: 4, n: 3 }));
    expectSameSurface(want, got);
  });

  it('agree on the folding ring of cubes, which is built the old way', () => {
    const [want, got] = surfacesOf(createInfinityCube({ cells: 2 }));
    expectSameSurface(want, got);
    expect(got.hidesCells).toBe(true);
  });
});

describe('which way a mechanism is built', () => {
  it('reads the pieces in pairs when nothing is ever buried', () => {
    const mech = createStack({ sides: 6, layers: 3, cols: 2, rows: 2 });
    expect(decomposeByPlacement(mech, sideStarts(mech))).not.toBeNull();
  });

  it('refuses the pairs when a cell is buried in some state', () => {
    // The ring of cubes presses two faces together when it shuts, and from
    // there on which side a side is paired with depends on the whole state.
    const mech = createInfinityCube({ cells: 2 });
    expect(decomposeByPlacement(mech, sideStarts(mech))).toBeNull();
  });

  it('refuses the pairs when three pieces meet along one segment', () => {
    // Three unit squares sharing an edge: a side of each lies on the other
    // two, so no pair of pieces decides what happens there.
    const square = (piece: number, corners: [number, number, number][]): Mechanism['cells'][number] => ({
      piece,
      corners,
    });
    const mech: Mechanism = {
      id: 'three-at-an-edge',
      pieceCount: 3,
      cells: [
        square(0, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]),
        square(1, [[0, 0, 0], [1, 0, 0], [1, -1, 0], [0, -1, 0]]),
        square(2, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]),
      ],
      states: [[
        { rot: IDENTITY, offset: [0, 0, 0] },
        { rot: IDENTITY, offset: [0, 0, 0] },
        { rot: IDENTITY, offset: [0, 0, 0] },
      ]],
      stateLabel: () => 'flat',
    };
    expect(decomposeByPlacement(mech, sideStarts(mech))).toBeNull();
  });
});

function sideStarts(mech: Mechanism): Int32Array {
  const start = new Int32Array(mech.cells.length + 1);
  for (let i = 0; i < mech.cells.length; i++) {
    start[i + 1] = start[i]! + mech.cells[i]!.corners.length;
  }
  return start;
}
