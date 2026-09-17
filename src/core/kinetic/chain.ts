/**
 * A turning mechanism seen as what it is: a line of pieces on one axis.
 *
 * Everything that turns — a stack of rings on a dowel, two solids glued at a
 * face, a solid cut open on a seam and its cap turned — is a *path*. The
 * pieces sit in a row, a seam joins each piece to the next, and each seam
 * turns on its own. Three things follow, and all three are measured rather
 * than assumed (`.dev/probe-turn-chain.ts`):
 *
 *   1. nothing is ever buried, so the blocks a design cuts each piece into are
 *      the same in every state; only which blocks a seam joins can change;
 *   2. the seams join consecutive pieces and nothing else;
 *   3. the passages at a seam depend on that seam's own relative turn and on
 *      no other, so the states are exactly the tuples of per-seam turns.
 *
 * Together those say a state is not an atom to be enumerated. A stack of six
 * twelve-sided rings has 248832 of them and five seams of twelve turns each,
 * and the second number is the one the work should scale with. `chainCost`
 * scores all of the states by walking the line once, so the search never asks
 * for a state at all.
 *
 * `chainOf` returns null rather than throwing when a surface is not like this:
 * the folding ring is not, and neither is anything that buries a cell.
 */

import type { KineticSurface } from './surface.ts';
import type { PlacementPair, SurfaceParts } from './placement-pairs.ts';

export interface ChainSeam {
  /** The two pieces this seam joins, in the order the chain visits them. */
  readonly lower: number;
  readonly upper: number;
  /**
   * Passages at this seam, one flat array per relative turn: `a, b, classId`.
   *
   * Flat because the cost pass walks it once per turn per candidate design,
   * which is the innermost loop in the whole search.
   */
  readonly byTurn: readonly Int32Array[];
}

export interface Chain {
  /** Pieces in the order the line visits them. */
  readonly pieceOrder: readonly number[];
  /** One per seam, in the same order: seam i joins pieceOrder[i], [i+1]. */
  readonly seams: readonly ChainSeam[];
  /** Turn each seam is at, in each state: `turnOfState[s * seams + i]`. */
  readonly turnOfState: Int32Array;
  /** The state a tuple of per-seam turns names. */
  stateOfTurns(turns: readonly number[]): number;
  readonly stateCount: number;
}

/** Cut adjacencies of one state, grouped by the pair of pieces they join. */
function seamKey(lower: number, upper: number): string {
  return `${lower}:${upper}`;
}

/**
 * Worked out once per surface.
 *
 * Reading the line off a surface costs a pass over every state's passages,
 * which is small beside building the surface but not nothing, and a rebuild
 * asks for it twice: once to choose the search and once inside it.
 */
const known = new WeakMap<KineticSurface, Chain | null>();

/**
 * The line a surface's pieces sit in, or null when they do not sit in one.
 *
 * Read off the surface rather than off the mechanism, so a mechanism added
 * later needs no new code here: what makes something a chain is where its
 * seams are, and the surface already knows.
 */
export function chainOf(surface: KineticSurface): Chain | null {
  const had = known.get(surface);
  if (had !== undefined) return had;
  const found = findChain(surface);
  known.set(surface, found);
  return found;
}

/**
 * The line, read off the pieces rather than off the states.
 *
 * A seam of a turning mechanism *is* a pair of pieces and one of its turns
 * *is* a relative placement, so when the surface was built out of those
 * (`placement-pairs.ts`) the line is already there to be read: which pairs
 * ever touch says where the seams are, and how many placements a pair takes
 * says how many turns the seam has. All that is left to check is the thing
 * that makes the states a product — that a tuple of turns names exactly one
 * state — and that is integer work, no passage grouping at all.
 */
