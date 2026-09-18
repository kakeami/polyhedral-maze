/**
 * A ring of hinged cubes is the first mechanism that buries part of its own
 * surface.
 *
 * Everything the other mechanisms rely on — a cell is a cell, the passage
 * count is the same in every state — stops being free here, so what is checked
 * is not only that a design comes out but that it is a real maze on the real
 * outside of the object, audited from the geometry rather than from the same
 * counters the search used.
 *
 * Most of this is about the eight-cube ring, which is the one with the longest
 * history here. The last parts are about what is asked of *any* object of this
 * kind, and then about each of the others for the one thing it does that the
 * eight-cube ring cannot: shut into a frame, so that the same printed pattern
 * has to be a perfect maze on a torus as well as on a sphere; do that on ten
 * cubes, which is the fewest that can; or swing between shapes that show half
 * as much of themselves again as one another.
 */
import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { createCubeRing, hingeLine } from '../kinetic/mechanisms/cube-ring.ts';
import {
  CUBE_RING_OBJECTS, DEFAULT_HINGES, FRAME_RING, INFINITY_CUBE, PLANK_RING,
  SMALLEST_FRAME, SQUARE_FRAME, createInfinityCube,
} from '../kinetic/mechanisms/cube-ring-objects.ts';
import { buildSurface, type KineticSurface } from '../kinetic/surface.ts';
import { applyPlacement, type KineticCell, type Placement } from '../kinetic/types.ts';
import {
  longestWalk, pickPrintedEnds, pickStartGoal, searchAllStates, stateStats,
  type KineticDesign,
} from '../kinetic/maze.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { poseDistances } from '../kinetic/fold-path.ts';
import { UnionFind } from '../graph.ts';
import { createRng } from '../prng.ts';
import type { Vec3 } from '../types.ts';

const mech = createInfinityCube({ cells: 2 });
const surface = buildSurface(mech);

/** Which way a cell faces, in the world, in one state. */
function place(cell: KineticCell, at: Placement): { normal: Vec3 } {
  const world = cell.corners.map(c => applyPlacement(at, c));
  const [a, b, c] = [world[0]!, world[1]!, world[2]!];
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...n);
  return { normal: [n[0] / length, n[1] / length, n[2] / length] };
}

/** Rebuilds one state's maze from the design, without using the search's counters. */
function audit(surface: KineticSurface, design: Pick<KineticDesign, 'open'>, state: number) {
  const visible = surface.visibleOfState(state);
  const uf = new UnionFind<number>();
  let edges = 0;
  let cycles = 0;
  let touchesBuried = 0;
  for (const e of surface.adjOfState(state)) {
    if (!visible[e.a] || !visible[e.b]) touchesBuried++;
    if (!design.open.has(e.classId)) continue;
    edges++;
    if (uf.connected(e.a, e.b)) cycles++;
    else uf.union(e.a, e.b);
  }
  const roots = new Set<number>();
  let cells = 0;
  for (let cell = 0; cell < surface.cellCount; cell++) {
    if (!visible[cell]) continue;
    cells++;
    roots.add(uf.find(cell));
  }
  return { cells, edges, cycles, components: roots.size, touchesBuried };
}

describe('a mechanism that never folds shut', () => {
  it('buries nothing, and says so', () => {
    const stack = buildSurface(createStack({ sides: 4, layers: 2, cols: 2, rows: 2 }));
    expect(stack.hidesCells).toBe(false);
    expect(stack.alwaysVisible.length).toBe(stack.cellCount);
    for (const count of stack.visibleCount) expect(count).toBe(stack.cellCount);
  });
});

