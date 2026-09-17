import { describe, it, expect } from 'vitest';
import {
  createJoinedPair,
  creaseAngle,
  joinedPairById,
  joinedPairCellCount,
  JOINED_PAIRS,
  DEFAULT_JOINED_PAIR,
} from '../kinetic/mechanisms/joined.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { buildKineticPieces, modelBounds } from '../../render/kinetic-geometry.ts';
import {
  searchAllStates, pickStartGoal, treeRate, stateStats, expandCutClasses,
} from '../kinetic/maze.ts';
import { contractedSearch, contractedSuits } from '../kinetic/maze-contracted.ts';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { createRng } from '../prng.ts';

const N = 3;
const mech = createJoinedPair({ shape: 'j3', gon: 6, n: N });
const surface = buildSurface(mech);
const gamma = searchAllStates(surface, { rng: createRng(20260914) });

/** Longest walk in the tree, in the given state. */
function diameter(stateIndex: number, open: ReadonlySet<number>): number {
  const adjacency: number[][] = Array.from({ length: surface.cellCount }, () => []);
  for (const edge of surface.adjByState[stateIndex]!) {
    if (!open.has(edge.classId)) continue;
    adjacency[edge.a]!.push(edge.b);
    adjacency[edge.b]!.push(edge.a);
  }
  const walk = (from: number): { far: number; distance: number } => {
    const seen = new Int32Array(surface.cellCount).fill(-1);
    seen[from] = 0;
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      for (const next of adjacency[queue[i]!]!) {
        if (seen[next] !== -1) continue;
        seen[next] = seen[queue[i]!]! + 1;
        queue.push(next);
      }
    }
    let far = from;
    for (let i = 0; i < seen.length; i++) if (seen[i]! > seen[far]!) far = i;
    return { far, distance: seen[far]! };
  };
  return walk(walk(0).far).distance;
}

describe('joined pair mechanism', () => {
  it('glues two copies of the solid, dropping the face they are glued at', () => {
    // A triangular cupola has 8 faces; the hexagon it is glued at is not printed.
    expect(mech.facesPerPiece).toBe(7);
    expect(mech.pieceCount).toBe(2);
    expect(mech.cells.length).toBe(126);
    expect(joinedPairCellCount({ shape: 'j3', gon: 6, n: N })).toBe(mech.cells.length);
    const perPiece = mech.cells.filter(c => c.piece === 0).length;
    expect(perPiece).toBe(mech.cells.length / 2);
  });

  it('turns the upper half only, one joint edge at a time', () => {
    expect(mech.states.length).toBe(6);
    expect(mech.step).toBe(60);
    expect(mech.stateLabel(0)).toBe('0°');
    expect(mech.stateLabel(3)).toBe('180°');
    for (const state of mech.states) {
      expect(state[0]!.rot).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    }
    expect(() => mech.stateLabel(6)).toThrow(/no such state/);
  });

  it('says which face and cell of the solid each cell came from', () => {
    const first = mech.cellSource(0);
    const last = mech.cellSource(mech.cells.length - 1);
    expect(first.piece).toBe(0);
    expect(last.piece).toBe(1);
    // The two halves are the same piece, so they list the same faces and cells.
    const half = mech.cells.length / 2;
    for (let i = 0; i < half; i++) {
      expect(mech.cellSource(i + half).faceId).toBe(mech.cellSource(i).faceId);
      expect(mech.cellSource(i + half).cell).toBe(mech.cellSource(i).cell);
    }
    expect(() => mech.cellSource(mech.cells.length)).toThrow(/no such cell/);
  });

  it('closes up: every side meets another, in every state', () => {
    // A rim class is a side that meets nothing. On a closed object there are
    // none, so any appearing here would mean the seam does not line up.
    expect(surface.classKind.filter(k => k === 'rim')).toHaveLength(0);
    expect(surface.cutClasses).toHaveLength(N);
    for (const id of surface.cutClasses) {
      expect(surface.classSides[id]!.length).toBe(2 * mech.gon);
    }
  });

  it('carries the same number of passages however it is turned', () => {
    const rate = treeRate(surface, gamma.design);
    expect(rate.edgeCountInvariant).toBe(true);
    expect(rate.passages).toBe(surface.cellCount - 1);
  });

  it('is a perfect maze in all six states', () => {
    expect(gamma.rate.perfect).toBe(surface.stateCount);
    for (let state = 0; state < surface.stateCount; state++) {
      const stats = stateStats(surface, gamma.design, state);
      expect(stats.perfect).toBe(true);
      expect(stats.components).toBe(1);
      expect(stats.cycles).toBe(0);
    }
  });

  it('is a different maze in each state, not one pattern turned onto itself', () => {
    const diameters = Array.from({ length: surface.stateCount }, (_, i) => diameter(i, gamma.design.open));
    expect(new Set(diameters).size).toBeGreaterThan(1);
  });

  it('gives the same design for the same seed', () => {
    const again = searchAllStates(surface, { rng: createRng(20260914) });
    expect([...again.design.open].sort((a, b) => a - b))
      .toEqual([...gamma.design.open].sort((a, b) => a - b));
  });

  it('puts the markers on dead ends even though the object has no rim', () => {
    const { start, goal } = pickStartGoal(surface, gamma.design);
    expect(start).not.toBe(goal);
    // Both are dead ends, and stay dead ends however the object is turned.
    for (let state = 0; state < surface.stateCount; state++) {
      const degree = new Int32Array(surface.cellCount);
      for (const edge of surface.adjByState[state]!) {
        if (!gamma.design.open.has(edge.classId)) continue;
        degree[edge.a]!++;
        degree[edge.b]!++;
      }
      expect(degree[start]).toBe(1);
      expect(degree[goal]).toBe(1);
    }
  });

  it('refuses a solid or a joint it cannot use', () => {
    expect(() => createJoinedPair({ shape: 'not-a-solid' })).toThrow(/no such shape/);
    expect(() => createJoinedPair({ shape: 'j3', gon: 5 })).toThrow(/no regular 5-gon/);
    expect(() => createJoinedPair({ shape: 'j3', gon: 6, jointIndex: 1 })).toThrow(/not 2/);
    expect(() => createJoinedPair({ shape: 'j3', gon: 6, n: 0 })).toThrow(/positive whole number/);
  });
});

