/**
 * The geometry of a mechanism, read off pairs of pieces rather than states.
 *
 * Whether two cells touch, and whether one buries the other, depends on their
 * two pieces' *relative* placement and on nothing else in the state — the rest
 * of the object is somewhere else and cannot reach them. So the whole geometry
 * is a function of `piece pair x relative placement`, of which a stack of five
 * twelve-sided rings has 120 where it has 20736 states.
 *
 * This is the same fact the search already runs on (`chain.ts`), applied one
 * layer down: there it says a state need not be visited to be scored, here it
 * says a state need not be visited to be built. Measured on that stack, the
 * welding drops from 6.2 seconds to 18 milliseconds and stops growing with the
 * state count altogether (`.dev/probe-surface-decompose.ts`).
 *
 * It holds only while nothing is ever buried. Burial is exactly what makes a
 * state more than the sum of its pairs: a side pressed against another piece
 * is taken out of the surface, and then who its partner is depends on who else
 * is there. `decomposeByPlacement` returns null the moment it sees that, and
 * the caller falls back to building the surface a state at a time.
 */

import type { Vec3 } from '../types.ts';
import type { Mechanism, Placement, Mat3 } from './types.ts';
import { applyPlacement } from './types.ts';
import { VertexWelder } from './weld.ts';

/** Two sides lying on the same segment of the surface. */
export interface Pairing {
  readonly sideA: number;
  readonly sideB: number;
  readonly cellA: number;
  readonly cellB: number;
}

/** What two pieces do to one another, at each placement they ever take up. */
export interface PlacementPair {
  readonly lower: number;
  readonly upper: number;
  /** Pairings at each distinct relative placement. */
  readonly byRel: readonly (readonly Pairing[])[];
  /** Index into `byRel` of `[lower's placement, upper's placement]`, or -1. */
  readonly relOf: Int32Array;
  /** Row length of `relOf`: how many placements the upper piece takes. */
  readonly stride: number;
}

export interface SurfaceParts {
  readonly pieceCount: number;
  readonly stateCount: number;
  /** Pairings inside one piece — the same in every state, since it is rigid. */
  readonly intra: readonly (readonly Pairing[])[];
  readonly pairs: readonly PlacementPair[];
  /** Which placement piece `p` is in in state `s`: `[s * pieceCount + p]`. */
  readonly placeOfState: Int32Array;
}

/**
 * Rounding of a placement into a key.
 *
 * Coarse against `VERTEX_EPSILON` (1e-6), so that two states naming the same
 * placement land on one key and its geometry is worked out once. Splitting one
 * placement across two keys would only cost a second weld; merging two real
 * ones would be wrong, and nothing distinguishable is this close.
 */
const QUANT = 1e-7;

function placementKey(p: Placement): string {
  const r = p.rot;
  const out: number[] = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) out[i * 3 + j] = Math.round(r[i]![j]! / QUANT);
  }
  for (let i = 0; i < 3; i++) out[9 + i] = Math.round(p.offset[i]! / QUANT);
  return out.join(',');
}

/** Where `b` sits as seen from `a`: `a^-1 * b`, both being rigid. */
function relativeTo(a: Placement, b: Placement): Placement {
  const ra = a.rot;
  const rb = b.rot;
  const rot: Vec3[] = [];
  for (let i = 0; i < 3; i++) {
    rot.push([
      ra[0]![i]! * rb[0]![0]! + ra[1]![i]! * rb[1]![0]! + ra[2]![i]! * rb[2]![0]!,
      ra[0]![i]! * rb[0]![1]! + ra[1]![i]! * rb[1]![1]! + ra[2]![i]! * rb[2]![1]!,
      ra[0]![i]! * rb[0]![2]! + ra[1]![i]! * rb[1]![2]! + ra[2]![i]! * rb[2]![2]!,
    ]);
  }
  const dx = b.offset[0] - a.offset[0];
  const dy = b.offset[1] - a.offset[1];
  const dz = b.offset[2] - a.offset[2];
  const offset: Vec3 = [
    ra[0]![0]! * dx + ra[1]![0]! * dy + ra[2]![0]! * dz,
    ra[0]![1]! * dx + ra[1]![1]! * dy + ra[2]![1]! * dz,
    ra[0]![2]! * dx + ra[1]![2]! * dy + ra[2]![2]! * dz,
  ];
  return { rot: rot as unknown as Mat3, offset };
}

/** A segment named by its two welded ends, in either order. */
const SEGMENT_STRIDE = 1 << 26;
function segmentKey(u: number, v: number): number {
  return u < v ? u * SEGMENT_STRIDE + v : v * SEGMENT_STRIDE + u;
}

/** One piece, indexed in its own frame so every other can be measured on it. */
interface PieceIndex {
  readonly corners: VertexWelder;
  readonly centres: VertexWelder;
  readonly sidesOfSegment: Map<number, number[]>;
  readonly intra: Pairing[];
}