describe('the outside of a folded ring', () => {
  it('shuts into two cubes and four planks', () => {
    expect(surface.stateCount).toBe(6);
    const shapes = mech.states.map(state =>
      [0, 1, 2].map(axis => new Set(state.map(p => p.offset[axis]!.toFixed(1))).size)
        .sort((a, b) => a - b).join('x'));
    expect(shapes.filter(s => s === '2x2x2').length).toBe(2);
    expect(shapes.filter(s => s === '1x2x4').length).toBe(4);
  });

  it('shows a different amount of itself in the two shapes', () => {
    // A plank has more surface than a cube of the same eight cubes, so the
    // passage count is not merely rearranged between poses, it changes.
    expect([...new Set([...surface.visibleCount])].sort((a, b) => a - b)).toEqual([96, 112]);
  });

  it('keeps nothing on the outside, and nothing in', () => {
    const ever = new Set<number>();
    for (let state = 0; state < surface.stateCount; state++) {
      surface.visibleOfState(state).forEach((bit, cell) => { if (bit) ever.add(cell); });
    }
    expect(ever.size).toBe(surface.cellCount); // every square is seen at some point
    expect(surface.alwaysVisible.length).toBe(0); // and none of them always
    expect(surface.hidesCells).toBe(true);
  });

  it('shows completely different faces in its two cubes', () => {
    const cubes = mech.states
      .map((state, index) => ({ index, span: [0, 1, 2].map(axis =>
        new Set(state.map(p => p.offset[axis]!.toFixed(1))).size) }))
      .filter(s => s.span.every(n => n === 2))
      .map(s => s.index);
    const [a, b] = [surface.visibleOfState(cubes[0]!), surface.visibleOfState(cubes[1]!)];
    let both = 0;
    for (let cell = 0; cell < surface.cellCount; cell++) if (a[cell] && b[cell]) both++;
    expect(both).toBe(0);
  });

  it('buries a cell exactly when another cube is pressed against it', () => {
    mech.states.forEach((state, index) => {
      const centres = state.map(p => p.offset);
      mech.cells.forEach((cell, cellIndex) => {
        // A cube of side 1: the next lattice cell along the way the face looks.
        const { normal } = place(cell, state[cell.piece]!);
        const own = state[cell.piece]!.offset;
        const beyond: Vec3 = [own[0] + normal[0], own[1] + normal[1], own[2] + normal[2]];
        const blocked = centres.some(c =>
          Math.abs(c[0] - beyond[0]) < 1e-9 &&
          Math.abs(c[1] - beyond[1]) < 1e-9 &&
          Math.abs(c[2] - beyond[2]) < 1e-9);
        expect(Boolean(surface.visibleOfState(index)[cellIndex])).toBe(!blocked);
      });
    });
  });

  it('never pairs a buried cell with anything', () => {
    for (let state = 0; state < surface.stateCount; state++) {
      expect(audit(surface, { open: new Set() }, state).touchesBuried).toBe(0);
    }
  });
});

describe('gamma on the infinity cube', () => {
  const result = searchAllStates(surface, { rng: createRng(2) });

  it('is a perfect maze in every pose', () => {
    expect(result.rate.rate).toBe(1);
    expect(result.rate.perfect).toBe(surface.stateCount);
  });

  it('spends one passage fewer than it has cells on show — a different number per pose', () => {
    const spent = new Set<number>();
    for (let state = 0; state < surface.stateCount; state++) {
      const seen = audit(surface, result.design, state);
      expect(seen.cells).toBe(surface.visibleCount[state]);
      expect(seen.edges).toBe(seen.cells - 1);
      expect(seen.components).toBe(1);
      expect(seen.cycles).toBe(0);
      spent.add(seen.edges);
    }
    // The whole reason the search had to learn to open one more wall than it
    // closes: 111 passages in a plank, 95 in a cube, one design.
    expect(spent.size).toBe(2);
  });

  it('has nowhere to print a marker that is always on show', () => {
    // Not a failure of the search — a fact about the object, and the reason
    // the markers have to go on an opposite pair of faces, of which exactly
    // one is out in any pose. That is a question for the sheets, not for here.
    expect(() => pickStartGoal(surface, result.design)).toThrow(/start or finish/);
  });

  it('is deterministic for a fixed seed', () => {
    const again = searchAllStates(surface, { rng: createRng(2) });
    expect([...again.design.open].sort()).toEqual([...result.design.open].sort());
  });
});