describe('the crease the two halves make', () => {
  it('measures how far the seam opens, not the solid dihedral', () => {
    // Two triangular cupolas meet along the hexagon at 70.53 degrees, so the
    // seam is a ridge that opens through 360 - 2 * 70.53.
    expect(creaseAngle({ shape: 'j3', gon: 6 })).toBeCloseTo(218.94, 1);
    // Two octahedra on a triangle: a groove, but a wide one.
    expect(creaseAngle({ shape: 'octahedron', gon: 3 })).toBeCloseTo(141.06, 1);
    // Two cubes on a square leave no crease at all.
    expect(creaseAngle({ shape: 'cube', gon: 4 })).toBeCloseTo(180, 6);
    // A solid with many faces folds the seam shut, which is why they are out.
    expect(creaseAngle({ shape: 'truncated-icosahedron', gon: 5 })).toBeLessThan(90);
  });

  it('keeps every offered joint open enough to read a maze in', () => {
    for (const choice of JOINED_PAIRS) {
      expect(creaseAngle({ shape: choice.shape, gon: choice.gon })).toBeGreaterThanOrEqual(130);
    }
  });
});

describe('the joints on offer', () => {
  it('starts at the triangular cupolas', () => {
    expect(DEFAULT_JOINED_PAIR.id).toBe('j3@6');
    expect(joinedPairById('j3@6')).toBe(DEFAULT_JOINED_PAIR);
    expect(joinedPairById('nope')).toBeUndefined();
  });

  it('names a joint the solid actually has, and all of them build', () => {
    for (const choice of JOINED_PAIRS) {
      const built = createJoinedPair({ shape: choice.shape, gon: choice.gon, n: 2 });
      expect(built.gon).toBe(choice.gon);
      expect(built.states.length).toBe(choice.gon);
      expect(built.id).toBe(`pair-${choice.shape}-${choice.gon}`);
      const closed = buildSurface(built);
      expect(closed.classKind.filter(k => k === 'rim')).toHaveLength(0);
    }
  });

  it('is a perfect maze in every state, for every joint on offer', () => {
    for (const choice of JOINED_PAIRS) {
      const built = createJoinedPair({ shape: choice.shape, gon: choice.gon, n: 2 });
      const closed = buildSurface(built);
      const found = searchAllStates(closed, { rng: createRng(7) });
      expect(found.rate.perfect).toBe(closed.stateCount);
    }
  });

  it('still finds one at the finest ruling each joint claims', () => {
    // What `maxN` is for. It was arrived at with a larger sample of seeds than
    // a test suite should sit through; two is enough to catch a search that has
    // got worse, which is the thing that would make the number a lie.
    //
    // Searched the way the page searches it — contracted, since a pair is a
    // handful of states over hundreds of cells — because a ceiling measured
    // against one search says nothing about another. At these rulings the
    // cell-level search does not reach, which is why the numbers moved.
    for (const choice of JOINED_PAIRS) {
      const built = createJoinedPair({ shape: choice.shape, gon: choice.gon, n: choice.maxN });
      const closed = buildSurface(built);
      expect(contractedSuits(closed)).toBe(true);
      for (const seed of [42, 7]) {
        const rng = createRng(seed);
        const openCutClasses = expandCutClasses(closed, { rng, extra: 0 });
        const found = contractedSearch(closed, { rng, openCutClasses, maxRounds: 48 });
        expect(found.rate.perfect).toBe(closed.stateCount);
      }
    }
  }, 30000);
});

