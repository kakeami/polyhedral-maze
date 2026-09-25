import type { Mechanism, KineticState } from './types.ts';
import { applyPlacement } from './types.ts';
import { UnionFind } from '../graph.ts';
import { VertexWelder } from './weld.ts';
import type { Pairing, SurfaceParts } from './placement-pairs.ts';
import { decomposeByPlacement, relOfState } from './placement-pairs.ts';

export type SideClassKind =
  /**
   * Stands for more than one wall: it meets a side of another piece in some
   * state, or another side lies buried under it. Opening it opens every wall
   * it stands for, in every state at once.
   */
  | 'cut'
  /** Exactly one wall: the same two cells of one piece, always (a grid line). */
  | 'internal'
  /** Never meets anything: a free rim of the object. */
  | 'rim';

export interface SurfaceAdjacency {
  readonly a: number;
  readonly b: number;
  /** Side class shared by both sides; one boolean per class is the design. */
  readonly classId: number;
  readonly intra: boolean;
}

/**
 * Everything the maze layer needs, derived from a mechanism by geometry alone.
 *
 * The design variable is one boolean per *side class*, not per adjacency: if a
 * side meets different partners in different states, all of them must agree on
 * where the opening is, or the drawing would break at a seam (L0). Union-Find
 * over the pairings of every state is exactly that agreement.
 *
 * What counts as meeting is `BuildSurfaceOptions.weld`, and on an object that
 * folds shut on itself the two answers differ — see there.
 */
export interface KineticSurface {
  readonly mechanism: Mechanism;
  readonly cellCount: number;
  readonly stateCount: number;
  /** Side s of cell c has index sideStart[c] + s. */
  readonly sideStart: Int32Array;
  readonly sideCount: number;
  readonly classOf: Int32Array;
  readonly classCount: number;
  readonly classKind: readonly SideClassKind[];
  readonly classSides: readonly (readonly number[])[];
  /**
   * Passages of one state, on demand.
   *
   * A function and not a list, because a mechanism worth building has more
   * states than a list of their passages fits in: a stack of six twelve-sided
   * rings has 248832 of them over 288 cells. Where the surface was built out
   * of pairs of pieces this is assembled when asked — the pairings themselves
   * are shared, so a state costs a list of references — and the last one asked
   * for is kept, since a caller almost always asks twice.
   */
  adjOfState(state: number): readonly SurfaceAdjacency[];
  /** The one adjacency behind each 'internal' class — the free maze walls. */
  readonly internalEdges: readonly SurfaceAdjacency[];
  readonly cutClasses: readonly number[];
  /** 1 where the cell is on the outside of the object in that state. */
  visibleOfState(state: number): Uint8Array;
  /** How many cells are on the outside in each state. */
  readonly visibleCount: Int32Array;
  /** Cells on the outside in *every* state — the only places a marker can go. */
  readonly alwaysVisible: readonly number[];
  /** Whether any cell is ever hidden: false for a mechanism that never folds shut. */
  readonly hidesCells: boolean;
  /**
   * The pieces and the placements they take relative to one another, where the
   * surface was built out of those (`placement-pairs.ts`), and null where it
   * had to be welded a state at a time.
   *
   * Kept because it says more than the states do: a seam of a turning
   * mechanism *is* a pair of pieces, and one of its turns *is* a relative
   * placement, so `chainOf` reads the line off this rather than grouping every
   * state's passages to find it again.
   */
  readonly parts: SurfaceParts | null;
}

/**
 * Cells that lie on the outside of the object in one state.
 *
 * Folding a mechanism shut presses two cells face to face, and from then on
 * both of them describe a patch of surface that is *inside* the object: the
 * maze cannot be seen there and cannot be walked across it. Two cells pressed
 * together occupy the same patch of space, so coincident centres are the whole
 * test — no boundary of a union of solids is needed. A mechanism whose pieces
 * never meet face to face (the stack, a glued pair) has every cell visible in
 * every state, which is why this changes nothing for them.
 */