describe('printing an entrance on something that hides itself', () => {
  const design = searchAllStates(surface, { rng: createRng(2) }).design;
  const ends = pickPrintedEnds(surface, design);

  /** Which cells of the maze are on the outside in one pose. */
  const showing = (cells: readonly number[], state: number) =>
    cells.filter(cell => surface.visibleOfState(state)[cell]);

  it('prints each marker twice, and shows exactly one of each in every pose', () => {
    expect(ends.start.length).toBe(2);
    expect(ends.goal.length).toBe(2);
    expect(new Set([...ends.start, ...ends.goal]).size).toBe(4);
    for (let state = 0; state < surface.stateCount; state++) {
      expect(showing(ends.start, state).length).toBe(1);
      expect(showing(ends.goal, state).length).toBe(1);
    }
  });

  it('walks between the two that are on show', () => {
    expect(ends.byState.length).toBe(surface.stateCount);
    ends.byState.forEach((pair, state) => {
      expect(showing(ends.start, state)).toEqual([pair.start]);
      expect(showing(ends.goal, state)).toEqual([pair.goal]);
    });
  });

  it('puts them on dead ends, wherever they are on show', () => {
    for (let state = 0; state < surface.stateCount; state++) {
      const degree = new Map<number, number>();
      for (const e of surface.adjOfState(state)) {
        if (!design.open.has(e.classId)) continue;
        degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
        degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
      }
      for (const cell of [...ends.start, ...ends.goal]) {
        if (!surface.visibleOfState(state)[cell]) continue;
        expect(degree.get(cell)).toBe(1);
      }
    }
  });

  it('does not go on a cube\'s opposite pair of faces, as was first supposed', () => {
    // The guess this replaced: put the marker on both ends of one axis of one
    // cube, since a cube in a block is pressed against a neighbour on one side
    // and open on the other. It is wrong — in the plank, a cube in the middle
    // of a row has neighbours on *both* sides along it — and the two faces are
    // both on show in some pose besides. What the pairs actually are is a
    // question for the geometry, which is why nothing here names a face.
    for (let piece = 0; piece < mech.pieceCount; piece++) {
      for (let axis = 0; axis < 3; axis++) {
        const front = mech.cellIndex(piece, axis * 2, 0, 0);
        const back = mech.cellIndex(piece, axis * 2 + 1, 0, 0);
        const together = Array.from({ length: surface.stateCount }, (_u, s) => surface.visibleOfState(s))
          .filter(v => v[front] && v[back]);
        expect(together.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to one cell each where nothing is ever hidden', () => {
    const stack = buildSurface(createStack({ sides: 4, layers: 2, cols: 2, rows: 2 }));
    const found = searchAllStates(stack, { rng: createRng(1) }).design;
    const one = pickPrintedEnds(stack, found);
    const same = pickStartGoal(stack, found);
    expect(one.start).toEqual([same.start]);
    expect(one.goal).toEqual([same.goal]);
    expect(one.byState).toEqual(Array.from({ length: stack.stateCount }, () => same));
  });
});

describe('the taping it ships with', () => {
  it('lines up the two seams that cross between the rows', () => {
    // What decides whether the thing folds at all. The plank is two rows of
    // four; the seams at its ends are the only ones joining the rows, and only
    // if their tapes lie on the same face, in line with each other, can the
    // plank be split along its length and opened out — the move that reaches
    // the second cube. Tape them on the end edges instead and three of the six
    // poses become unreachable, which is what the first taping recommended
    // here did. `.dev/probe-taping-connectivity.ts` folds it out in full; this
    // is the property that separates the four that work from the four that
    // do not.
    const crossing = [3, 7].map(seam => hingeLine(
      PLANK_RING[seam]!,
      PLANK_RING[(seam + 1) % PLANK_RING.length]!,
      DEFAULT_HINGES[seam]!,
    ));
    const [a, b] = [crossing[0]!, crossing[1]!];
    expect(a.axis).toBe(0); // along the plank, not up its end
    expect(b.axis).toBe(0);
    expect(a.point[2]).toBe(b.point[2]); // and both on the same face of it
  });

  it('gives each seam to both of its cubes, as one edge', () => {
    // What the pattern needs: a hinge is a line in the lattice the plank is
    // laid out in, and a cube is printed and cut out long before the plank
    // exists. So the seam is handed over in each cube's own frame, and the two
    // have to be the same edge once the cubes are put back where they belong.
    const seams = mech.tapeSeams();
    expect(seams.length).toBe(mech.pieceCount);
    const plank = mech.states[mech.states.findIndex((_state, index) =>
      mech.stateLabel(index) === '00000000')]!;
    expect(plank).toBeDefined();
    for (const seam of seams) {
      expect(seam.pieces[1]).toBe((seam.pieces[0] + 1) % mech.pieceCount);
      const placed = seam.ends.map((edge, side) =>
        edge.map(point => applyPlacement(plank[seam.pieces[side]!]!, point))
          .map(v => v.map(x => x.toFixed(6)).join(',')).sort().join('|'));
      expect(placed[0]).toBe(placed[1]);
      // And it is an edge of the unit cube, not a diagonal across it.
      for (const edge of seam.ends) {
        const [a, b] = edge;
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeCloseTo(1, 9);
      }
    }
  });

  it('folds through all six poses, two of them cubes', () => {
    const shapes = mech.states.map(state =>
      [0, 1, 2].map(axis => new Set(state.map(p => p.offset[axis]!.toFixed(1))).size)
        .sort((x, y) => x - y).join('x'));
    expect(shapes.filter(s => s === '2x2x2').length).toBe(2);
    expect(shapes.length).toBe(6);
  });
});

describe('the longest walk through a pose', () => {
  // Double sweep against brute force. The shortcut — walk from anywhere, then
  // from the furthest thing you found — is only valid on a tree, and this is
  // the one place where it is worth showing that the design really is one.
  const result = searchAllStates(surface, { rng: createRng(2) });

  function byBruteForce(state: number): number {
    const near = new Map<number, number[]>();
    for (const e of surface.adjOfState(state)) {
      if (!result.design.open.has(e.classId)) continue;
      (near.get(e.a) ?? near.set(e.a, []).get(e.a)!).push(e.b);
      (near.get(e.b) ?? near.set(e.b, []).get(e.b)!).push(e.a);
    }
    let worst = 0;
    for (const from of near.keys()) {
      const seen = new Map<number, number>([[from, 0]]);
      const queue = [from];
      for (let head = 0; head < queue.length; head++) {
        for (const next of near.get(queue[head]!) ?? []) {
          if (seen.has(next)) continue;
          const step = seen.get(queue[head]!)! + 1;
          seen.set(next, step);
          queue.push(next);
          if (step > worst) worst = step;
        }
      }
    }
    return worst;
  }

  it('is what walking every pair of cells would find', () => {
    for (let state = 0; state < surface.stateCount; state++) {
      expect(longestWalk(surface, result.design, state)).toBe(byBruteForce(state));
    }
  });

  it('is shorter than the maze and longer than a corridor', () => {
    for (let state = 0; state < surface.stateCount; state++) {
      const walk = longestWalk(surface, result.design, state);
      expect(walk).toBeGreaterThan(10);
      expect(walk).toBeLessThan(surface.visibleCount[state]!);
    }
  });

  it('is nothing at all where nothing is open', () => {
    expect(longestWalk(surface, { open: new Set() }, 0)).toBe(0);
  });
});

/**
 * What a builder is promised: the drawing never contradicts itself anywhere a
 * hand can see.
 *
 * Folded shut, the wall printed along the edge of a face pressed inside sits a
 * paper's thickness from the seam the surface crosses there. Unless it agrees
 * with the side on show, a millimetre of slop in the taping shows a wall
 * across a passage — on the model, where no rendering rule can help. So the
 * search is run on a surface that welds a buried side to whatever is on show
 * on top of it, and this is that promise, read back off the geometry.
 */
describe('a drawing that agrees with itself where it shows', () => {
  /** Sides sharing a segment of space in one state, buried ones included. */
  function touching(surface: KineticSurface, state: number): number[][] {
    const at = mech.states[state]!;
    const key = (v: Vec3) => v.map(x => Math.round(x / 1e-6)).join(',');
    const bySegment = new Map<string, number[]>();
    mech.cells.forEach((cell, index) => {
      const world = cell.corners.map(c => applyPlacement(at[cell.piece]!, c));
      for (let s = 0; s < world.length; s++) {
        const u = key(world[s]!);
        const v = key(world[(s + 1) % world.length]!);
        const segment = u < v ? `${u}|${v}` : `${v}|${u}`;
        const side = surface.sideStart[index]! + s;
        const bucket = bySegment.get(segment);
        if (bucket) bucket.push(side); else bySegment.set(segment, [side]);
      }
    });
    return [...bySegment.values()];
  }

  /** Segments with a side on show whose sides disagree about the opening. */
  function disagreeing(surface: KineticSurface, design: Pick<KineticDesign, 'open'>): number {
    let count = 0;
    for (let state = 0; state < surface.stateCount; state++) {
      const visible = surface.visibleOfState(state);
      for (const sides of touching(surface, state)) {
        if (sides.length < 2) continue;
        const cellOf = (side: number) => {
          let cell = 0;
          while (surface.sideStart[cell + 1]! <= side) cell++;
          return cell;
        };
        if (!sides.some(side => visible[cellOf(side)] === 1)) continue;
        const opens = sides.map(side => design.open.has(surface.classOf[side]!));
        if (opens.some(open => open !== opens[0])) count++;
      }
    }
    return count;
  }

  it('holds under the rule the designs are searched with', () => {
    const design = searchAllStates(surface, { rng: createRng(5) }).design;
    expect(disagreeing(surface, design)).toBe(0);
  });

  it('does not hold under the weaker one, which is why the rule exists', () => {
    const loose = buildSurface(mech, { weld: 'walkable' });
    const design = searchAllStates(loose, { rng: createRng(5) }).design;
    expect(disagreeing(loose, design)).toBeGreaterThan(0);
  });

  it('costs the stack nothing: it never buries a cell', () => {
    const stack = createStack({ sides: 5, layers: 3, cols: 2, rows: 2 });
    const safe = buildSurface(stack);
    const loose = buildSurface(stack, { weld: 'walkable' });
    expect(safe.classCount).toBe(loose.classCount);
    expect([...safe.classOf]).toEqual([...loose.classOf]);
  });
});

describe('every object the page offers', () => {
  for (const object of CUBE_RING_OBJECTS) {
    const ring = createCubeRing(object, { cells: 1 });

    it(`${object.id}: every state is a shape a hand can set down`, () => {
      expect(ring.states.length).toBe(ring.poses.length);
      expect(ring.states.length).toBeGreaterThan(1);
      for (const pose of ring.poses) {
        const [a, b, c] = pose.span as [number, number, number];
        // A solid block, or one layer thick. Anything else is a shape that
        // stands up only while someone is holding it.
        expect(a * b * c === ring.pieceCount || Math.min(a, b, c) === 1).toBe(true);
      }
      // No two shapes with the same name, so the panel's list is a list of
      // things rather than of things and their duplicates.
      expect(new Set(ring.poses.map(pose => pose.label)).size).toBe(ring.poses.length);
    });

    it(`${object.id}: can be folded from any state to any other`, () => {
      const distances = poseDistances(ring.foldGraph());
      for (let from = 0; from < ring.states.length; from++) {
        for (let to = 0; to < ring.states.length; to++) {
          expect(distances[from]![to]!).toBeGreaterThanOrEqual(0);
        }
      }
    });
  }

  it('leaves the eight-cube ring exactly as it was', () => {
    // The mazes that ship with the page are sets of class numbers, and class
    // numbers mean whatever the surface says they mean. So this is not a
    // preference about naming: if the general machinery found the six shapes
    // in another order, or found a seventh, every stored design would quietly
    // become a different maze.
    const eight = createCubeRing(INFINITY_CUBE, { cells: 1 });
    expect(eight.states.length).toBe(6);
    expect(eight.poses.map(pose => pose.label))
      .toEqual(['Plank 1', 'Plank 2', 'Cube 1', 'Cube 2', 'Plank 3', 'Plank 4']);
    expect(eight.poses.every(pose => pose.genus === 0)).toBe(true);
  });
});

describe('the twelve-cube ring, which shuts into a frame', () => {
  const twelve = createCubeRing(FRAME_RING, { cells: 2 });
  const skin = buildSurface(twelve, { maxStates: twelve.states.length });

  it('changes the genus of its own surface, which eight cubes cannot', () => {
    expect(twelve.states.length).toBe(5);
    expect(new Set(twelve.poses.map(pose => pose.genus))).toEqual(new Set([0, 1]));
    expect(twelve.poses.filter(pose => pose.label.startsWith('Frame')).length).toBe(1);
  });

  it('shows a different amount of itself in almost every shape', () => {
    // 160, 128, 152, 152, 184 at two cells across a face: the passage count is
    // not the same from one shape to the next, which is the whole difficulty.
    expect([...skin.visibleCount].sort((a, b) => a - b)[0])
      .toBeLessThan([...skin.visibleCount].sort((a, b) => b - a)[0]!);
    expect(skin.hidesCells).toBe(true);
  });

  it('is a perfect maze in all five of them, on a design found here', () => {
    const found = contractedSearch(skin, { rng: createRng(1) });
    expect(found.rate.rate).toBe(1);
    for (let state = 0; state < skin.stateCount; state++) {
      const stats = stateStats(skin, found.design, state);
      expect(stats.perfect).toBe(true);
      expect(stats.edges).toBe(skin.visibleCount[state]! - 1);
    }
  });

  it('has somewhere to print a marker, though not on a cell that is always out', () => {
    const found = contractedSearch(skin, { rng: createRng(1) });
    const ends = pickPrintedEnds(skin, found.design);
    // Unlike the eight-cube ring it does keep some squares out in every shape
    // — and still cannot print a marker on one of them, because none of those
    // is reliably a dead end. So the markers go in pairs here too.
    expect(skin.alwaysVisible.length).toBeGreaterThan(0);
    expect(ends.start.length).toBe(2);
    expect(ends.goal.length).toBe(2);
    for (let state = 0; state < skin.stateCount; state++) {
      const out = skin.visibleOfState(state);
      expect(ends.start.filter(cell => out[cell]).length).toBe(1);
      expect(ends.goal.filter(cell => out[cell]).length).toBe(1);
    }
  });
});

describe('the ten-cube ring, which is the fewest that can change genus', () => {
  const ten = createCubeRing(SMALLEST_FRAME, { cells: 2 });
  const skin = buildSurface(ten, { maxStates: ten.states.length });

  it('does on ten cubes what the eight-cube ring cannot do at all', () => {
    expect(ten.pieceCount).toBe(10);
    expect(ten.states.length).toBe(3);
    expect(ten.poses.filter(pose => pose.genus === 1).length).toBe(2);
    expect(ten.poses.filter(pose => pose.genus === 0).length).toBe(1);
  });

  it('builds the same frame twice over, and they are not the same state', () => {
    const [first, second] = ten.poses.filter(pose => pose.genus === 1);
    // The same shape in the hand — same silhouette, same amount of it on show
    // — reached by a different set of turns, so different squares are buried
    // and the maze on the outside is a different maze.
    expect([...first!.span].sort()).toEqual([...second!.span].sort());
    expect(first!.exposed).toBe(second!.exposed);
    expect([...first!.turns]).not.toEqual([...second!.turns]);
  });

  it('is a perfect maze in all three, on a design found here', () => {
    const found = contractedSearch(skin, { rng: createRng(1) });
    expect(found.rate.rate).toBe(1);
    for (let state = 0; state < skin.stateCount; state++) {
      const stats = stateStats(skin, found.design, state);
      expect(stats.perfect).toBe(true);
      expect(stats.edges).toBe(skin.visibleCount[state]! - 1);
    }
  });
});

describe('the twelve-cube ring taped on the frame itself', () => {
  const square = createCubeRing(SQUARE_FRAME, { cells: 2 });
  const skin = buildSurface(square, { maxStates: square.states.length });

  it('is a different object from the other twelve, though the cubes are the same', () => {
    const other = createCubeRing(FRAME_RING, { cells: 2 });
    expect(square.pieceCount).toBe(other.pieceCount);
    expect(square.states.length).toBe(3);
    expect(other.states.length).toBe(5);
  });

  it('shows half as much again of itself in one shape as in another', () => {
    const counts = [...skin.visibleCount];
    expect(counts).toEqual([192, 160, 128]);
    expect(Math.max(...counts)).toBe(Math.min(...counts) * 1.5);
  });

  it('is a perfect maze in all three, on a design found here', () => {
    const found = contractedSearch(skin, { rng: createRng(1) });
    expect(found.rate.rate).toBe(1);
    for (let state = 0; state < skin.stateCount; state++) {
      const stats = stateStats(skin, found.design, state);
      expect(stats.perfect).toBe(true);
      expect(stats.edges).toBe(skin.visibleCount[state]! - 1);
    }
  });
});