function centreOf(corners: readonly Vec3[], rel: Placement | null): Vec3 {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const corner of corners) {
    const p = rel ? applyPlacement(rel, corner) : corner;
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  const n = corners.length;
  return [cx / n, cy / n, cz / n];
}

function indexPiece(
  mech: Mechanism,
  sideStart: Int32Array,
  cellOfSide: Int32Array,
  cells: readonly number[],
): PieceIndex | null {
  const corners = new VertexWelder();
  const centres = new VertexWelder();
  const sidesOfSegment = new Map<number, number[]>();
  for (const cellIndex of cells) {
    const cell = mech.cells[cellIndex]!;
    const before = centres.count;
    centres.id(centreOf(cell.corners, null));
    // Two cells of one rigid piece in the same place would be a broken
    // mechanism, and would make burial depend on more than the pair.
    if (centres.count === before) return null;
    const ids = cell.corners.map(c => corners.id(c));
    for (let s = 0; s < ids.length; s++) {
      const u = ids[s]!;
      const v = ids[(s + 1) % ids.length]!;
      if (u === v) throw new Error(`cell ${cellIndex} has a degenerate side ${s}`);
      const key = segmentKey(u, v);
      const side = sideStart[cellIndex]! + s;
      const bucket = sidesOfSegment.get(key);
      if (bucket) bucket.push(side);
      else sidesOfSegment.set(key, [side]);
    }
  }

  const intra: Pairing[] = [];
  for (const sides of sidesOfSegment.values()) {
    if (sides.length === 1) continue;
    if (sides.length !== 2) return null; // three sides of one piece on one segment
    const sideA = sides[0]!;
    const sideB = sides[1]!;
    intra.push({ sideA, sideB, cellA: cellOfSide[sideA]!, cellB: cellOfSide[sideB]! });
  }
  return { corners, centres, sidesOfSegment, intra };
}

/**
 * Sides of the upper piece lying on sides of the lower one, at one placement.
 *
 * Null where the two pieces do something the decomposition cannot answer for:
 * one buries a cell of the other, or a segment ends up carrying more than two
 * sides. Both are properties of this pair alone, so finding one here is enough
 * to send the whole build back to the state-at-a-time path.
 */
function crossPairings(
  mech: Mechanism,
  sideStart: Int32Array,
  cellOfSide: Int32Array,
  lower: PieceIndex,
  cellsUpper: readonly number[],
  rel: Placement,
): Pairing[] | null {
  const found: Pairing[] = [];
  const claimed = new Set<number>();
  for (const cellIndex of cellsUpper) {
    const cell = mech.cells[cellIndex]!;
    if (lower.centres.find(centreOf(cell.corners, rel)) !== -1) return null; // buried
    const ids = cell.corners.map(c => lower.corners.find(applyPlacement(rel, c)));
    for (let s = 0; s < ids.length; s++) {
      const u = ids[s]!;
      const v = ids[(s + 1) % ids.length]!;
      if (u === -1 || v === -1) continue; // not on this piece at all
      const bucket = lower.sidesOfSegment.get(segmentKey(u, v));
      if (!bucket) continue;
      if (bucket.length !== 1) return null; // a line inside the lower piece, met from outside
      const sideLower = bucket[0]!;
      if (claimed.has(sideLower)) return null; // two sides of the upper piece on one segment
      claimed.add(sideLower);
      found.push({
        sideA: sideLower,
        sideB: sideStart[cellIndex]! + s,
        cellA: cellOfSide[sideLower]!,
        cellB: cellIndex,
      });
    }
  }
  return found;
}

/** A side already spoken for by its own piece, and so by no other. */
const INTRA = -2;

/**
 * The mechanism's geometry as pieces and pairs, or null if it does not keep.
 *
 * Null means one of three things, all of them about the object rather than
 * about this code: a cell is buried in some state; three sides meet on one
 * segment; or a side has partners on two different pieces, which would let a
 * state pick two of them at once. Every one of those makes a state more than
 * the sum of its pairs.
 */