function visibleCells(mech: Mechanism, state: KineticState): Uint8Array {
  const visible = new Uint8Array(mech.cells.length).fill(1);
  const welder = new VertexWelder();
  const firstAt = new Map<number, number>();

  mech.cells.forEach((cell, cellIndex) => {
    const placement = state[cell.piece];
    if (!placement) throw new Error(`state is missing a placement for piece ${cell.piece}`);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const corner of cell.corners) {
      const p = applyPlacement(placement, corner);
      cx += p[0];
      cy += p[1];
      cz += p[2];
    }
    const n = cell.corners.length;
    const id = welder.id([cx / n, cy / n, cz / n]);
    const first = firstAt.get(id);
    if (first === undefined) firstAt.set(id, cellIndex);
    else {
      visible[cellIndex] = 0;
      visible[first] = 0;
    }
  });
  return visible;
}

/**
 * Pairs up sides that occupy the same segment of the surface in one state.
 *
 * Hidden cells take no part: their sides are buried with them, and it is only
 * by leaving them out that a segment is shared by at most two sides. Where
 * four cubes of a folded ring meet along an interior edge, all eight sides
 * incident to it belong to hidden cells, so nothing at all is left there.
 */
function pairSides(
  mech: Mechanism,
  state: KineticState,
  sideStart: Int32Array,
  visible: Uint8Array,
): Pairing[] {
  const welder = new VertexWelder();
  const bySegment = new Map<string, number[]>();
  const cellOfSide: number[] = [];

  mech.cells.forEach((cell, cellIndex) => {
    if (!visible[cellIndex]) return;
    const placement = state[cell.piece];
    if (!placement) throw new Error(`state is missing a placement for piece ${cell.piece}`);
    const ids = cell.corners.map(c => welder.id(applyPlacement(placement, c)));
    for (let s = 0; s < ids.length; s++) {
      const u = ids[s]!;
      const v = ids[(s + 1) % ids.length]!;
      if (u === v) throw new Error(`cell ${cellIndex} has a degenerate side ${s}`);
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      const side = sideStart[cellIndex]! + s;
      cellOfSide[side] = cellIndex;
      const bucket = bySegment.get(key);
      if (bucket) bucket.push(side);
      else bySegment.set(key, [side]);
    }
  });

  const pairs: Pairing[] = [];
  for (const [key, sides] of bySegment) {
    if (sides.length === 1) continue; // free rim
    if (sides.length !== 2) {
      throw new Error(`segment ${key} is shared by ${sides.length} sides (expected 1 or 2)`);
    }
    const sideA = sides[0]!;
    const sideB = sides[1]!;
    pairs.push({ sideA, sideB, cellA: cellOfSide[sideA]!, cellB: cellOfSide[sideB]! });
  }
  return pairs;
}

export interface BuildSurfaceOptions {
  readonly maxStates?: number;
  /**
   * Which sides have to agree about their opening.
   *
   * `'seam-safe'`, the default, welds every side lying on a segment where any
   * one of them is on the surface — the buried ones included. It is a rule
   * about the built object rather than about the walk: folded shut, a cell
   * pressed against another piece keeps its printed walls, and the ones along
   * the edge of that face lie exactly on the seam the surface crosses there.
   * A paper's thickness of slop then shows a wall across a passage. Welding
   * them makes the drawing agree with itself wherever a hand can see it, at
   * the cost of some of the freedom the search had.
   *
   * `'walkable'` welds only what a walk can use: two sides both on the
   * surface. It is the weaker rule, and the honest one if all that is wanted
   * is a maze on a screen.
   *
   * Two faces pressed together share every grid line as well as their edges,
   * and those lines are inside the object for good. Neither rule welds them:
   * asking the drawings on two faces to match leaves the search with nothing
   * to arrange, and on the eight-cube ring no design at all.
   *
   * On a mechanism that never buries a cell the two rules are the same one,
   * and the extra work is skipped.
   */
  readonly weld?: 'seam-safe' | 'walkable';
}