describe('which search a turning mechanism wants', () => {
  it('sends everything that turns to the contracted search', () => {
    // For a while the stack did not want it: the engine rescored every state
    // after every move, and a stack has hundreds where the folding ring has
    // six. It does not rescore them all any more — the chain walk scores every
    // state in one pass along the line of pieces — so what is left to ask is
    // only whether the contraction applies at all.
    const pair = buildSurface(createJoinedPair({ shape: 'j3', gon: 6, n: 4 }));
    expect(contractedSuits(pair)).toBe(true);
    for (const layers of [4, 5]) {
      const stack = buildSurface(createStack({ sides: 6, layers, cols: 3, rows: 3 }));
      expect(contractedSuits(stack)).toBe(true);
    }
  });

  it('leaves the seam openings exactly where the caller put them', () => {
    // `k` — how many passages cross a seam over the minimum — is the page's
    // difficulty control, so the search may not quietly choose its own. On the
    // folding ring it must; there the seam set is half the arrangement.
    const surface = buildSurface(createJoinedPair({ shape: 'j3', gon: 6, n: 3 }));
    for (const extra of [0, 2]) {
      const rng = createRng(11);
      const openCutClasses = expandCutClasses(surface, { rng, extra });
      const found = contractedSearch(surface, { rng, openCutClasses, maxRounds: 48 });
      expect([...found.design.openCutClasses].sort()).toEqual([...openCutClasses].sort());
      expect(found.rate.perfect).toBe(surface.stateCount);
    }
  });

  it('reaches a ruling the cell-level search does not', () => {
    // The measurement the new ceilings rest on, at one ruling and one seed.
    const surface = buildSurface(createJoinedPair({ shape: 'j3', gon: 6, n: 8 }));
    const rng = createRng(1000);
    const openCutClasses = expandCutClasses(surface, { rng, extra: 0 });
    const found = contractedSearch(surface, { rng, openCutClasses, maxRounds: 48 });
    expect(found.rate.perfect).toBe(surface.stateCount);
  }, 30000);
});

describe('the pair in the 3D view', () => {
  it('gives the scene one group per half, walls and no rim', () => {
    const pieces = buildKineticPieces(mech, surface, gamma.design, null, { axialGap: 0.08 });
    expect(pieces).toHaveLength(2);
    for (const piece of pieces) {
      expect(piece.walls.length).toBeGreaterThan(0);
      expect(piece.rim).toHaveLength(0);
    }
    // The gap opens at the joint: one half sits below it, the other above.
    expect(pieces[0]!.bounds.zMax).toBeLessThan(0);
    expect(pieces[1]!.bounds.zMin).toBeGreaterThan(0);
  });

  it('caps the open joint and leaves the closed end alone', () => {
    const bare = buildKineticPieces(mech, surface, gamma.design, null, { caps: false });
    const capped = buildKineticPieces(mech, surface, gamma.design, null, { caps: true });
    // One fan of triangles per half, around the joint ring: gon * n of them.
    // A second cap over the face at the far end would double this.
    const ring = mech.gon * mech.n;
    for (let piece = 0; piece < 2; piece++) {
      const added = capped[piece]!.positions.length - bare[piece]!.positions.length;
      expect(added).toBe(ring * 3 * 3);
    }
  });

  it('stands the object where the camera already looks', () => {
    const bounds = modelBounds(mech);
    expect(bounds.radius).toBeCloseTo(1, 6);
    expect(bounds.zMin).toBeCloseTo(-bounds.zMax, 6);
  });

  it('turns only the upper half, and names the state by its turn', () => {
    expect(mech.turnSteps).toBe(mech.gon);
    expect(mech.stateIndex([0, 0])).toBe(0);
    expect(mech.stateIndex([0, 2])).toBe(2);
    // Turning the whole object by hand is not a move.
    expect(mech.stateIndex([3, 2])).toBe(2);
    expect(mech.stateIndex([0, -1])).toBe(mech.gon - 1);
    expect(mech.stateIndex([0, mech.gon])).toBe(0);
  });
});
