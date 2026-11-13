/**
 * The contracted search rests on a claim about the object, not about the code:
 * that the only thing the walls inside a patch decide is how the patch is cut
 * into connected blocks. If that is ever false the search is not slower, it is
 * wrong — so it is the claim that is tested here, alongside the designs.
 */
import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { CUBE_RING_OBJECTS, createInfinityCube } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { createCubeRing, cubeRingShape } from '../kinetic/mechanisms/cube-ring.ts';
import {
  HALF_CUBE_RING_OBJECTS, STAR_CUBE, createHalfCubeRing,
} from '../kinetic/mechanisms/half-cube-ring.ts';
import type { Mechanism } from '../kinetic/types.ts';
import { buildSurface, type KineticSurface } from '../kinetic/surface.ts';
import { stateStats, treeRate, type KineticDesign } from '../kinetic/maze.ts';
import {
  contractedSearch, createContractedSearch, contractsCleanly, countsAreConsistent,
} from '../kinetic/maze-contracted.ts';
import { createRng } from '../prng.ts';

const ring = createInfinityCube({ cells: 2 });
const ringSurface = buildSurface(ring);

/**
 * One design, shared by the tests that are about its shape rather than about
 * the search finding it. A search is a second or two even on the smallest
 * ruling, and running one per assertion says nothing the first one did not.
 */
let shared: ReturnType<typeof contractedSearch> | null = null;
const found = (): ReturnType<typeof contractedSearch> => {
  // Any seed does now; 5 is kept from when the repair anneal needed a lucky
  // one on the ten states the ring has once its hooks count.
  shared ??= contractedSearch(ringSurface, { rng: createRng(5) });
  return shared;
};

/** Cells reachable from one another along internal classes, open or not. */
function patchesOf(surface: KineticSurface): number[][] {
  const near: number[][] = Array.from({ length: surface.cellCount }, () => []);
  for (const e of surface.internalEdges) {
    near[e.a]!.push(e.b);
    near[e.b]!.push(e.a);
  }
  const seen = new Int32Array(surface.cellCount).fill(-1);
  const out: number[][] = [];
  for (let cell = 0; cell < surface.cellCount; cell++) {
    if (seen[cell] !== -1) continue;
    const found = [cell];
    seen[cell] = out.length;
    for (let head = 0; head < found.length; head++) {
      for (const next of near[found[head]!]!) {
        if (seen[next] !== -1) continue;
        seen[next] = out.length;
        found.push(next);
      }
    }
    out.push(found);
  }
  return out;
}

/** The block each cell is in, under the open internal classes. */
function blocksOf(
  surface: KineticSurface,
  open: ReadonlySet<number>,
): { of: Int32Array; count: number } {
  const of = new Int32Array(surface.cellCount).fill(-1);
  const near: number[][] = Array.from({ length: surface.cellCount }, () => []);
  for (const e of surface.internalEdges) {
    if (!open.has(e.classId)) continue;
    near[e.a]!.push(e.b);
    near[e.b]!.push(e.a);
  }
  let count = 0;
  for (let cell = 0; cell < surface.cellCount; cell++) {
    if (of[cell] !== -1) continue;
    const root = cell;
    const queue = [cell];
    of[cell] = root;
    count++;
    for (let head = 0; head < queue.length; head++) {
      for (const next of near[queue[head]!]!) {
        if (of[next] !== -1) continue;
        of[next] = root;
        queue.push(next);
      }
    }
  }
  return { of, count };
}

/** Every object the folding page offers, ruled `cells` across a face. */
function offered(cells: number): { id: string; surface: KineticSurface }[] {
  const mechanisms: [string, Mechanism][] = [
    ...CUBE_RING_OBJECTS.map(o => [o.id, createCubeRing(o, { cells })] as [string, Mechanism]),
    ...HALF_CUBE_RING_OBJECTS.map(o => [o.id, createHalfCubeRing(o, { cells })] as [string, Mechanism]),
  ];
  return mechanisms.map(([id, mech]) => ({ id, surface: buildSurface(mech, { maxStates: mech.states.length }) }));
}

/** The star cube with its four hooks counted: ten shapes, which it does not offer. */
function starCubeWithHooks(cells: number): KineticSurface {
  const six = createHalfCubeRing(STAR_CUBE, { cells });
  const shape = cubeRingShape(STAR_CUBE.halves);
  const states = shape.poses.map(pose => shape.closures[pose.closure]!);
  expect(states).toHaveLength(10);
  const ten = { ...six, states, stateLabel: (i: number) => shape.poses[i]!.label };
  return buildSurface(ten, { maxStates: states.length });
}