/**
 * Sides lying on the same segment of space in one state, buried ones included.
 *
 * `pairSides` leaves hidden cells out, because a walk cannot use them and
 * because with them in a segment can be shared by three or four sides. Here
 * that is the point: those are the sides that have to agree with the surface
 * without ever being part of it.
 */
function touchingSides(
  mech: Mechanism,
  state: KineticState,
  sideStart: Int32Array,
): number[][] {
  const welder = new VertexWelder();
  const bySegment = new Map<string, number[]>();

  mech.cells.forEach((cell, cellIndex) => {
    const placement = state[cell.piece];
    if (!placement) throw new Error(`state is missing a placement for piece ${cell.piece}`);
    const ids = cell.corners.map(c => welder.id(applyPlacement(placement, c)));
    for (let s = 0; s < ids.length; s++) {
      const u = ids[s]!;
      const v = ids[(s + 1) % ids.length]!;
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      const side = sideStart[cellIndex]! + s;
      const bucket = bySegment.get(key);
      if (bucket) bucket.push(side);
      else bySegment.set(key, [side]);
    }
  });
  return [...bySegment.values()];
}

/**
 * Grid lines inside the part of an object that is never on show, as side pairs.
 *
 * A cell that is buried in every state takes part in no pairing — a walk never
 * reaches it — so the lines between two such cells used to come out as 'rim',
 * one class a side, and be drawn in full wherever they are drawn at all: on the
 * printed net, and on screen mid-fold, when the faces come apart. They are
 * grid lines like any other, the same two cells of one piece in every state,
 * so they are paired here in the piece's own frame and become internal walls
 * the search can draw a tree across. Only sides nothing else claimed are
 * taken, so no class that meant something before changes by it.
 */
function neverShownGridLines(
  mech: Mechanism,
  sideStart: Int32Array,
  visibleByState: readonly Uint8Array[],
  uf: UnionFind<number>,
): [number, number][] {
  const cellCount = mech.cells.length;
  const shown = new Uint8Array(cellCount);
  for (const visible of visibleByState) {
    for (let cell = 0; cell < cellCount; cell++) if (visible[cell]) shown[cell] = 1;
  }
  if (shown.every(bit => bit === 1)) return [];

  const classSize = new Map<number, number>();
  for (let side = 0; side < sideStart[cellCount]!; side++) {
    const root = uf.find(side);
    classSize.set(root, (classSize.get(root) ?? 0) + 1);
  }
  const welder = new VertexWelder();
  const bySegment = new Map<string, number[]>();
  mech.cells.forEach((cell, cellIndex) => {
    if (shown[cellIndex]) return;
    const ids = cell.corners.map(c => welder.id(c));
    for (let s = 0; s < ids.length; s++) {
      const side = sideStart[cellIndex]! + s;
      if (classSize.get(uf.find(side)) !== 1) continue;
      const u = ids[s]!;
      const v = ids[(s + 1) % ids.length]!;
      const key = `${cell.piece}:${u < v ? `${u}:${v}` : `${v}:${u}`}`;
      const bucket = bySegment.get(key);
      if (bucket) bucket.push(side);
      else bySegment.set(key, [side]);
    }
  });
  const pairs: [number, number][] = [];
  for (const sides of bySegment.values()) {
    if (sides.length === 2) pairs.push([sides[0]!, sides[1]!]);
  }
  return pairs;
}

function sideStarts(mech: Mechanism): Int32Array {
  const cellCount = mech.cells.length;
  const sideStart = new Int32Array(cellCount + 1);
  for (let i = 0; i < cellCount; i++) {
    sideStart[i + 1] = sideStart[i]! + mech.cells[i]!.corners.length;
  }
  return sideStart;
}