function chainFromParts(surface: KineticSurface, parts: SurfaceParts): Chain | null {
  const pieceCount = parts.pieceCount;
  if (pieceCount < 2) return null;

  // A seam inside one piece would put the partition into blocks in a seam's
  // hands as well; the pairs cannot produce one, but say so out loud.
  for (const list of parts.intra) {
    for (const p of list) {
      if (surface.classKind[surface.classOf[p.sideA]!] === 'cut') return null;
    }
  }

  const joints = parts.pairs.filter(pair => pair.byRel.some(list => list.length > 0));
  if (joints.length !== pieceCount - 1) return null;

  const near: number[][] = Array.from({ length: pieceCount }, () => []);
  for (const joint of joints) {
    near[joint.lower]!.push(joint.upper);
    near[joint.upper]!.push(joint.lower);
  }
  if (near.some(list => list.length > 2)) return null;
  const ends = near.map((list, p) => [p, list.length] as const).filter(([, d]) => d === 1);
  if (ends.length !== 2) return null;
  const pieceOrder: number[] = [];
  const seen = new Uint8Array(pieceCount);
  let at = ends[0]![0];
  while (true) {
    pieceOrder.push(at);
    seen[at] = 1;
    const next = near[at]!.find(p => !seen[p]);
    if (next === undefined) break;
    at = next;
  }
  if (pieceOrder.length !== pieceCount) return null;

  const jointOf = new Map<string, PlacementPair>();
  for (const joint of joints) jointOf.set(seamKey(joint.lower, joint.upper), joint);
  const seamCount = pieceCount - 1;
  const ordered: PlacementPair[] = [];
  for (let i = 0; i < seamCount; i++) {
    const lower = Math.min(pieceOrder[i]!, pieceOrder[i + 1]!);
    const upper = Math.max(pieceOrder[i]!, pieceOrder[i + 1]!);
    const joint = jointOf.get(seamKey(lower, upper));
    if (!joint) return null;
    ordered.push(joint);
  }

  // A turn is a relative placement, so the passages of each are already
  // grouped; all that is needed is the pair of cells and the class.
  const byTurn: Int32Array[][] = ordered.map(joint =>
    joint.byRel.map(list => {
      const flat: number[] = [];
      for (const p of list) flat.push(p.cellA, p.cellB, surface.classOf[p.sideA]!);
      return Int32Array.from(flat);
    }),
  );

  const turnOfState = new Int32Array(surface.stateCount * seamCount);
  for (let s = 0; s < surface.stateCount; s++) {
    const base = s * pieceCount;
    for (let i = 0; i < seamCount; i++) {
      const joint = ordered[i]!;
      const a = parts.placeOfState[base + joint.lower]!;
      const b = parts.placeOfState[base + joint.upper]!;
      const rel = joint.relOf[a * joint.stride + b]!;
      if (rel === -1) return null; // two pieces of a seam that miss each other
      turnOfState[s * seamCount + i] = rel;
    }
  }

  return assemble(surface, pieceOrder, byTurn, turnOfState);
}