describe('the contracted search', () => {
  it('finds patches that are on show whole or buried whole', () => {
    expect(contractsCleanly(ringSurface)).toBe(true);
    // 48 faces of four squares, and a face goes under against another cube.
    expect(patchesOf(ringSurface)).toHaveLength(48);
    expect(contractsCleanly(buildSurface(createStack({
      sides: 4, layers: 3, cols: 2, rows: 2,
    })))).toBe(true);
  });

  it('is a perfect maze in every pose of the folding ring', () => {
    expect(found().rate.rate).toBe(1);
    expect(found().exhausted).toBe(false);
    for (let state = 0; state < ringSurface.stateCount; state++) {
      const stats = stateStats(ringSurface, found().design, state);
      expect(stats.perfect).toBe(true);
      // One passage fewer than the cells on show, which is a different number
      // in a plank and in a cube.
      expect(stats.edges).toBe(ringSurface.visibleCount[state]! - 1);
    }
  });

  it('works on a mechanism that buries nothing', () => {
    const surface = buildSurface(createStack({ sides: 4, layers: 3, cols: 2, rows: 2 }));
    const onAStack = contractedSearch(surface, { rng: createRng(4) });
    expect(onAStack.rate.rate).toBe(1);
    for (let state = 0; state < surface.stateCount; state++) {
      expect(stateStats(surface, onAStack.design, state).perfect).toBe(true);
    }
  });

  it('gives the same design an attempt at a time as it does all at once', () => {
    // Both halves of one claim, and one search rather than two: a seed names a
    // design, and stepping the search is only a way of not blocking a page.
    const stepped = createContractedSearch(ringSurface, { rng: createRng(5) });
    let steps = 0;
    while (!stepped.step()) steps++;
    expect(stepped.progress.rounds).toBeGreaterThan(0);
    expect(steps).toBeLessThan(stepped.progress.maxRounds);
    expect(stepped.result().rate.rate).toBe(1);
    expect([...stepped.result().design.open].sort((x, y) => x - y))
      .toEqual([...found().design.open].sort((x, y) => x - y));
  });

  it('never opens a wall that crosses a patch, or closes a loop inside one', () => {
    const patch = new Int32Array(ringSurface.cellCount);
    patchesOf(ringSurface).forEach((cells, p) => {
      for (const cell of cells) patch[cell] = p;
    });
    let open = 0;
    const seen = new Set<string>();
    for (const e of ringSurface.internalEdges) {
      expect(patch[e.a]).toBe(patch[e.b]);
      if (!found().design.open.has(e.classId)) continue;
      open++;
      const key = `${Math.min(e.a, e.b)}:${Math.max(e.a, e.b)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // A forest inside every patch: as many open walls as cells minus blocks.
    const { count } = blocksOf(ringSurface, found().design.open);
    expect(open).toBe(ringSurface.cellCount - count);
  });

  it('is a tree in a pose exactly when the contracted graph is', () => {
    const { of } = blocksOf(ringSurface, found().design.open);
    for (let state = 0; state < ringSurface.stateCount; state++) {
      const visible = ringSurface.visibleOfState(state);
      const nodes = new Set<number>();
      for (let cell = 0; cell < ringSurface.cellCount; cell++) {
        if (visible[cell]) nodes.add(of[cell]!);
      }
      const parent = new Map<number, number>();
      const root = (x: number): number => {
        let r = x;
        while ((parent.get(r) ?? r) !== r) r = parent.get(r)!;
        return r;
      };
      let edges = 0;
      let cycles = 0;
      for (const e of ringSurface.adjOfState(state)) {
        if (!found().design.open.has(e.classId)) continue;
        if (ringSurface.classKind[e.classId] !== 'cut') continue;
        edges++;
        const ra = root(of[e.a]!);
        const rb = root(of[e.b]!);
        if (ra === rb) cycles++;
        else parent.set(ra, rb);
      }
      expect(cycles).toBe(0);
      expect(edges).toBe(nodes.size - 1);
    }
  });

  it('does not care which tree is drawn inside a block', () => {
    // The claim the whole reduction rests on. Re-tree every block at random —
    // a different maze, the same partition — and every pose is still perfect.
    const { of } = blocksOf(ringSurface, found().design.open);
    const rng = createRng(99);
    const fresh = new Set<number>(
      [...found().design.open].filter(c => ringSurface.classKind[c] !== 'internal'),
    );
    const parent = new Map<number, number>();
    const root = (x: number): number => {
      let r = x;
      while ((parent.get(r) ?? r) !== r) r = parent.get(r)!;
      return r;
    };
    const walls = [...ringSurface.internalEdges];
    rng.shuffle(walls);
    for (const e of walls) {
      if (of[e.a] !== of[e.b]) continue; // not one block: it was closed, keep it closed
      const ra = root(e.a);
      const rb = root(e.b);
      if (ra === rb) continue;
      parent.set(ra, rb);
      fresh.add(e.classId);
    }
    expect(fresh.size).toBe(found().design.open.size);
    const design: Pick<KineticDesign, 'open'> = { open: fresh };
    expect(treeRate(ringSurface, design).rate).toBe(1);
    // And it really is a different maze, not the same one back.
    expect([...fresh].sort((a, b) => a - b))
      .not.toEqual([...found().design.open].sort((a, b) => a - b));
  });

  it('solves the count equations before it anneals: one block more than passages, in every pose', () => {
    // The equation the folding strategy keeps as an invariant, read off the
    // finished design: blocks on show = open seam passages + 1, per pose.
    const { of } = blocksOf(ringSurface, found().design.open);
    for (let state = 0; state < ringSurface.stateCount; state++) {
      const visible = ringSurface.visibleOfState(state);
      const blocks = new Set<number>();
      for (let cell = 0; cell < ringSurface.cellCount; cell++) if (visible[cell]) blocks.add(of[cell]!);
      let passages = 0;
      for (const e of ringSurface.adjOfState(state)) {
        if (ringSurface.classKind[e.classId] === 'cut' && found().design.open.has(e.classId)) passages++;
      }
      expect(blocks.size).toBe(passages + 1);
    }
  });

  it('rests on three things the surface of every offered object does', () => {
    // What the reduction needs of a surface: a patch is on show whole or
    // buried whole; an internal class is one wall between the same two cells,
    // a side of the surface in exactly the states its patch is on show; and a
    // passage joins two cells on show. The first is checked whenever the
    // search starts; all three are held here, object by object.
    for (const cells of [2, 3]) {
      for (const { id, surface } of offered(cells)) {
        expect(contractsCleanly(surface), `${id} at ${cells}`).toBe(true);
        const key = (a: number, b: number): string => (a < b ? `${a},${b}` : `${b},${a}`);
        const wallOf = new Map<number, string>();
        for (const e of surface.internalEdges) wallOf.set(e.classId, key(e.a, e.b));
        const broken = { offShow: 0, otherCells: 0, wrongCount: 0 };
        for (let state = 0; state < surface.stateCount; state++) {
          const visible = surface.visibleOfState(state);
          const sides = new Map<number, number>();
          for (const e of surface.adjOfState(state)) {
            if (!visible[e.a] || !visible[e.b]) broken.offShow++;
            const wall = wallOf.get(e.classId);
            if (wall === undefined) continue; // a seam
            if (key(e.a, e.b) !== wall) broken.otherCells++;
            sides.set(e.classId, (sides.get(e.classId) ?? 0) + 1);
          }
          for (const e of surface.internalEdges) {
            const shown = visible[e.a] && visible[e.b] ? 1 : 0;
            if ((sides.get(e.classId) ?? 0) !== shown) broken.wrongCount++;
          }
        }
        expect(broken, `${id} at ${cells}`).toEqual({ offShow: 0, otherCells: 0, wrongCount: 0 });
      }
    }
  });

  it('knows the star cube with its hooks has no design at all', () => {
    // The count equations are one per pose and they are dependent; a
    // dependency with unequal numbers of poses on its two sides cannot be
    // satisfied by any seam set. Every object the page offers passes; the
    // star cube passes with its six box-or-layer poses and fails with its four
    // hooks added, which is why the page lists six and says so.
    for (const cells of [1, 2]) {
      for (const { id, surface } of offered(cells)) {
        expect(countsAreConsistent(surface), `${id} at ${cells}`).toBe(true);
      }
      expect(countsAreConsistent(starCubeWithHooks(cells)), `star cube with hooks at ${cells}`).toBe(false);
    }
    // And the search finds that out for itself: no seam set it tries has
    // block counts, so no attempt ever starts.
    expect(() => contractedSearch(starCubeWithHooks(2), { rng: createRng(1), maxRounds: 3 }))
      .toThrow(/no seam set has block counts/);
  });

  it('can be told which anneal to run, and each still finds the ring a maze', () => {
    // The repair anneal was this ring's search until the count-neutral one
    // replaced it, and the random one is the repair anneal with its aim taken
    // away. Both still find a design here, which is what makes them baselines
    // to measure against rather than strawmen.
    for (const [strategy, seed] of [['repair', 5], ['random', 4]] as const) {
      const got = contractedSearch(ringSurface, { rng: createRng(seed), strategy });
      expect(got.rate.rate).toBe(1);
      for (let state = 0; state < ringSurface.stateCount; state++) {
        expect(stateStats(ringSurface, got.design, state).edges).toBe(ringSurface.visibleCount[state]! - 1);
      }
      // Random moves or not, a wall inside one block is never opened.
      let open = 0;
      for (const e of ringSurface.internalEdges) if (got.design.open.has(e.classId)) open++;
      expect(open).toBe(ringSurface.cellCount - blocksOf(ringSurface, got.design.open).count);
    }
    // The count-neutral one keeps a bit per state and needs the seams free, so
    // something that turns cannot be given it.
    const stack = buildSurface(createStack({ sides: 4, layers: 3, cols: 2, rows: 2 }));
    expect(() => createContractedSearch(stack, { rng: createRng(1), strategy: 'neutral' }))
      .toThrow(/count-neutral search needs/);
  });

  it('refuses a surface it cannot be used on', () => {
    const half = {
      ...ringSurface,
      visibleOfState: (index: number) => {
        const bits = ringSurface.visibleOfState(index);
        if (index !== 0) return bits;
        const copy = Uint8Array.from(bits);
        copy[0] = copy[0] ? 0 : 1; // one cell of a patch, out of step with the rest
        return copy;
      },
    };
    expect(contractsCleanly(half)).toBe(false);
    expect(() => createContractedSearch(half, { rng: createRng(1) })).toThrow(/half on show/);
  });
});