function checkStateCount(mech: Mechanism, options: BuildSurfaceOptions): void {
  const maxStates = options.maxStates ?? 4096;
  if (mech.states.length === 0) throw new Error('mechanism has no states');
  if (mech.states.length > maxStates) {
    throw new Error(
      `mechanism has ${mech.states.length} states, over the maxStates limit of ${maxStates}; ` +
        'pass a larger maxStates or sample a subset',
    );
  }
}

/** The side classes a set of pairings leaves, numbered by their first side. */
function classify(uf: UnionFind<number>, sideCount: number): {
  classOf: Int32Array;
  classSides: number[][];
} {
  const classOf = new Int32Array(sideCount).fill(-1);
  const classSides: number[][] = [];
  for (let s = 0; s < sideCount; s++) {
    const root = uf.find(s);
    let id = classOf[root]!;
    if (id === -1) {
      id = classSides.length;
      classSides.push([]);
      classOf[root] = id;
    }
    classOf[s] = id;
    classSides[id]!.push(s);
  }
  return { classOf, classSides };
}

/**
 * The surface a mechanism carries, in every state it can be put in.
 *
 * Built out of pairs of pieces where the object allows it (`placement-pairs.ts`)
 * and a state at a time where it does not. Which one runs is decided by the
 * geometry and not by the mechanism's name: an object that buries a cell makes
 * a state more than the sum of its pairs, and nothing else does. The two build
 * the same surface, field for field, and a test holds them to it.
 */
export function buildSurface(mech: Mechanism, options: BuildSurfaceOptions = {}): KineticSurface {
  checkStateCount(mech, options);
  const sideStart = sideStarts(mech);
  const parts = decomposeByPlacement(mech, sideStart);
  return parts ? buildFromParts(mech, parts, sideStart) : buildSurfaceByState(mech, options);
}

/**
 * The surface, welded once per state.
 *
 * What every mechanism used until the pairs above were worked out, and still
 * the answer for one that folds shut on itself: with cells buried, which side
 * a side is paired with depends on the whole state and not on two pieces of
 * it. Exported so that a test can build a surface both ways and compare.
 */
