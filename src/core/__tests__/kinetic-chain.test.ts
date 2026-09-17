import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { createJoinedPair } from '../kinetic/mechanisms/joined.ts';
import { createInfinityCube } from '../kinetic/mechanisms/infinity-cube.ts';
import { buildSurface } from '../kinetic/surface.ts';
import type { KineticSurface } from '../kinetic/surface.ts';
import { chainOf } from '../kinetic/chain.ts';
import { chainBlocks, chainScore } from '../kinetic/chain-cost.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { expandCutClasses } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';

/** Block of each cell under the open internal classes, named by a root cell. */
function blockRootsOf(surface: KineticSurface, open: ReadonlySet<number>): Int32Array {
  const parent = new Int32Array(surface.cellCount);
  for (let cell = 0; cell < surface.cellCount; cell++) parent[cell] = cell;
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root] = parent[parent[root]!]!;
    return root;
  };
  for (const e of surface.internalEdges) {
    if (!open.has(e.classId)) continue;
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) parent[ra] = rb;
  }
  const out = new Int32Array(surface.cellCount);
  for (let cell = 0; cell < surface.cellCount; cell++) out[cell] = find(cell);
  return out;
}

/** What the walk replaces: every state, one at a time, over the blocks. */
function oneAtATime(surface: KineticSurface, open: ReadonlySet<number>, blockRoot: Int32Array) {
  const roots = new Set<number>();
  for (let cell = 0; cell < surface.cellCount; cell++) roots.add(blockRoot[cell]!);
  let cost = 0;
  let perfect = 0;
  for (let s = 0; s < surface.stateCount; s++) {
    const parent = new Map<number, number>();
    const find = (x: number): number => {
      let root = x;
      while ((parent.get(root) ?? root) !== root) root = parent.get(root)!;
      return root;
    };
    let components = roots.size;
    let cycles = 0;
    for (const e of surface.adjByState[s]!) {
      if (surface.classKind[e.classId] !== 'cut' || !open.has(e.classId)) continue;
      const ra = find(blockRoot[e.a]!);
      const rb = find(blockRoot[e.b]!);
      if (ra === rb) cycles++;
      else {
        parent.set(ra, rb);
        components--;
      }
    }
    const own = components - 1 + cycles;
    cost += own;
    if (own === 0) perfect++;
  }
  return { cost, perfect };
}

describe('a turning mechanism as a line of pieces', () => {
  it('finds the line, and one turn per seam', () => {
    const stack = buildSurface(createStack({ sides: 6, layers: 4, cols: 3, rows: 3 }));
    const chain = chainOf(stack);
    expect(chain).not.toBeNull();
    expect(chain!.pieceOrder).toEqual([0, 1, 2, 3]);
    expect(chain!.seams.map(s => s.byTurn.length)).toEqual([6, 6, 6]);
    // Every combination of turns is a state and every state a combination.
    expect(chain!.seams.reduce((n, s) => n * s.byTurn.length, 1)).toBe(stack.stateCount);
    expect(chain!.stateOfTurns([0, 0, 0])).toBeGreaterThanOrEqual(0);
  });

  it('sees a glued pair as two pieces and one seam', () => {
    const pair = buildSurface(createJoinedPair({ shape: 'j3', gon: 6, n: 2 }));
    const chain = chainOf(pair);
    expect(chain).not.toBeNull();
    expect(chain!.pieceOrder).toHaveLength(2);
    expect(chain!.seams).toHaveLength(1);
    expect(chain!.seams[0]!.byTurn).toHaveLength(6);
  });

  it('says no to a mechanism that folds shut on itself', () => {
    // The folding ring buries cells, so the blocks a design cuts a face into
    // are not the same in every pose and the whole reduction is false there.
    const fold = buildSurface(createInfinityCube({ cells: 2 }));
    expect(fold.hidesCells).toBe(true);
    expect(chainOf(fold)).toBeNull();
  });
});

describe('scoring every state by walking the line once', () => {
  const cases: [string, () => KineticSurface][] = [
    ['stack 6x4', () => buildSurface(createStack({ sides: 6, layers: 4, cols: 3, rows: 3 }))],
    ['stack 8x3', () => buildSurface(createStack({ sides: 8, layers: 3, cols: 2, rows: 2 }))],
    ['pair j3@6', () => buildSurface(createJoinedPair({ shape: 'j3', gon: 6, n: 3 }))],
  ];

  for (const [label, make] of cases) {
    it(`agrees with counting the states one at a time: ${label}`, () => {
      const surface = make();
      const chain = chainOf(surface);
      expect(chain).not.toBeNull();
      const rng = createRng(4242);
      // Designs with no structure at all, because a search only ever offers
      // nearly-right ones and a disagreement would hide in those.
      for (let trial = 0; trial < 8; trial++) {
        const open = new Set<number>();
        const chance = 0.3 + 0.5 * rng.next();
        for (let c = 0; c < surface.classCount; c++) if (rng.next() < chance) open.add(c);
        const blockRoot = blockRootsOf(surface, open);
        const blocks = chainBlocks(
          chain!,
          cell => surface.mechanism.cells[cell]!.piece,
          surface.cellCount,
          blockRoot,
        );
        const walk = chainScore(chain!, blocks, classId => open.has(classId));
        const want = oneAtATime(surface, open, blockRoot);
        expect(walk.cost).toBe(want.cost);
        expect(walk.perfect).toBe(want.perfect);
        expect(walk.witness >= 0).toBe(want.perfect < surface.stateCount);
      }
    });
  }

  it('scores a maze that survives every turn at zero, and names no witness', () => {
    const surface = buildSurface(createStack({ sides: 6, layers: 4, cols: 3, rows: 3 }));
    const chain = chainOf(surface)!;
    const rng = createRng(11);
    const openCutClasses = expandCutClasses(surface, { rng, extra: 0 });
    const found = contractedSearch(surface, { rng, openCutClasses, maxRounds: 48 });
    expect(found.rate.rate).toBe(1);
    const blocks = chainBlocks(
      chain,
      cell => surface.mechanism.cells[cell]!.piece,
      surface.cellCount,
      blockRootsOf(surface, found.design.open),
    );
    const walk = chainScore(chain, blocks, classId => found.design.open.has(classId));
    expect(walk.cost).toBe(0);
    expect(walk.perfect).toBe(surface.stateCount);
    expect(walk.witness).toBe(-1);
  }, 30000);
});