function findChain(surface: KineticSurface): Chain | null {
  // A buried cell would make the blocks depend on the state, and then the
  // whole reduction below is false rather than merely slow.
  if (surface.hidesCells) return null;
  if (surface.stateCount === 0) return null;
  if (surface.parts) return chainFromParts(surface, surface.parts);

  const cells = surface.mechanism.cells;
  const pieceCount = surface.mechanism.pieceCount;
  if (pieceCount < 2) return null;

  // --- 1. which pieces does each cut class join? --------------------------
  const neighbours = new Map<string, [number, number]>();
  for (let s = 0; s < surface.stateCount; s++) {
    for (const e of surface.adjOfState(s)) {
      if (surface.classKind[e.classId] !== 'cut') continue;
      const pa = cells[e.a]!.piece;
      const pb = cells[e.b]!.piece;
      // A seam inside one piece is not a joint between two of them, and the
      // partition into blocks would then be a seam's business too.
      if (pa === pb) return null;
      const lower = Math.min(pa, pb);
      const upper = Math.max(pa, pb);
      neighbours.set(seamKey(lower, upper), [lower, upper]);
    }
  }
  if (neighbours.size !== pieceCount - 1) return null;

  // --- 2. do those joints make a path? ------------------------------------
  const near: number[][] = Array.from({ length: pieceCount }, () => []);
  for (const [lower, upper] of neighbours.values()) {
    near[lower]!.push(upper);
    near[upper]!.push(lower);
  }
  if (near.some(list => list.length > 2)) return null;
  const ends = near.map((list, p) => [p, list.length] as const).filter(([, d]) => d === 1);
  if (ends.length !== 2) return null;
  const pieceOrder: number[] = [];
  const seen = new Uint8Array(pieceCount);
  let at = ends[0]![0];
  while (true) {
    pieceOrder.push(at);
    seen[at] = 1;
    const next = near[at]!.find(p => !seen[p]);
    if (next === undefined) break;
    at = next;
  }
  if (pieceOrder.length !== pieceCount) return null;

  // --- 3. what does each seam do in each state? ---------------------------
  const seamCount = pieceCount - 1;
  const seamOfKey = new Map<string, number>();
  for (let i = 0; i < seamCount; i++) {
    const lower = Math.min(pieceOrder[i]!, pieceOrder[i + 1]!);
    const upper = Math.max(pieceOrder[i]!, pieceOrder[i + 1]!);
    seamOfKey.set(seamKey(lower, upper), i);
  }

  const turnOfState = new Int32Array(surface.stateCount * seamCount).fill(-1);
  const turnsOfSeam: Int32Array[][] = Array.from({ length: seamCount }, () => []);
  const turnIndex: Map<string, number>[] = Array.from({ length: seamCount }, () => new Map());

  for (let s = 0; s < surface.stateCount; s++) {
    const perSeam: number[][] = Array.from({ length: seamCount }, () => []);
    for (const e of surface.adjOfState(s)) {
      if (surface.classKind[e.classId] !== 'cut') continue;
      const pa = cells[e.a]!.piece;
      const pb = cells[e.b]!.piece;
      const seam = seamOfKey.get(seamKey(Math.min(pa, pb), Math.max(pa, pb)));
      if (seam === undefined) return null;
      // Ordered by piece so the same passage reads the same way every time.
      const lower = pa < pb ? e.a : e.b;
      const upper = pa < pb ? e.b : e.a;
      perSeam[seam]!.push(lower, upper, e.classId);
    }
    for (let i = 0; i < seamCount; i++) {
      const flat = perSeam[i]!;
      // Sorted by triple, so the key names the set and not the order it came in.
      const triples: [number, number, number][] = [];
      for (let k = 0; k < flat.length; k += 3) {
        triples.push([flat[k]!, flat[k + 1]!, flat[k + 2]!]);
      }
      triples.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
      const key = triples.map(t => t.join(',')).join(';');
      let turn = turnIndex[i]!.get(key);
      if (turn === undefined) {
        turn = turnsOfSeam[i]!.length;
        turnIndex[i]!.set(key, turn);
        turnsOfSeam[i]!.push(Int32Array.from(triples.flat()));
      }
      turnOfState[s * seamCount + i] = turn;
    }
  }

  return assemble(surface, pieceOrder, turnsOfSeam, turnOfState);
}

/**
 * The line, once its seams and their turns are known.
 *
 * The check that matters is the last one: every combination of turns has to
 * name one state and every state a distinct combination. Without it the seams
 * are not independent, and a walk along the line would score states the
 * mechanism cannot be put in.
 */
function assemble(
  surface: KineticSurface,
  pieceOrder: readonly number[],
  turnsOfSeam: readonly (readonly Int32Array[])[],
  turnOfState: Int32Array,
): Chain | null {
  const seamCount = turnsOfSeam.length;
  let product = 1;
  for (let i = 0; i < seamCount; i++) product *= turnsOfSeam[i]!.length;
  if (product !== surface.stateCount) return null;

  const stateOfTurns = new Int32Array(product).fill(-1);
  const place: number[] = [];
  let step = 1;
  for (let i = 0; i < seamCount; i++) {
    place.push(step);
    step *= turnsOfSeam[i]!.length;
  }
  for (let s = 0; s < surface.stateCount; s++) {
    let index = 0;
    for (let i = 0; i < seamCount; i++) index += turnOfState[s * seamCount + i]! * place[i]!;
    if (stateOfTurns[index] !== -1) return null; // two states, one tuple
    stateOfTurns[index] = s;
  }
  if (stateOfTurns.some(v => v === -1)) return null;

  const seams: ChainSeam[] = [];
  for (let i = 0; i < seamCount; i++) {
    seams.push({
      lower: pieceOrder[i]!,
      upper: pieceOrder[i + 1]!,
      byTurn: turnsOfSeam[i]!,
    });
  }

  return {
    pieceOrder,
    seams,
    turnOfState,
    stateCount: surface.stateCount,
    stateOfTurns(turns: readonly number[]): number {
      let index = 0;
      for (let i = 0; i < seamCount; i++) index += (turns[i] ?? 0) * place[i]!;
      const state = stateOfTurns[index];
      if (state === undefined || state === -1) throw new Error(`no state for turns ${turns.join(',')}`);
      return state;
    },
  };
}