export function buildSurfaceByState(
  mech: Mechanism,
  options: BuildSurfaceOptions = {},
): KineticSurface {
  checkStateCount(mech, options);

  const cellCount = mech.cells.length;
  const sideStart = sideStarts(mech);
  const sideCount = sideStart[cellCount]!;

  const visibleByState = mech.states.map(state => visibleCells(mech, state));
  const visibleCount = Int32Array.from(visibleByState, v => {
    let n = 0;
    for (const bit of v) n += bit;
    return n;
  });
  const alwaysVisible: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    if (visibleByState.every(v => v[cell] === 1)) alwaysVisible.push(cell);
  }
  const hidesCells = alwaysVisible.length < cellCount;

  const pairsByState = mech.states.map((state, index) =>
    pairSides(mech, state, sideStart, visibleByState[index]!),
  );

  // One design boolean per class: sides that ever meet must agree (L0).
  const uf = new UnionFind<number>();
  for (let s = 0; s < sideCount; s++) uf.find(s);
  for (const pairs of pairsByState) {
    for (const p of pairs) uf.union(p.sideA, p.sideB);
  }
  if ((options.weld ?? 'seam-safe') === 'seam-safe' && hidesCells) {
    // And the sides buried under them, wherever any side of the segment is on
    // the surface: what is printed underneath must not contradict what is on
    // show at the same place. Nothing is welded where every side is buried —
    // that is inside the object, and nobody will ever see it.
    const cellOfSide = new Int32Array(sideCount);
    for (let cell = 0; cell < cellCount; cell++) {
      for (let side = sideStart[cell]!; side < sideStart[cell + 1]!; side++) {
        cellOfSide[side] = cell;
      }
    }
    mech.states.forEach((state, index) => {
      const visible = visibleByState[index]!;
      for (const sides of touchingSides(mech, state, sideStart)) {
        if (!sides.some(side => visible[cellOfSide[side]!] === 1)) continue;
        for (let i = 1; i < sides.length; i++) uf.union(sides[0]!, sides[i]!);
      }
    });
  }

  const neverShown = neverShownGridLines(mech, sideStart, visibleByState, uf);
  for (const [a, b] of neverShown) uf.union(a, b);

  const { classOf, classSides } = classify(uf, sideCount);
  const classCount = classSides.length;

  const kind: SideClassKind[] = new Array(classCount).fill('rim');
  for (const [a] of neverShown) kind[classOf[a]!] = 'internal';
  const adjByState: SurfaceAdjacency[][] = [];
  for (const pairs of pairsByState) {
    const adj: SurfaceAdjacency[] = [];
    for (const p of pairs) {
      const classId = classOf[p.sideA]!;
      const intra = mech.cells[p.cellA]!.piece === mech.cells[p.cellB]!.piece;
      // More than the one pair of sides means more than one wall stands or
      // falls with the class, which is a seam whatever it joins here.
      if (!intra || classSides[classId]!.length !== 2) kind[classId] = 'cut';
      else if (kind[classId] !== 'cut') kind[classId] = 'internal';
      adj.push({ a: p.cellA, b: p.cellB, classId, intra });
    }
    adjByState.push(adj);
  }

  // An internal class never changes partner, so it stands for exactly one wall.
  // Every state is scanned rather than the first, because a wall can be buried
  // in one state and back on the surface in the next; it is still one wall.
  const internalEdges: SurfaceAdjacency[] = [];
  const seen = new Set<number>();
  for (const adj of adjByState) {
    for (const e of adj) {
      if (kind[e.classId] !== 'internal' || seen.has(e.classId)) continue;
      seen.add(e.classId);
      internalEdges.push(e);
    }
  }
  // Last, so that an object with nothing it never shows keeps the list, and
  // the order a seeded search shuffles, that it always had.
  const cellOfSide = (side: number): number => {
    let lo = 0;
    let hi = cellCount - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (sideStart[mid]! <= side) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  for (const [a, b] of neverShown) {
    internalEdges.push({ a: cellOfSide(a), b: cellOfSide(b), classId: classOf[a]!, intra: true });
  }
  for (let c = 0; c < classCount; c++) {
    if (kind[c] === 'internal' && classSides[c]!.length !== 2) {
      throw new Error(`internal class ${c} has ${classSides[c]!.length} sides (expected 2)`);
    }
  }

  const cutClasses: number[] = [];
  for (let c = 0; c < classCount; c++) if (kind[c] === 'cut') cutClasses.push(c);

  return {
    mechanism: mech,
    cellCount,
    stateCount: mech.states.length,
    sideStart,
    sideCount,
    classOf,
    classCount,
    classKind: kind,
    classSides,
    adjOfState: (state: number) => {
      const adj = adjByState[state];
      if (!adj) throw new Error(`no such state: ${state}`);
      return adj;
    },
    internalEdges,
    cutClasses,
    visibleOfState: (state: number) => {
      const visible = visibleByState[state];
      if (!visible) throw new Error(`no such state: ${state}`);
      return visible;
    },
    visibleCount,
    alwaysVisible,
    hidesCells,
    parts: null,
  };
}

/**
 * The same surface, assembled from pieces and pairs.
 *
 * Nothing here looks at a state's geometry: the pairings were worked out once
 * per pair of pieces per relative placement, and a state only says which of
 * them is in force. What is still proportional to the state count is the list
 * of adjacencies laid out below — the next thing to go, and the reason a
 * mechanism with a quarter of a million states is still out of reach.
 */
