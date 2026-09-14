import type { Mechanism, KineticState } from './types.ts';
import { applyPlacement } from './types.ts';
import { UnionFind } from '../graph.ts';
import { VertexWelder } from './weld.ts';

export type SideClassKind =
  /** Meets a side of another piece in at least one state. */
  | 'cut'
  /** Always meets the same side of the same piece (a fold or a grid line). */
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
  readonly adjByState: readonly (readonly SurfaceAdjacency[])[];
  /** The one adjacency behind each 'internal' class — the free maze walls. */
  readonly internalEdges: readonly SurfaceAdjacency[];
  readonly cutClasses: readonly number[];
  /** 1 where the cell is on the outside of the object in that state. */
  readonly visibleByState: readonly Uint8Array[];
  /** How many cells are on the outside in each state. */
  readonly visibleCount: Int32Array;
  /** Cells on the outside in *every* state — the only places a marker can go. */
  readonly alwaysVisible: readonly number[];
  /** Whether any cell is ever hidden: false for a mechanism that never folds shut. */
  readonly hidesCells: boolean;
}

interface Pairing {
  sideA: number;
  sideB: number;
  cellA: number;
  cellB: number;
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

export function buildSurface(mech: Mechanism, options: { maxStates?: number } = {}): KineticSurface {
  const maxStates = options.maxStates ?? 4096;
  if (mech.states.length === 0) throw new Error('mechanism has no states');
  if (mech.states.length > maxStates) {
    throw new Error(
      `mechanism has ${mech.states.length} states, over the maxStates limit of ${maxStates}; ` +
        'pass a larger maxStates or sample a subset',
    );
  }

  const cellCount = mech.cells.length;
  const sideStart = new Int32Array(cellCount + 1);
  for (let i = 0; i < cellCount; i++) {
    sideStart[i + 1] = sideStart[i]! + mech.cells[i]!.corners.length;
  }
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

  const pairsByState = mech.states.map((state, index) =>
    pairSides(mech, state, sideStart, visibleByState[index]!),
  );

  // One design boolean per class: sides that ever meet must agree (L0).
  const uf = new UnionFind<number>();
  for (let s = 0; s < sideCount; s++) uf.find(s);
  for (const pairs of pairsByState) {
    for (const p of pairs) uf.union(p.sideA, p.sideB);
  }

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
  const classCount = classSides.length;

  const kind: SideClassKind[] = new Array(classCount).fill('rim');
  const adjByState: SurfaceAdjacency[][] = [];
  for (const pairs of pairsByState) {
    const adj: SurfaceAdjacency[] = [];
    for (const p of pairs) {
      const classId = classOf[p.sideA]!;
      const intra = mech.cells[p.cellA]!.piece === mech.cells[p.cellB]!.piece;
      if (!intra) kind[classId] = 'cut';
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
    adjByState,
    internalEdges,
    cutClasses,
    visibleByState,
    visibleCount,
    alwaysVisible,
    hidesCells: alwaysVisible.length < cellCount,
  };
}