export function decomposeByPlacement(mech: Mechanism, sideStart: Int32Array): SurfaceParts | null {
  const pieceCount = mech.pieceCount;
  const stateCount = mech.states.length;
  if (pieceCount < 1 || stateCount === 0) return null;

  const cellCount = mech.cells.length;
  const sideCount = sideStart[cellCount]!;
  const cellOfSide = new Int32Array(sideCount);
  for (let cell = 0; cell < cellCount; cell++) {
    for (let side = sideStart[cell]!; side < sideStart[cell + 1]!; side++) cellOfSide[side] = cell;
  }

  const cellsOfPiece: number[][] = Array.from({ length: pieceCount }, () => []);
  for (let cell = 0; cell < cellCount; cell++) {
    const piece = mech.cells[cell]!.piece;
    if (piece < 0 || piece >= pieceCount) {
      throw new Error(`cell ${cell} is on piece ${piece}, which the mechanism does not have`);
    }
    cellsOfPiece[piece]!.push(cell);
  }

  // --- 1. the placements each piece takes up ------------------------------
  const placements: Placement[][] = Array.from({ length: pieceCount }, () => []);
  const placeIds: Map<string, number>[] = Array.from({ length: pieceCount }, () => new Map());
  const placeOfState = new Int32Array(stateCount * pieceCount);
  for (let s = 0; s < stateCount; s++) {
    const state = mech.states[s]!;
    for (let p = 0; p < pieceCount; p++) {
      const placement = state[p];
      if (!placement) throw new Error(`state ${s} is missing a placement for piece ${p}`);
      const key = placementKey(placement);
      let id = placeIds[p]!.get(key);
      if (id === undefined) {
        id = placements[p]!.length;
        placeIds[p]!.set(key, id);
        placements[p]!.push(placement);
      }
      placeOfState[s * pieceCount + p] = id;
    }
  }

  // --- 2. each piece indexed once, in its own frame ------------------------
  const source = new Int32Array(sideCount).fill(-1);
  const indexes: PieceIndex[] = [];
  const intra: Pairing[][] = [];
  for (let p = 0; p < pieceCount; p++) {
    const index = indexPiece(mech, sideStart, cellOfSide, cellsOfPiece[p]!);
    if (!index) return null;
    for (const pair of index.intra) {
      source[pair.sideA] = INTRA;
      source[pair.sideB] = INTRA;
    }
    indexes.push(index);
    intra.push(index.intra);
  }

  // --- 3. which placement pairs the states actually put the pieces in ------
  // Integer marking rather than keys: this is the one pass still proportional
  // to the state count, and it is what a lazy `Mechanism.states` would remove.
  interface Slot {
    readonly lower: number;
    readonly upper: number;
    readonly stride: number;
    readonly occurs: Uint8Array;
  }
  const slots: Slot[] = [];
  for (let p = 0; p < pieceCount; p++) {
    for (let q = p + 1; q < pieceCount; q++) {
      const stride = placements[q]!.length;
      slots.push({ lower: p, upper: q, stride, occurs: new Uint8Array(placements[p]!.length * stride) });
    }
  }
  for (let s = 0; s < stateCount; s++) {
    const base = s * pieceCount;
    for (const slot of slots) {
      slot.occurs[placeOfState[base + slot.lower]! * slot.stride + placeOfState[base + slot.upper]!] = 1;
    }
  }

  // --- 4. the geometry, once per (pair, relative placement) ----------------
  const pairs: PlacementPair[] = [];
  for (let i = 0; i < slots.length; i++) {
    const { lower, upper, stride, occurs } = slots[i]!;
    const relOf = new Int32Array(occurs.length).fill(-1);
    const byRel: Pairing[][] = [];
    const relIds = new Map<string, number>();
    for (let a = 0; a < placements[lower]!.length; a++) {
      for (let b = 0; b < stride; b++) {
        if (!occurs[a * stride + b]) continue;
        const rel = relativeTo(placements[lower]![a]!, placements[upper]![b]!);
        const key = placementKey(rel);
        let relIndex = relIds.get(key);
        if (relIndex === undefined) {
          const found = crossPairings(
            mech, sideStart, cellOfSide, indexes[lower]!, cellsOfPiece[upper]!, rel,
          );
          if (!found) return null;
          for (const pairing of found) {
            // A side whose partner is on two different pieces would have two
            // partners in a state that put both there, and the pair it belongs
            // to would no longer decide what happens to it.
            if (source[pairing.sideA] !== -1 && source[pairing.sideA] !== i) return null;
            if (source[pairing.sideB] !== -1 && source[pairing.sideB] !== i) return null;
            source[pairing.sideA] = i;
            source[pairing.sideB] = i;
          }
          relIndex = byRel.length;
          byRel.push(found);
          relIds.set(key, relIndex);
        }
        relOf[a * stride + b] = relIndex;
      }
    }
    pairs.push({ lower, upper, byRel, relOf, stride });
  }

  return { pieceCount, stateCount, intra, pairs, placeOfState };
}

/** Which relative placement a pair of pieces is at in one state, or -1. */
export function relOfState(parts: SurfaceParts, pair: PlacementPair, state: number): number {
  const base = state * parts.pieceCount;
  const a = parts.placeOfState[base + pair.lower]!;
  const b = parts.placeOfState[base + pair.upper]!;
  return pair.relOf[a * pair.stride + b]!;
}

/** The pairings between one pair of pieces in one state, or none. */
export function pairingsOfState(parts: SurfaceParts, pair: PlacementPair, state: number): readonly Pairing[] {
  const rel = relOfState(parts, pair, state);
  return rel === -1 ? [] : pair.byRel[rel]!;
}