function buildFromParts(
  mech: Mechanism,
  parts: SurfaceParts,
  sideStart: Int32Array,
): KineticSurface {
  const cellCount = mech.cells.length;
  const sideCount = sideStart[cellCount]!;
  const { stateCount } = parts;

  const uf = new UnionFind<number>();
  for (let s = 0; s < sideCount; s++) uf.find(s);
  const everyPairing = function* (): Generator<[Pairing, boolean]> {
    for (const list of parts.intra) for (const p of list) yield [p, true];
    for (const pair of parts.pairs) {
      for (const list of pair.byRel) for (const p of list) yield [p, false];
    }
  };
  for (const [p] of everyPairing()) uf.union(p.sideA, p.sideB);

  const { classOf, classSides } = classify(uf, sideCount);
  const classCount = classSides.length;

  const kind: SideClassKind[] = new Array(classCount).fill('rim');
  for (const [p, intra] of everyPairing()) {
    const classId = classOf[p.sideA]!;
    if (!intra || classSides[classId]!.length !== 2) kind[classId] = 'cut';
    else if (kind[classId] !== 'cut') kind[classId] = 'internal';
  }
  for (let c = 0; c < classCount; c++) {
    if (kind[c] === 'internal' && classSides[c]!.length !== 2) {
      throw new Error(`internal class ${c} has ${classSides[c]!.length} sides (expected 2)`);
    }
  }

  const adjacency = (p: Pairing, intra: boolean): SurfaceAdjacency => ({
    a: p.cellA,
    b: p.cellB,
    classId: classOf[p.sideA]!,
    intra,
  });

  // An internal class is a line inside one piece, so it is in a piece's own
  // list and needs no state to be found. Ordered by the side a scan over the
  // cells would meet first, which is the order the state-at-a-time build
  // produces — and a seeded shuffle of these walls names the maze.
  const internal: { side: number; edge: SurfaceAdjacency }[] = [];
  for (const list of parts.intra) {
    for (const p of list) {
      if (kind[classOf[p.sideA]!] !== 'internal') continue;
      internal.push({ side: Math.min(p.sideA, p.sideB), edge: adjacency(p, true) });
    }
  }
  internal.sort((x, y) => x.side - y.side);
  const internalEdges = internal.map(x => x.edge);

  const cutClasses: number[] = [];
  for (let c = 0; c < classCount; c++) if (kind[c] === 'cut') cutClasses.push(c);

  // One adjacency object per pairing, shared by every state it holds in, so
  // that a state costs a list of references rather than a list of objects.
  const intraAdj: SurfaceAdjacency[] = [];
  for (const list of parts.intra) for (const p of list) intraAdj.push(adjacency(p, true));
  const crossAdj = parts.pairs.map(pair => pair.byRel.map(list => list.map(p => adjacency(p, false))));
  let lastState = -1;
  let lastAdj: SurfaceAdjacency[] = [];
  const adjOfState = (state: number): readonly SurfaceAdjacency[] => {
    if (!Number.isInteger(state) || state < 0 || state >= stateCount) {
      throw new Error(`no such state: ${state}`);
    }
    if (state === lastState) return lastAdj;
    const adj = intraAdj.slice();
    for (let i = 0; i < parts.pairs.length; i++) {
      const rel = relOfState(parts, parts.pairs[i]!, state);
      if (rel === -1) continue;
      for (const e of crossAdj[i]![rel]!) adj.push(e);
    }
    lastState = state;
    lastAdj = adj;
    return adj;
  };

  // Nothing is ever buried — that is what let the pairs decide the surface —
  // so one row of ones serves every state.
  const allVisible = new Uint8Array(cellCount).fill(1);
  const visibleCount = new Int32Array(stateCount).fill(cellCount);
  const alwaysVisible = Array.from({ length: cellCount }, (_, i) => i);

  return {
    mechanism: mech,
    cellCount,
    stateCount,
    sideStart,
    sideCount,
    classOf,
    classCount,
    classKind: kind,
    classSides,
    adjOfState,
    internalEdges,
    cutClasses,
    visibleOfState: () => allVisible,
    visibleCount,
    alwaysVisible,
    hidesCells: false,
    parts,
  };
}
