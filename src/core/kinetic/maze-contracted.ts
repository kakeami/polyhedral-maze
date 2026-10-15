/**
 * The same search as `searchAllStates`, over the design the object has rather
 * than over one boolean per side class.
 *
 * `optimizeForStates` treats a design as N unrelated switches — 4256 of them
 * at seven cells across a face of the folding ring — and scores a move by
 * rebuilding every state's union-find over every cell. Neither is what the
 * object is. Three things are true of it, and all three are read off the
 * surface rather than assumed:
 *
 *  1. An internal class joins two cells of the same **patch** — a piece of
 *     surface whose cells are all reachable from one another along internal
 *     classes — and on the mechanisms that bury cells, a patch goes under
 *     whole or not at all. So the open internal classes of a patch are a
 *     spanning forest of it in *every* state it is on show in.
 *  2. Feasibility therefore depends on them only through the partition of the
 *     patch into connected **blocks**. Which tree is drawn inside a block is
 *     free: re-tree every block of a design and it is a perfect maze in
 *     exactly the states it was before.
 *  3. So a state is a perfect maze iff its *contracted* graph — one node per
 *     block of a visible patch, one edge per open seam passage — is a tree.
 *     At seven cells a face that is about 106 nodes and 57 edges against 2352
 *     cells and 2351 edges.
 *
 * What follows is a different search rather than a faster one. The cost
 * function and the acceptance rule are the ones `optimizeForStates` uses, but
 * a move is a repair aimed at a state that fails — cut a block where a loop
 * runs through it, join two blocks across a gap — instead of a coin flip, and
 * "open a wall inside a block", which is a fifth of what a coin flip proposes
 * and always an instant cycle, is not a move at all.
 *
 * It is much colder, and that is not a tuning detail: at the temperature the
 * cell-level search anneals from, moves this purposeful are a random walk over
 * good designs and it finds nothing. See `temperature`.
 *
 * On a mechanism that folds, that anneal is now the fallback and not the
 * search (2026-10-15). Watched attempt by attempt, it got within two or three
 * of a design inside a thousand steps and then stood still for the other
 * nineteen thousand, and 58 of 59 failed attempts stood still on the same
 * thing: the *count*. A state is a tree only if its blocks on show number one
 * more than its open seam passages, which is one linear equation per state
 * over the block counts of the patches — and a single move changes the count
 * in every state the patch or seam is live in, four to eight of ten, so the
 * repairs that fix one state's count break another's for ever. The folding
 * strategy (`attemptNeutral`) therefore solves the count equations exactly
 * before it anneals, and then moves only in pairs whose effect on every
 * count cancels — a split and a merge in patches of one visibility class, two
 * seams of equal pair counts swapped — so the counts never go wrong again, and
 * the cost is pure connectivity. A state left with one cycle and one gap is
 * the one shape no pair of aimed atoms reaches by chance, so that case is
 * searched exhaustively (`exactExit`). Measured over every object the folding
 * page offers, seeds 1-8 at four, seven and ten cells across a face: every
 * seed found, 6-11 times faster than the repair anneal, and the attempts that
 * fail stop at the plateau rather than at the iteration cap.
 *
 * The same equations decide something the search could not: the star cube
 * with its four hooks has *no* design. Two of its hooks show, between them,
 * exactly the faces its cube, its star and one plank show between them, and
 * carry the same passages at every seam — but two trees want two edges fewer
 * than nodes, and three trees want three. See `countsAreConsistent`.
 */

import type { Rng } from '../prng.ts';
import type { KineticSurface } from './surface.ts';
import { chooseCutClasses, treeRate } from './maze.ts';
import type { KineticDesign, TreeRate } from './maze.ts';
import { chainOf } from './chain.ts';
import type { Chain } from './chain.ts';
import { chainBlocks, chainScore } from './chain-cost.ts';
import type { ChainBlocks } from './chain-cost.ts';

export interface ContractedSearchOptions {
  readonly rng: Rng;
  /** Annealing steps in one attempt. */
  readonly iterations?: number;
  /**
   * Fresh starts inside one attempt, and one by default.
   *
   * The cell-level search takes four, because there an attempt that fails has
   * usually failed for good and starting over is the only move left. Here an
   * attempt succeeds about a quarter to a third of the time and attempts are
   * independent, so four of them inside one attempt buy no more than four
   * attempts do — and they buy it in a single stretch of arithmetic with
   * nothing drawn in the middle of it, which on a page is the whole of how
   * responsive this feels. Measured over 360 seeds across every ruling the
   * folding page offers, one restart and four take the same total time; one
   * restart keeps the longest gap between two repaints under half a second
   * where four put it over a second. Raising it is for a caller with no screen
   * to keep alive.
   */
  readonly restarts?: number;
  /**
   * Starting temperature, and a fraction of the cell-level search's five.
   *
   * The two numbers measure different things. There a move is a coin flip over
   * every class, most of which the states have no opinion about, so the
   * schedule has to be hot enough to keep the few that matter moving; here
   * every move already answers a complaint, and the same heat throws away the
   * answer. Measured on the folding ring at four cells across a face, 24
   * seeds: 12 come back at 0.15, 19 at 0.3, 24 at 0.6 and at 0.8, 24 at 1.2 in
   * twice the time, and none at all at 5.
   */
  readonly temperature?: number;
  /** Attempts before giving up. Each is `restarts` anneals of `iterations`. */
  readonly maxRounds?: number;
  /**
   * Seam openings to hold fixed, instead of choosing and annealing them.
   *
   * On the folding ring the seam set has to be free to move: a face is buried
   * in some poses and on show in others, so where the surface crosses from one
   * cube to the next is half of the arrangement. A mechanism that turns buries
   * nothing, and there the seam set is not the search's to choose — it is the
   * caller's `k`, how many passages cross a seam over the minimum, which is
   * what a visitor feels as difficulty. Passing it here freezes it, and the
   * blocks carry the whole of the arrangement.
   */
  readonly openCutClasses?: readonly number[];
}

export interface ContractedResult {
  readonly design: KineticDesign;
  readonly rate: TreeRate;
  /** Attempts made, the successful one included. */
  readonly rounds: number;
  /** Whether it stopped because it ran out of attempts, not answers. */
  readonly exhausted: boolean;
}

export interface ContractedProgress {
  readonly rounds: number;
  readonly maxRounds: number;
  /** States that are perfect mazes under the best design found so far. */
  readonly perfectStates: number;
  readonly stateCount: number;
}

export interface ContractedSearch {
  /** Runs one attempt. Returns true when there is nothing left to try. */
  step(): boolean;
  readonly progress: ContractedProgress;
  /** The best design found so far; valid after at least one step. */
  result(): ContractedResult;
}

/**
 * The patches of a surface: cells joined by internal classes, taken as far as
 * they go.
 *
 * On the folding ring these are the 48 faces of the eight cubes; on the stack
 * they are the rings. Nothing here says so — it is where the internal classes
 * happen to reach.
 */
function findPatches(surface: KineticSurface): Int32Array[] {
  const of = new Int32Array(surface.cellCount).fill(-1);
  const near: number[][] = Array.from({ length: surface.cellCount }, () => []);
  for (const e of surface.internalEdges) {
    near[e.a]!.push(e.b);
    near[e.b]!.push(e.a);
  }
  const patches: Int32Array[] = [];
  for (let cell = 0; cell < surface.cellCount; cell++) {
    if (of[cell] !== -1) continue;
    const id = patches.length;
    const found = [cell];
    of[cell] = id;
    for (let head = 0; head < found.length; head++) {
      for (const next of near[found[head]!]!) {
        if (of[next] !== -1) continue;
        of[next] = id;
        found.push(next);
      }
    }
    // Ascending, so that a block is named by the lowest cell in it and a run
    // over a patch is a run over the cells in the order the surface has them.
    patches.push(Int32Array.from(found.sort((a, b) => a - b)));
  }
  return patches;
}

/**
 * Whether a surface is one this search can be used on at all.
 *
 * The reduction needs a patch to be on show whole or buried whole: half of one
 * showing would mean the forest drawn inside it is only half there, and the
 * block a cell is in would stop being the thing that decides what it is
 * connected to. Every mechanism built so far passes — the ones that bury
 * anything bury a flat face against another flat face — but it is a property
 * of the geometry rather than a promise, so it is checked.
 */
export function contractsCleanly(surface: KineticSurface): boolean {
  for (const patch of findPatches(surface)) {
    for (let s = 0; s < surface.stateCount; s++) {
      const visible = surface.visibleOfState(s);
      const first = visible[patch[0]!]!;
      for (const cell of patch) if (visible[cell] !== first) return false;
    }
  }
  return true;
}

interface Attempt {
  readonly open: Set<number>;
  readonly openCutClasses: number[];
  readonly cost: number;
}

/**
 * An attempt that never got started.
 *
 * `chooseCutClasses` is greedy over a shuffled list, and on a bad shuffle it
 * can fail to find any set of seam openings that joins the object in every
 * state — it says so by throwing, which is right when it is the whole of a
 * caller's plan and wrong here, where it is the first line of one attempt out
 * of dozens. So it is caught, the attempt is spent, and the next one shuffles
 * again. Measured on the folding ring, this is a few attempts in a thousand,
 * and a search that treated it as a verdict would announce failure on a maze
 * the very next attempt finds.
 */
const NOTHING: Attempt = { open: new Set(), openCutClasses: [], cost: Infinity };

/** One annealing engine, reusable across attempts on the same surface. */
interface Engine {
  attempt(rng: Rng, restarts: number): Attempt;
  /** Score against these states only; all of them are the verifier's business. */
  setStates(list: readonly number[]): void;
}

function makeEngine(
  surface: KineticSurface,
  options: {
    iterations: number;
    temperature: number;
    fixedCuts?: readonly number[];
    strategy: 'repair' | 'neutral';
  },
): Engine {
  const { iterations, temperature: startTemperature, fixedCuts, strategy } = options;
  /** With the seams held, every move is a wall and the moves that open a seam are not offered. */
  const seamsFixed = fixedCuts !== undefined;
  const patches = findPatches(surface);
  const patchCount = patches.length;
  const patchOf = new Int32Array(surface.cellCount);
  const localOf = new Int32Array(surface.cellCount);
  patches.forEach((patch, p) => {
    patch.forEach((cell, i) => {
      patchOf[cell] = p;
      localOf[cell] = i;
    });
  });
  let widest = 0;
  for (const patch of patches) widest = Math.max(widest, patch.length);
  /**
   * Patches no state ever shows. Nothing is asked of them, so they are drawn
   * once — a spanning tree, so that a face nobody can walk still looks like
   * maze wherever it is seen (on the paper, and mid-fold) — and never moved.
   */
  const unseen = new Uint8Array(patchCount).fill(1);
  for (let s = 0; s < surface.stateCount; s++) {
    const visible = surface.visibleOfState(s);
    for (let cell = 0; cell < surface.cellCount; cell++) if (visible[cell]) unseen[patchOf[cell]!] = 0;
  }

  // --- walls, by patch -----------------------------------------------------
  const walls = surface.internalEdges;
  const wallCount = walls.length;
  const wallPatch = new Int32Array(wallCount);
  const wallA = new Int32Array(wallCount);
  const wallB = new Int32Array(wallCount);
  const wallsOfPatch: number[][] = Array.from({ length: patchCount }, () => []);
  walls.forEach((e, i) => {
    wallPatch[i] = patchOf[e.a]!;
    wallA[i] = e.a;
    wallB[i] = e.b;
    wallsOfPatch[patchOf[e.a]!]!.push(i);
  });
  const wallsAtCell: number[][] = Array.from({ length: surface.cellCount }, () => []);
  for (let i = 0; i < wallCount; i++) {
    wallsAtCell[wallA[i]!]!.push(i);
    wallsAtCell[wallB[i]!]!.push(i);
  }
  const across = (wall: number, cell: number): number =>
    (wallA[wall] === cell ? wallB[wall]! : wallA[wall]!);

  // --- seams, by state -----------------------------------------------------
  const seams = surface.cutClasses;
  const seamCount = seams.length;
  const seamIndex = new Map<number, number>();
  seams.forEach((c, k) => seamIndex.set(c, k));
  /**
   * The states the anneal is scored against, which need not be all of them.
   *
   * On the folding ring they are: a patch is on show in two or three of the
   * six poses, so a move rescores two or three states and scoring the lot is
   * what the engine is built to do. A mechanism that turns buries nothing, so
   * every patch is on show in every state and every move would rescore every
   * one — which on a stack of five rings is 1296 of them per move, and is why
   * the engine was 70x slower there than the search it was meant to replace.
   *
   * So the states are a working set, in the round structure `searchAllStates`
   * uses: anneal against a few, check all of them another way, and take the
   * one that failed into the set. Indices below are positions in this list,
   * never state numbers; nothing outside the engine sees either.
   */
  let states = 0;
  const seamPairs: Int32Array[][] = [];
  let patchSeen: Uint8Array[] = [];
  let posesOfPatch: number[][] = [];
  /** The poses a move can change the score of: nothing else needs rescoring. */
  let posesOfSeam: number[][] = [];
  let nodes = new Int32Array(0);
  let costOf = new Int32Array(0);
  /** Where each state's loops were, so a move can be aimed without a second pass. */
  let loopsOf: number[][] = [];
  let everyState: number[] = [];

  // --- the design ----------------------------------------------------------
  const wallOpen = new Uint8Array(wallCount);
  const seamOpen = new Uint8Array(seamCount);
  let openSeams: number[] = [];
  /** The block a cell is in, named by the lowest cell in that block. */
  const blockRoot = new Int32Array(surface.cellCount);
  const blocks = new Int32Array(patchCount);

  /** Points the engine at a working set, and sizes everything to it. */
  const setStates = (list: readonly number[]): void => {
    states = list.length;
    seamPairs.length = 0;
    for (const s of list) {
      const buckets: number[][] = Array.from({ length: seamCount }, () => []);
      for (const e of surface.adjOfState(s)) {
        const k = seamIndex.get(e.classId);
        if (k === undefined) continue;
        buckets[k]!.push(e.a, e.b);
      }
      seamPairs.push(buckets.map(b => Int32Array.from(b)));
    }
    patchSeen = list.map(s => {
      const seen = new Uint8Array(patchCount);
      const visible = surface.visibleOfState(s);
      for (let cell = 0; cell < surface.cellCount; cell++) {
        if (visible[cell]) seen[patchOf[cell]!] = 1;
      }
      return seen;
    });
    posesOfPatch = Array.from({ length: patchCount }, () => [] as number[]);
    for (let pos = 0; pos < states; pos++) {
      for (let p = 0; p < patchCount; p++) if (patchSeen[pos]![p]) posesOfPatch[p]!.push(pos);
    }
    posesOfSeam = [];
    for (let k = 0; k < seamCount; k++) {
      const live: number[] = [];
      for (let pos = 0; pos < states; pos++) if (seamPairs[pos]![k]!.length > 0) live.push(pos);
      posesOfSeam.push(live);
    }
    // Rebuilt from the blocks as they stand, since `relabel` keeps it in step
    // from here on by the difference alone.
    nodes = new Int32Array(states);
    for (let pos = 0; pos < states; pos++) {
      let count = 0;
      for (let p = 0; p < patchCount; p++) if (patchSeen[pos]![p]) count += blocks[p]!;
      nodes[pos] = count;
    }
    costOf = new Int32Array(states);
    loopsOf = Array.from({ length: states }, () => [] as number[]);
    everyState = Array.from({ length: states }, (_unused, pos) => pos);
  };

  const queue = new Int32Array(widest);
  const relabel = (p: number): void => {
    const patch = patches[p]!;
    let found = 0;
    for (const cell of patch) blockRoot[cell] = -1;
    for (const start of patch) {
      if (blockRoot[start] !== -1) continue;
      found++;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      blockRoot[start] = start;
      while (head < tail) {
        const at = queue[head++]!;
        for (const w of wallsAtCell[at]!) {
          if (!wallOpen[w]) continue;
          const to = across(w, at);
          if (blockRoot[to] !== -1) continue;
          blockRoot[to] = start;
          queue[tail++] = to;
        }
      }
    }
    const was = blocks[p]!;
    if (found !== was) {
      blocks[p] = found;
      for (const s of posesOfPatch[p]!) nodes[s] = nodes[s]! + found - was;
    }
  };

  // --- union-find over blocks, stamped so a pass costs what it touches ------
  //
  // A pass looks at the blocks the open seams land in, which is a fraction of
  // the cells; clearing an array of every cell between passes would cost more
  // than the pass. So an entry counts as fresh unless it was written during
  // this pass.
  const ufParent = new Int32Array(surface.cellCount);
  const ufRank = new Uint8Array(surface.cellCount);
  const ufStamp = new Int32Array(surface.cellCount).fill(-1);
  let stamp = 0;
  const find = (x: number): number => {
    if (ufStamp[x] !== stamp) {
      ufStamp[x] = stamp;
      ufParent[x] = x;
      ufRank[x] = 0;
      return x;
    }
    let root = x;
    while (ufParent[root] !== root) root = ufParent[root]!;
    let node = x;
    while (ufParent[node] !== root) {
      const next = ufParent[node]!;
      ufParent[node] = root;
      node = next;
    }
    return root;
  };
  const join = (a: number, b: number): boolean => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    if (ufRank[ra]! < ufRank[rb]!) ufParent[ra] = rb;
    else if (ufRank[ra]! > ufRank[rb]!) ufParent[rb] = ra;
    else {
      ufParent[rb] = ra;
      ufRank[ra] = ufRank[ra]! + 1;
    }
    return true;
  };

  /**
   * Rescores the states a move can have touched, and returns what it cost.
   *
   * A wall belongs to one patch and a patch is on show in a few states; a seam
   * is live in a few more. Rescoring the rest is arithmetic that cannot come
   * out differently.
   */
  const rescore = (which: readonly number[]): number => {
    let delta = 0;
    for (const s of which) {
      stamp++;
      let unions = 0;
      let cycles = 0;
      const pairsOfState = seamPairs[s]!;
      const loops = loopsOf[s]!;
      loops.length = 0;
      for (const k of openSeams) {
        const pairs = pairsOfState[k]!;
        for (let i = 0; i < pairs.length; i += 2) {
          const a = pairs[i]!;
          const b = pairs[i + 1]!;
          if (join(blockRoot[a]!, blockRoot[b]!)) unions++;
          else {
            cycles++;
            loops.push(a, b, k);
          }
        }
      }
      // Gaps and loops both, exactly as `costOverStates` counts them: the
      // internal classes are a forest inside every patch by construction, so
      // nothing but a seam can close a loop and nothing but a block can be a
      // component.
      const own = nodes[s]! - 1 - unions + cycles;
      delta += own - costOf[s]!;
      costOf[s] = own;
    }
    return delta;
  };
  const scoreAll = (): number => {
    costOf.fill(0);
    rescore(everyState);
    let total = 0;
    for (let s = 0; s < states; s++) total += costOf[s]!;
    return total;
  };

  // --- moves ---------------------------------------------------------------
  const componentOf = new Map<number, number>();
  /** Which component each block of state s is in — only the gap move needs it. */
  const scan = (s: number): void => {
    stamp++;
    const pairsOfState = seamPairs[s]!;
    const roots: number[] = [];
    for (const k of openSeams) {
      const pairs = pairsOfState[k]!;
      for (let i = 0; i < pairs.length; i += 2) {
        const ra = blockRoot[pairs[i]!]!;
        const rb = blockRoot[pairs[i + 1]!]!;
        roots.push(ra, rb);
        join(ra, rb);
      }
    }
    componentOf.clear();
    for (const root of roots) componentOf.set(root, find(root));
  };

  /** Another cell of the same block that a seam passage lands on in state s. */
  const mateOf = (x: number, s: number, rng: Rng): number => {
    const root = blockRoot[x]!;
    const pairsOfState = seamPairs[s]!;
    let seen = 0;
    let picked = -1;
    for (const k of openSeams) {
      const pairs = pairsOfState[k]!;
      for (let i = 0; i < pairs.length; i += 2) {
        for (const cell of [pairs[i]!, pairs[i + 1]!]) {
          if (cell === x || blockRoot[cell] !== root) continue;
          seen++;
          if (rng.nextInt(seen) === 0) picked = cell;
        }
      }
    }
    return picked;
  };

  const cameBy = new Int32Array(widest);
  const cameFrom = new Int32Array(widest);
  /** The walls on the path between two cells of one block. */
  const pathWalls = (from: number, to: number): number[] => {
    const patch = patches[patchOf[from]!]!;
    for (const cell of patch) {
      cameBy[localOf[cell]!] = -1;
      cameFrom[localOf[cell]!] = -1;
    }
    let head = 0;
    let tail = 0;
    queue[tail++] = from;
    cameFrom[localOf[from]!] = from;
    while (head < tail) {
      const at = queue[head++]!;
      if (at === to) break;
      for (const w of wallsAtCell[at]!) {
        if (!wallOpen[w]) continue;
        const next = across(w, at);
        if (cameFrom[localOf[next]!] !== -1) continue;
        cameFrom[localOf[next]!] = at;
        cameBy[localOf[next]!] = w;
        queue[tail++] = next;
      }
    }
    const out: number[] = [];
    let at = to;
    while (at !== from) {
      const w = cameBy[localOf[at]!]!;
      if (w < 0) return [];
      out.push(w);
      at = cameFrom[localOf[at]!]!;
    }
    return out;
  };

  const failing: number[] = [];
  /**
   * A move, as the thing it touches: a wall when it is `>= 0`, the seam `~move`
   * when it is negative.
   *
   * Aimed at a state that fails, and at the way it fails. A loop is only ever
   * undone by cutting one of the blocks it runs through, so cut that block
   * between the passage that closed the loop and another passage of its own —
   * which is where the loop must have left, whichever way round it ran. A gap
   * is only ever closed by joining two things on opposite banks of it. Both
   * are an improvement *there* by construction; whether they are an
   * improvement overall is the acceptance rule's business, so the moves are
   * aimed but the distribution they anneal against is not.
   */
  const propose = (rng: Rng): number => {
    failing.length = 0;
    for (let s = 0; s < states; s++) if (costOf[s]! > 0) failing.push(s);
    if (failing.length === 0) return seamsFixed
      ? rng.nextInt(wallCount)
      : rng.nextInt(wallCount + seamCount) - seamCount;
    const s = failing[rng.nextInt(failing.length)]!;
    const loops = loopsOf[s]!;
    const mostlyGaps = costOf[s]! > (loops.length / 3) * 2;

    if (loops.length > 0 && (!mostlyGaps || rng.next() < HALF)) {
      const pick = 3 * rng.nextInt(loops.length / 3);
      // Close the seam that closed the loop: blunt, but it always works, and
      // the seam set has to be free to move or the blocks carry the whole
      // burden of the arrangement.
      if (!seamsFixed && rng.next() < CLOSE_THE_SEAM) return ~loops[pick + 2]!;
      const a = loops[pick]!;
      const b = loops[pick + 1]!;
      for (const x of rng.next() < HALF ? [a, b] : [b, a]) {
        const y = mateOf(x, s, rng);
        if (y < 0) continue;
        const path = pathWalls(x, y);
        if (path.length === 0) continue;
        return path[rng.nextInt(path.length)]!;
      }
      return rng.nextInt(wallCount);
    }

    // A gap: join two blocks of one patch that are on opposite banks of it, or
    // open a seam that spans it. Sampled rather than scanned, because while a
    // state is badly broken such walls are a large share of the closed ones.
    scan(s);
    for (let tries = 0; tries < GAP_TRIES; tries++) {
      if (!seamsFixed && rng.next() < SPAN_BY_SEAM) {
        const k = rng.nextInt(seamCount);
        if (seamOpen[k]) continue;
        const pairs = seamPairs[s]![k]!;
        for (let i = 0; i < pairs.length; i += 2) {
          const ra = componentOf.get(blockRoot[pairs[i]!]!);
          const rb = componentOf.get(blockRoot[pairs[i + 1]!]!);
          if (ra === undefined || rb === undefined || ra !== rb) return ~k;
        }
        continue;
      }
      const w = rng.nextInt(wallCount);
      if (wallOpen[w] || !patchSeen[s]![wallPatch[w]!]) continue;
      // Opening a wall whose two sides are already in one block is a cycle on
      // the spot. It is not a move here; that is the point.
      if (blockRoot[wallA[w]!] === blockRoot[wallB[w]!]) continue;
      const ra = componentOf.get(blockRoot[wallA[w]!]!);
      const rb = componentOf.get(blockRoot[wallB[w]!]!);
      if (ra === undefined || rb === undefined || ra !== rb) return w;
    }
    return seamsFixed
      ? rng.nextInt(wallCount)
      : rng.nextInt(wallCount + seamCount) - seamCount;
  };

  const touchedBy = (move: number): number[] =>
    (move < 0 ? posesOfSeam[~move]! : posesOfPatch[wallPatch[move]!]!);

  const apply = (move: number): void => {
    if (move < 0) {
      const k = ~move;
      seamOpen[k] = seamOpen[k] ? 0 : 1;
      openSeams = [];
      for (let i = 0; i < seamCount; i++) if (seamOpen[i]) openSeams.push(i);
      if (strategy === 'neutral') refreshLandings();
      return;
    }
    wallOpen[move] = wallOpen[move] ? 0 : 1;
    relabel(wallPatch[move]!);
  };

  const legal = (move: number): boolean => {
    if (move < 0) return true;
    if (unseen[wallPatch[move]!]) return false;
    if (wallOpen[move]) return true; // closing a wall always splits a block
    return blockRoot[wallA[move]!] !== blockRoot[wallB[move]!];
  };


  // --- the count-neutral strategy ------------------------------------------
  //
  // Everything below is for a mechanism that folds (`strategy === 'neutral'`):
  // the states are few, all of them are scored, and the seam set is free.

  /** Bit `s` set when the cell has an open seam passage in state s. */
  const landing = new Int32Array(surface.cellCount);
  const refreshLandings = (): void => {
    landing.fill(0);
    for (let s = 0; s < states; s++) {
      const pairsOfState = seamPairs[s]!;
      for (const k of openSeams) {
        const pairs = pairsOfState[k]!;
        for (let i = 0; i < pairs.length; i++) landing[pairs[i]!] = landing[pairs[i]!]! | (1 << s);
      }
    }
  };

  /** Patches grouped by the set of states they are on show in, and seams by their pair counts. */
  let classOfPatch = new Int32Array(0);
  let classes: number[][] = [];
  let classStates: number[][] = [];
  let visMask = new Int32Array(0);
  let pairGroupOf = new Int32Array(0);
  let pairGroups: number[][] = [];
  let indicatorSeamsOfClass: number[][] = [];
  let classified = false;
  const classify = (): void => {
    if (classified) return;
    classified = true;
    classOfPatch = new Int32Array(patchCount);
    classes = [];
    classStates = [];
    visMask = new Int32Array(patchCount);
    const byKey = new Map<string, number>();
    for (let p = 0; p < patchCount; p++) {
      const poses = posesOfPatch[p]!;
      for (const s of poses) visMask[p] = visMask[p]! | (1 << s);
      const key = poses.join(',');
      let id = byKey.get(key);
      if (id === undefined) {
        id = classes.length;
        byKey.set(key, id);
        classes.push([]);
        classStates.push(poses);
      }
      classes[id]!.push(p);
      classOfPatch[p] = id;
    }
    pairGroupOf = new Int32Array(seamCount);
    pairGroups = [];
    const groupKey = new Map<string, number>();
    for (let k = 0; k < seamCount; k++) {
      const counts: number[] = [];
      for (let s = 0; s < states; s++) counts.push(seamPairs[s]![k]!.length);
      const key = counts.join(',');
      let id = groupKey.get(key);
      if (id === undefined) {
        id = pairGroups.length;
        groupKey.set(key, id);
        pairGroups.push([]);
      }
      pairGroups[id]!.push(k);
      pairGroupOf[k] = id;
    }
    // A seam with exactly one pair in each state of a class and none elsewhere
    // changes the counts the way a split of that class does: the two cancel.
    indicatorSeamsOfClass = classes.map((_patches, v) => {
      const out: number[] = [];
      for (let k = 0; k < seamCount; k++) {
        let ok = true;
        for (let s = 0; s < states && ok; s++) {
          ok = seamPairs[s]![k]!.length / 2 === (classStates[v]!.includes(s) ? 1 : 0);
        }
        if (ok) out.push(k);
      }
      return out;
    });
  };

  /**
   * A seam set that joins the patches of every state, chosen greedily over a
   * shuffle — `chooseCutClasses`, at the patch level. The same rule (a seam is
   * kept when it joins two components in some state and closes no loop of
   * seams alone in any), a hundredth of the time: the shipped one re-unions
   * every adjacency of every state for every candidate, which at ten cells
   * across a face is 150 ms, longer than the search it is the first line of.
   */
  const seamParent = new Int32Array(surface.cellCount);
  const chooseSeams = (rng: Rng): boolean => {
    const order: number[] = [];
    for (let k = 0; k < seamCount; k++) order.push(k);
    rng.shuffle(order);
    seamOpen.fill(0);
    // Patch-level components per state (stamped union-find over patch ids,
    // kept across candidates because the greedy only ever adds).
    const root = new Int32Array(states * patchCount);
    for (let i = 0; i < root.length; i++) root[i] = i % patchCount;
    const findPatch = (s: number, p: number): number => {
      const base = s * patchCount;
      let r = p;
      while (root[base + r] !== r) r = root[base + r]!;
      let x = p;
      while (root[base + x] !== r) { const next = root[base + x]!; root[base + x] = r; x = next; }
      return r;
    };
    let components = 0;
    for (let s = 0; s < states; s++) for (let p = 0; p < patchCount; p++) if (patchSeen[s]![p]) components++;
    // Cell-level forest of the seam passages alone, per state, for the loop rule.
    const cellRoot = new Int32Array(states * surface.cellCount);
    for (let i = 0; i < cellRoot.length; i++) cellRoot[i] = i % surface.cellCount;
    const findCell = (s: number, c: number): number => {
      const base = s * surface.cellCount;
      let r = c;
      while (cellRoot[base + r] !== r) r = cellRoot[base + r]!;
      let x = c;
      while (cellRoot[base + x] !== r) { const next = cellRoot[base + x]!; cellRoot[base + x] = r; x = next; }
      return r;
    };
    void seamParent;
    for (const k of order) {
      if (components === states) break;
      let joins = 0;
      let loops = false;
      for (let s = 0; s < states && !loops; s++) {
        const pairs = seamPairs[s]![k]!;
        for (let i = 0; i < pairs.length; i += 2) {
          if (findPatch(s, patchOf[pairs[i]!]!) !== findPatch(s, patchOf[pairs[i + 1]!]!)) joins++;
          if (findCell(s, pairs[i]!) === findCell(s, pairs[i + 1]!)) { loops = true; break; }
        }
      }
      if (loops || joins === 0) continue;
      seamOpen[k] = 1;
      for (let s = 0; s < states; s++) {
        const pairs = seamPairs[s]![k]!;
        for (let i = 0; i < pairs.length; i += 2) {
          const a = findPatch(s, patchOf[pairs[i]!]!);
          const b = findPatch(s, patchOf[pairs[i + 1]!]!);
          if (a !== b) { root[s * patchCount + a] = b; components--; }
          const ca = findCell(s, pairs[i]!);
          const cb = findCell(s, pairs[i + 1]!);
          if (ca !== cb) cellRoot[s * surface.cellCount + ca] = cb;
        }
      }
    }
    openSeams = [];
    for (let i = 0; i < seamCount; i++) if (seamOpen[i]) openSeams.push(i);
    refreshLandings();
    return components === states;
  };

  /**
   * The count equations: in state q, blocks on show = seam passages + 1.
   *
   * One equation per state over the block count of every patch; summed over
   * a visibility class, a system of `states` equations in as many unknowns
   * as there are classes (14 on the infinity cube, 8 on the star cube). A
   * block must hold a landing live in every state its patch is on show in,
   * or it is an island there, which caps each patch; a patch has at least one
   * block, which floors it. Solved by depth-first search over the classes
   * with interval pruning, most-states-first — a couple of milliseconds at
   * seven cells across a face, twenty at ten.
   */
  const cap = new Int32Array(patchCount);
  const need: number[] = [];
  const classSum: number[] = [];
  const solveCounts = (rng: Rng): boolean => {
    need.length = 0;
    for (let s = 0; s < states; s++) {
      let edges = 0;
      for (const k of openSeams) edges += seamPairs[s]![k]!.length / 2;
      need.push(edges + 1);
    }
    for (let p = 0; p < patchCount; p++) {
      let fewest = Infinity;
      for (const s of posesOfPatch[p]!) {
        let landed = 0;
        for (const cell of patches[p]!) if (landing[cell]! & (1 << s)) landed++;
        fewest = Math.min(fewest, landed);
      }
      cap[p] = posesOfPatch[p]!.length === 0 ? 1 : fewest;
    }
    const V = classes.length;
    const lo = classes.map(ps => ps.length);
    const hi = classes.map(ps => ps.reduce((sum, p) => sum + cap[p]!, 0));
    for (let v = 0; v < V; v++) if (hi[v]! < lo[v]!) return false;
    const order: number[] = [];
    for (let v = 0; v < V; v++) if (classStates[v]!.length > 0) order.push(v);
    order.sort((a, b) => classStates[b]!.length - classStates[a]!.length);
    classSum.length = V;
    classSum.fill(0);
    const rem = [...need];
    const minRem = new Array<number>(states).fill(0);
    const maxRem = new Array<number>(states).fill(0);
    for (const v of order) for (const s of classStates[v]!) { minRem[s] = minRem[s]! + lo[v]!; maxRem[s] = maxRem[s]! + hi[v]!; }
    let visited = 0;
    const dfs = (i: number): boolean => {
      if (++visited > SOLVE_LIMIT) return false;
      if (i === order.length) return rem.every(r => r === 0);
      const v = order[i]!;
      const st = classStates[v]!;
      for (const s of st) { minRem[s] = minRem[s]! - lo[v]!; maxRem[s] = maxRem[s]! - hi[v]!; }
      let a = lo[v]!;
      let b = hi[v]!;
      for (const s of st) { a = Math.max(a, rem[s]! - maxRem[s]!); b = Math.min(b, rem[s]! - minRem[s]!); }
      const span = b - a + 1;
      // From a random point of the range, so that two attempts on one seam set
      // do not land on the same block counts.
      const offset = span > 0 ? rng.nextInt(span) : 0;
      for (let j = 0; j < span; j++) {
        const x = a + ((j + offset) % span);
        classSum[v] = x;
        for (const s of st) rem[s] = rem[s]! - x;
        if (dfs(i + 1)) return true;
        for (const s of st) rem[s] = rem[s]! + x;
      }
      for (const s of st) { minRem[s] = minRem[s]! + lo[v]!; maxRem[s] = maxRem[s]! + hi[v]!; }
      return false;
    };
    return dfs(0);
  };

  // repairs of one state, walls and seams kept apart
  const wallStamp = new Int32Array(wallCount).fill(-1);
  const seamStamp = new Int32Array(seamCount).fill(-1);
  let candStamp = 0;
  const pushWall = (out: number[], w: number): void => {
    if (wallStamp[w] === candStamp) return;
    wallStamp[w] = candStamp;
    out.push(w);
  };
  const pushSeam = (out: number[], k: number): void => {
    if (seamStamp[k] === candStamp) return;
    seamStamp[k] = candStamp;
    out.push(k);
  };
  const adj = new Map<number, number[]>();
  const prevRoot = new Map<number, number>();
  const prevExit = new Map<number, number>();
  const prevEntry = new Map<number, number>();
  const prevSeam = new Map<number, number>();
  /**
   * What breaks the cycle of state s that the seam passage (a,b,k) closed: a
   * wall on the tree path between where the cycle enters and leaves each block
   * it crosses (a split), or a seam it runs along (closed). The cycle is found
   * by searching the contracted graph from a's block to b's without that
   * passage; `loopsOf` names the passage and this names the rest.
   */
  const cycleRepairs = (
    s: number, a: number, b: number, k: number, outWalls: number[], outSeams: number[],
  ): void => {
    const start = blockRoot[a]!;
    const goal = blockRoot[b]!;
    pushSeam(outSeams, k);
    const takeWalls = (x: number, y: number): void => {
      for (const w of pathWalls(x, y)) pushWall(outWalls, w);
    };
    if (start === goal) { takeWalls(a, b); return; }
    adj.clear();
    const pairsOfState = seamPairs[s]!;
    let skipped = false;
    for (const kk of openSeams) {
      const pairs = pairsOfState[kk]!;
      for (let i = 0; i < pairs.length; i += 2) {
        const x = pairs[i]!;
        const y = pairs[i + 1]!;
        if (!skipped && kk === k && ((x === a && y === b) || (x === b && y === a))) { skipped = true; continue; }
        const rx = blockRoot[x]!;
        const ry = blockRoot[y]!;
        let lx = adj.get(rx);
        if (!lx) { lx = []; adj.set(rx, lx); }
        lx.push(ry, x, y, kk);
        let ly = adj.get(ry);
        if (!ly) { ly = []; adj.set(ry, ly); }
        ly.push(rx, y, x, kk);
      }
    }
    prevRoot.clear(); prevExit.clear(); prevEntry.clear(); prevSeam.clear();
    const bfs: number[] = [start];
    prevRoot.set(start, start);
    let found = false;
    for (let head = 0; head < bfs.length && !found; head++) {
      const at = bfs[head]!;
      const list = adj.get(at);
      if (!list) continue;
      for (let i = 0; i < list.length; i += 4) {
        const to = list[i]!;
        if (prevRoot.has(to)) continue;
        prevRoot.set(to, at);
        prevExit.set(to, list[i + 1]!);
        prevEntry.set(to, list[i + 2]!);
        prevSeam.set(to, list[i + 3]!);
        if (to === goal) { found = true; break; }
        bfs.push(to);
      }
    }
    if (!found) return;
    let at = goal;
    let exitCell = b;
    for (;;) {
      const entryCell = at === start ? a : prevEntry.get(at)!;
      takeWalls(entryCell, exitCell);
      if (at === start) break;
      pushSeam(outSeams, prevSeam.get(at)!);
      exitCell = prevExit.get(at)!;
      at = prevRoot.get(at)!;
    }
  };
  /** What closes a gap of state s: a closed wall between blocks on opposite banks, or a closed seam spanning them. */
  const gapRepairs = (s: number, outWalls: number[], outSeams: number[]): void => {
    scan(s);
    const seen = patchSeen[s]!;
    for (let p = 0; p < patchCount; p++) {
      if (!seen[p]) continue;
      for (const w of wallsOfPatch[p]!) {
        if (wallOpen[w]) continue;
        const ra = blockRoot[wallA[w]!]!;
        const rb = blockRoot[wallB[w]!]!;
        if (ra === rb) continue;
        const ca = componentOf.get(ra);
        const cb = componentOf.get(rb);
        if (ca === undefined || cb === undefined || ca !== cb) pushWall(outWalls, w);
      }
    }
    const pairsOfState = seamPairs[s]!;
    for (let k = 0; k < seamCount; k++) {
      if (seamOpen[k]) continue;
      const pairs = pairsOfState[k]!;
      for (let i = 0; i < pairs.length; i += 2) {
        const ra = blockRoot[pairs[i]!]!;
        const rb = blockRoot[pairs[i + 1]!]!;
        if (ra === rb) continue;
        const ca = componentOf.get(ra);
        const cb = componentOf.get(rb);
        if (ca === undefined || cb === undefined || ca !== cb) { pushSeam(outSeams, k); break; }
      }
    }
  };
  const spare: number[] = [];
  const splitsFor = (s: number, out: number[]): void => {
    const loops = loopsOf[s]!;
    spare.length = 0;
    for (let i = 0; i < loops.length; i += 3) cycleRepairs(s, loops[i]!, loops[i + 1]!, loops[i + 2]!, out, spare);
  };
  const seamClosesFor = (s: number, out: number[]): void => {
    const loops = loopsOf[s]!;
    spare.length = 0;
    for (let i = 0; i < loops.length; i += 3) cycleRepairs(s, loops[i]!, loops[i + 1]!, loops[i + 2]!, spare, out);
  };
  const hasGaps = (s: number): boolean => costOf[s]! - loopsOf[s]!.length / 3 > 0;
  const mergeWallsOf = (p: number, out: number[]): void => {
    for (const w of wallsOfPatch[p]!) {
      if (!wallOpen[w] && blockRoot[wallA[w]!] !== blockRoot[wallB[w]!]) out.push(w);
    }
  };
  const openWallsOf = (p: number, out: number[]): void => {
    for (const w of wallsOfPatch[p]!) if (wallOpen[w]) out.push(w);
  };
  const unionOf = (a: readonly number[], b: readonly number[]): number[] => {
    const out = [...a];
    for (const s of b) if (!out.includes(s)) out.push(s);
    return out;
  };

  const bufA: number[] = [];
  const bufB: number[] = [];
  const bufC: number[] = [];
  interface Compound { readonly m1: number; readonly m2: number; readonly which: number[]; readonly delta: number }
  /**
   * One count-neutral move, applied: two atoms whose effect on every state's
   * count cancels. The first answers a complaint of a failing state — a split
   * on one of its cycles or a merge across one of its gaps, a seam closed on
   * the cycle or opened across the gap. The second undoes what that did to
   * the counts: a merge for a split (or the reverse) in a patch of the same
   * visibility class, at random; a seam of the same pair counts, the other
   * way, for a seam.
   *
   * At random, and that was measured rather than assumed: aiming the second
   * atom at the damage the first did — the merge that mends the gap the split
   * opened in some other state — wins attempts and loses time, 2.5x on the
   * infinity cube and 1.7x on the frame loop at seven cells over sixteen
   * seeds, because every proposal then pays for a scan of the damaged states.
   */
  const proposeNeutral = (rng: Rng): Compound | null => {
    failing.length = 0;
    for (let s = 0; s < states; s++) if (costOf[s]! > 0) failing.push(s);
    if (failing.length === 0) return null;
    const s = failing[rng.nextInt(failing.length)]!;
    candStamp++;
    const loops = loopsOf[s]!.length / 3;
    const gaps = costOf[s]! - loops;
    const fixLoop = loops > 0 && (gaps === 0 || rng.next() < HALF);
    if (rng.next() < SWAP_SEAMS) {
      bufA.length = 0;
      bufB.length = 0;
      if (fixLoop) seamClosesFor(s, bufA);
      else gapRepairs(s, bufB, bufA);
      if (bufA.length > 0) {
        const k1 = bufA[rng.nextInt(bufA.length)]!;
        bufC.length = 0;
        for (const k of pairGroups[pairGroupOf[k1]!]!) if (k !== k1 && seamOpen[k] !== seamOpen[k1]) bufC.push(k);
        if (bufC.length > 0) {
          const k2 = bufC[rng.nextInt(bufC.length)]!;
          const which = unionOf(posesOfSeam[k1]!, posesOfSeam[k2]!);
          apply(~k1);
          apply(~k2);
          return { m1: ~k1, m2: ~k2, which, delta: rescore(which) };
        }
      }
      candStamp++;
    }
    bufA.length = 0;
    if (fixLoop) splitsFor(s, bufA);
    else { bufB.length = 0; gapRepairs(s, bufA, bufB); }
    if (bufA.length === 0) return null;
    const w1 = bufA[rng.nextInt(bufA.length)]!;
    const p1 = wallPatch[w1]!;
    const cls = classOfPatch[p1]!;
    const which1 = posesOfPatch[p1]!;
    apply(w1);
    const d1 = rescore(which1);
    let p2 = p1;
    if (classes[cls]!.length > 1 && rng.next() > SAME_PATCH) p2 = classes[cls]![rng.nextInt(classes[cls]!.length)]!;
    bufB.length = 0;
    if (fixLoop) mergeWallsOf(p2, bufB); // a split: now a merge
    else openWallsOf(p2, bufB); // a merge: now a split
    if (bufB.length === 0) { apply(w1); rescore(which1); return null; }
    const w2 = bufB[rng.nextInt(bufB.length)]!;
    const which = unionOf(which1, posesOfPatch[wallPatch[w2]!]!);
    apply(w2);
    return { m1: w1, m2: w2, which, delta: d1 + rescore(which) };
  };

  const exW: number[] = [];
  const exK: number[] = [];
  const gpW: number[] = [];
  const gpK: number[] = [];
  /**
   * The way off the plateau. With the counts right, a state that fails has a
   * cycle and a gap, and a single atom cannot mend one without breaking the
   * other somewhere; this tries every count-neutral pair — one atom on a cycle
   * of q, the other across a gap of q — and takes the first that lowers the
   * total by two. A few hundred evaluations; what the anneal would wander
   * towards for thousands of steps, if it got there at all.
   */
  const exactExit = (q: number, rng: Rng): number => {
    candStamp++;
    exW.length = 0;
    exK.length = 0;
    const loops = loopsOf[q]!;
    for (let i = 0; i < loops.length; i += 3) cycleRepairs(q, loops[i]!, loops[i + 1]!, loops[i + 2]!, exW, exK);
    candStamp++;
    gpW.length = 0;
    gpK.length = 0;
    gapRepairs(q, gpW, gpK);
    rng.shuffle(exW);
    rng.shuffle(gpW);
    const tryPair = (m1: number, m2: number): number => {
      const which = unionOf(touchedBy(m1), touchedBy(m2));
      apply(m1);
      apply(m2);
      const d = rescore(which);
      if (d <= -2) return d;
      apply(m2);
      apply(m1);
      rescore(which);
      return 0;
    };
    for (const w1 of exW) {
      const v = classOfPatch[wallPatch[w1]!]!;
      for (const w2 of gpW) {
        if (classOfPatch[wallPatch[w2]!] !== v) continue;
        const d = tryPair(w1, w2);
        if (d) return d;
      }
      for (const k2 of gpK) {
        if (!indicatorSeamsOfClass[v]!.includes(k2)) continue;
        const d = tryPair(w1, ~k2);
        if (d) return d;
      }
    }
    for (const k1 of exK) {
      for (const k2 of gpK) {
        if (pairGroupOf[k1] !== pairGroupOf[k2]) continue;
        const d = tryPair(~k1, ~k2);
        if (d) return d;
      }
      for (const w2 of gpW) {
        if (!indicatorSeamsOfClass[classOfPatch[wallPatch[w2]!]!]!.includes(k1)) continue;
        const d = tryPair(~k1, w2);
        if (d) return d;
      }
    }
    return 0;
  };

  const localParent = new Int32Array(widest);
  /**
   * Deals each class's blocks out to its patches, within each patch's cap,
   * and draws them: a spanning tree in every patch, cut into that many
   * blocks, each cut chosen so that both sides keep a landing in every state
   * the patch is on show in (a block without one is an island there from
   * the start). Needs the seams and the class sums in place.
   */
  const dealBlocks = (rng: Rng): void => {
    // Each class's blocks dealt out to its patches, within each patch's cap.
    const want = new Int32Array(patchCount).fill(1);
    for (let v = 0; v < classes.length; v++) {
      const ps = classes[v]!;
      let rest = classSum[v]! - ps.length;
      for (let guard = 0; rest > 0 && guard < 100000; guard++) {
        const p = ps[rng.nextInt(ps.length)]!;
        if (want[p]! < cap[p]!) { want[p]!++; rest--; }
      }
    }
    // A spanning tree in every patch, cut into that many blocks, each cut
    // chosen so that both sides keep a landing in every state the patch is
    // on show in — a block without one is an island there from the start.
    wallOpen.fill(0);
    blocks.fill(0);
    nodes.fill(0);
    for (let p = 0; p < patchCount; p++) {
      const list = [...wallsOfPatch[p]!];
      rng.shuffle(list);
      const size = patches[p]!.length;
      for (let i = 0; i < size; i++) localParent[i] = i;
      const root = (x: number): number => {
        let r = x;
        while (localParent[r] !== r) r = localParent[r]!;
        return r;
      };
      for (const w of list) {
        const ra = root(localOf[wallA[w]!]!);
        const rb = root(localOf[wallB[w]!]!);
        if (ra === rb) continue;
        localParent[ra] = rb;
        wallOpen[w] = 1;
      }
      relabel(p);
      if (unseen[p]) continue;
      const mask = visMask[p]!;
      for (let cuts = want[p]! - 1; cuts > 0; cuts--) {
        const open: number[] = [];
        openWallsOf(p, open);
        rng.shuffle(open);
        let done = false;
        for (const w of open) {
          wallOpen[w] = 0;
          relabel(p);
          let landedEverywhere = true;
          for (const start of patches[p]!) {
            if (blockRoot[start] !== start) continue;
            let m = 0;
            for (const cell of patches[p]!) if (blockRoot[cell] === start) m |= landing[cell]!;
            if ((m & mask) !== mask) { landedEverywhere = false; break; }
          }
          if (landedEverywhere) { done = true; break; }
          wallOpen[w] = 1;
          relabel(p);
        }
        if (!done && open.length > 0) { wallOpen[open[0]!] = 0; relabel(p); }
      }
    }

  };

  const attemptNeutral = (rng: Rng, restarts: number): Attempt => {
    classify();
    let bestCost = Infinity;
    let bestWalls: Uint8Array | null = null;
    let bestSeams: Uint8Array | null = null;
    for (let restart = 0; restart < restarts && bestCost > 0; restart++) {
      // A seam set the counts can be solved on. A seam set that joins every
      // state has block counts about a third of the time on the infinity cube,
      // and never on the star cube with its hooks: there the equations are
      // inconsistent for every seam set (see the test), and this is how the
      // search finds out.
      let solved = false;
      for (let tries = 0; tries < SEAM_SETS && !solved; tries++) {
        if (chooseSeams(rng)) solved = solveCounts(rng);
      }
      if (!solved) continue;
      dealBlocks(rng);
      let cost = scoreAll();
      let lastImprove = 0;
      let sinceExit = EXIT_EVERY;
      let exitEvery = EXIT_EVERY;
      for (let step = 0; step < iterations && cost > 0; step++) {
        // Not re-solved and redealt on the same seams either: that was tried
        // (an attempt stuck high is often a class-sum vector no partition
        // can connect) and it only trades attempts for longer ones — level at
        // seven cells, 70% slower at ten.
        if (step - lastImprove > PLATEAU) break;
        if (sinceExit >= exitEvery && cost <= EXIT_COST) {
          sinceExit = 0;
          let won = false;
          for (let q = 0; q < states && cost > 0; q++) {
            if (costOf[q]! > 0 && loopsOf[q]!.length > 0 && hasGaps(q)) {
              const d = exactExit(q, rng);
              if (d) { won = true; cost += d; lastImprove = step; }
            }
          }
          if (cost === 0) break;
          // A sweep that found nothing will mostly find nothing next time
          // either, until the walk has moved things: back off.
          exitEvery = won ? EXIT_EVERY : Math.min(exitEvery * 2, EXIT_EVERY * 16);
        }
        const temperature = startTemperature * (1 - step / iterations) + 0.02;
        const got = proposeNeutral(rng);
        if (!got) continue;
        if (got.delta <= 0 || rng.next() < Math.exp(-got.delta / temperature)) {
          cost += got.delta;
          sinceExit++;
          if (got.delta < 0) lastImprove = step;
          continue;
        }
        apply(got.m2);
        apply(got.m1);
        rescore(got.which);
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestWalls = Uint8Array.from(wallOpen);
        bestSeams = Uint8Array.from(seamOpen);
      }
    }
    if (!bestWalls || !bestSeams) return NOTHING;
    const open = new Set<number>();
    for (let i = 0; i < wallCount; i++) if (bestWalls[i]) open.add(walls[i]!.classId);
    const openCutClasses: number[] = [];
    for (let k = 0; k < seamCount; k++) {
      if (!bestSeams[k]) continue;
      open.add(seams[k]!);
      openCutClasses.push(seams[k]!);
    }
    return { open, openCutClasses, cost: bestCost };
  };

  const attemptByRepair = (rng: Rng, restarts: number): Attempt => {
    let cuts: number[];
    if (fixedCuts) cuts = [...fixedCuts];
    else {
      try {
        cuts = chooseCutClasses(surface, rng);
      } catch {
        return NOTHING;
      }
    }
    let bestCost = Infinity;
    let bestWalls: Uint8Array | null = null;
    let bestSeams: Uint8Array | null = null;

    for (let restart = 0; restart < restarts && bestCost > 0; restart++) {
      seamOpen.fill(0);
      for (const c of cuts) seamOpen[seamIndex.get(c)!] = 1;
      openSeams = [];
      for (let i = 0; i < seamCount; i++) if (seamOpen[i]) openSeams.push(i);

      // Every patch gets a forest, not only the ones the first state can see.
      // `generateKineticMaze` seeds the state it is aimed at and leaves the
      // rest closed, which is right where nothing is ever buried and wrong
      // here: twenty of the folding ring's 48 faces are inside the object in
      // any one pose, and they would start shattered into single cells.
      wallOpen.fill(0);
      blocks.fill(0);
      nodes.fill(0);
      for (let p = 0; p < patchCount; p++) {
        const list = [...wallsOfPatch[p]!];
        rng.shuffle(list);
        const parent = new Int32Array(patches[p]!.length).map((_unused, i) => i);
        const root = (x: number): number => {
          let r = x;
          while (parent[r] !== r) r = parent[r]!;
          return r;
        };
        for (const w of list) {
          const ra = root(localOf[wallA[w]!]!);
          const rb = root(localOf[wallB[w]!]!);
          if (ra === rb) continue;
          parent[ra] = rb;
          wallOpen[w] = 1;
        }
        relabel(p);
      }
      // Then cut each patch into about as many blocks as the seams will ask
      // for: the contracted graph needs one more node than it has edges, and
      // the edges are already settled by the seam set.
      let want = 0;
      for (let s = 0; s < states; s++) {
        let edges = 0;
        for (const k of openSeams) edges += seamPairs[s]![k]!.length / 2;
        want += (edges - nodes[s]! + 1) / nodes[s]!;
      }
      const extra = Math.max(0, Math.round(want / states));
      for (let p = 0; p < patchCount; p++) {
        if (unseen[p]) continue;
        const open = wallsOfPatch[p]!.filter(w => wallOpen[w]);
        rng.shuffle(open);
        for (let i = 0; i < extra && i < open.length; i++) wallOpen[open[i]!] = 0;
        relabel(p);
      }

      let cost = scoreAll();
      for (let step = 0; step < iterations && cost > 0; step++) {
        const temperature = startTemperature * (1 - step / iterations) + 0.02;
        let move = propose(rng);
        for (let retry = 0; retry < LEGAL_TRIES && !legal(move); retry++) move = propose(rng);
        if (!legal(move)) continue;
        const which = touchedBy(move);
        apply(move);
        const delta = rescore(which);
        if (delta <= 0 || rng.next() < Math.exp(-delta / temperature)) {
          cost += delta;
          continue;
        }
        apply(move);
        // Rescored rather than restored from a saved copy: what these states
        // carry is the loop list of the design that was just *rejected*, and
        // the next move aimed at one of them would go and cut a block that is
        // no longer in the way. It is a few states, which is still fewer than
        // the six the cell-level search rescores for every move it makes.
        rescore(which);
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestWalls = Uint8Array.from(wallOpen);
        bestSeams = Uint8Array.from(seamOpen);
      }
    }

    const open = new Set<number>();
    for (let i = 0; i < wallCount; i++) if (bestWalls![i]) open.add(walls[i]!.classId);
    const openCutClasses: number[] = [];
    for (let k = 0; k < seamCount; k++) {
      if (!bestSeams![k]) continue;
      open.add(seams[k]!);
      openCutClasses.push(seams[k]!);
    }
    return { open, openCutClasses, cost: bestCost };
  };

  return { attempt: strategy === 'neutral' ? attemptNeutral : attemptByRepair, setStates };
}

/**
 * Steps without a lower cost before an attempt is given up on.
 *
 * The folding strategy finds what it finds early: over 400 attempts on the
 * two rings of ten states, every hit came inside 3200 steps and most inside
 * 1000, and an attempt that has not moved in that long is on the plateau the
 * exact exit could not get it off. Three thousand is a tenth of the cap, and
 * what makes a failed attempt cost a tenth of what it did.
 *
 * Two ways of spending more on a stalled attempt were measured and withdrawn
 * (2026-10-15): a four-atom exit that relocates the cycle with a cost-neutral
 * pair before trying the pair exit (it relocates, and the pair exit still
 * fails: no more hits, more time), and re-solving the counts on the same seams
 * (above). On the frame loop most failed attempts stall at a cost of six to
 * thirty, out of reach of either; a fresh attempt is the better use of the
 * time.
 */
const PLATEAU = 3000;

/** Accepted moves between two sweeps of `exactExit`; doubled after a sweep that finds nothing. */
const EXIT_EVERY = 20;

/** The total cost at or under which the exact exit is tried at all. */
const EXIT_COST = 4;


/** How often the folding strategy answers a complaint with a seam swap rather than a wall exchange. */
const SWAP_SEAMS = 0.25;

/** How often the compensating atom is placed in the same patch as the first, rather than another of its class. */
const SAME_PATCH = 0.7;

/** Search nodes the count solver may visit before calling a seam set infeasible. */
const SOLVE_LIMIT = 2e6;

/** Seam sets tried for one that joins every state and has block counts, before an attempt is spent. */
const SEAM_SETS = 20;

/** How often a loop is answered by closing the seam that made it. */
const CLOSE_THE_SEAM = 0.2;

/** How often a gap is answered by opening a seam rather than joining blocks. */
const SPAN_BY_SEAM = 0.35;

/** Walls and seams to sample when looking for one that spans a gap. */
const GAP_TRIES = 24;

/** Re-proposals before a step is spent on nothing. */
const LEGAL_TRIES = 8;

/** Named only because a bare 0.5 in the middle of the aim reads as a threshold. */
const HALF = 0.5;

/**
 * States the anneal is scored against before the walk starts naming more.
 *
 * The same handful `searchAllStates` starts from, and for the same reason: a
 * design that is a maze in eight states taken at random is usually a maze in
 * most of the rest, so the ones worth the arithmetic are the ones that turn
 * out not to be.
 */
const WORKING_STATES = 8;

/** The blocks a design cuts the pieces into, as the chain walk wants them. */
function blocksOfDesign(
  surface: KineticSurface,
  chain: Chain,
  open: ReadonlySet<number>,
): ChainBlocks {
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
  const root = new Int32Array(surface.cellCount);
  for (let cell = 0; cell < surface.cellCount; cell++) root[cell] = find(cell);
  return chainBlocks(
    chain,
    cell => surface.mechanism.cells[cell]!.piece,
    surface.cellCount,
    root,
  );
}

/**
 * The same search as `contractedSearch`, one attempt at a time.
 *
 * Handed out an attempt at a time for the same reason `createAllStatesSearch`
 * is: a page has one thread, and a search that runs to completion in a single
 * call is a page that stops repainting. Attempts are independent, so what it
 * finds is exactly what the all-at-once version finds from the same seed.
 */
export function createContractedSearch(
  surface: KineticSurface,
  options: ContractedSearchOptions,
): ContractedSearch {
  if (!contractsCleanly(surface)) {
    throw new Error(
      'this surface has a patch that is half on show in some state; use searchAllStates',
    );
  }
  const { rng } = options;
  const maxRounds = options.maxRounds ?? 48;
  const restarts = options.restarts ?? 1;

  // A mechanism that turns is a line of pieces, so every state can be scored
  // by walking the line once. Then the anneal need only answer a handful of
  // them and the walk says which to answer next. A mechanism that folds is not
  // a line, and there the anneal runs against all of its poses, as it always
  // did — which is affordable because there are ten of them at most.
  const chain = chainOf(surface);
  // The count-neutral strategy wants the seam set free and every state scored
  // (it keeps a bit per state); anything else is the repair anneal.
  const strategy = !chain && options.openCutClasses === undefined && surface.stateCount <= 31
    ? 'neutral'
    : 'repair';
  const engine = makeEngine(surface, {
    iterations: options.iterations ?? 20000,
    temperature: options.temperature ?? 0.8,
    fixedCuts: options.openCutClasses,
    strategy,
  });
  const working: number[] = [];
  if (chain) {
    while (working.length < Math.min(WORKING_STATES, surface.stateCount)) {
      const s = rng.nextInt(surface.stateCount);
      if (!working.includes(s)) working.push(s);
    }
  } else {
    for (let s = 0; s < surface.stateCount; s++) working.push(s);
  }
  engine.setStates(working);

  let best: { design: KineticDesign; perfect: number; rounds: number } | null = null;
  let round = 0;
  let finished = false;

  const step = (): boolean => {
    if (finished) return true;
    if (round >= maxRounds) {
      finished = true;
      return true;
    }
    round++;
    const got = engine.attempt(rng, restarts);
    if (got.cost === Infinity) return false; // a shuffle that went nowhere
    const design: KineticDesign = {
      open: got.open,
      openCutClasses: got.openCutClasses,
      targetState: 0,
    };
    const score = chain
      ? chainScore(chain, blocksOfDesign(surface, chain, design.open), c => design.open.has(c))
      : null;
    const perfect = score ? score.perfect : treeRate(surface, design).perfect;
    if (!best || perfect > best.perfect) best = { design, perfect, rounds: round };
    if (perfect === surface.stateCount) {
      finished = true;
      return true;
    }
    // The state the walk found furthest from being a maze is the one worth
    // annealing against next; without it the anneal answers the same few
    // complaints for ever and the rest of the object never gets a hearing.
    if (score && score.witness >= 0 && !working.includes(score.witness)) {
      working.push(score.witness);
      engine.setStates(working);
    }
    return false;
  };

  return {
    step,
    get progress(): ContractedProgress {
      return {
        rounds: Math.min(round, maxRounds),
        maxRounds,
        perfectStates: best?.perfect ?? 0,
        stateCount: surface.stateCount,
      };
    },
    result(): ContractedResult {
      if (!best) {
        throw new Error(
          round === 0
            ? 'the search has not run an attempt yet'
            : strategy === 'neutral'
              ? 'no seam set has block counts that make every state a tree'
              : 'no set of cut classes joins the pieces in every state',
        );
      }
      const rate = treeRate(surface, best.design);
      return { design: best.design, rate, rounds: best.rounds, exhausted: rate.rate < 1 };
    },
  };
}

/**
 * Whether the contracted search is the one to use on this surface.
 *
 * It was once a question of arithmetic — the contracted search rescored every
 * state after every move, so a stack of five rings cost 1296 rescores a move
 * and the cell-level search beat it seventy times over. It no longer does:
 * the pieces of anything that turns sit in a line, so the anneal answers a
 * working set of states and `chainScore` checks all of them by walking the
 * line once. Measured after that change, on three seeds each: a stack of five
 * six-sided rings 115ms against 303ms, of four 52ms against 107ms, of four
 * eight-sided rings 312ms against 278ms — level at worst, and it does not get
 * worse as the states multiply, which is the point.
 *
 * So what is left to ask is whether the contraction applies at all: whether
 * every patch is buried whole or not at all (`contractsCleanly`), and whether
 * the states are few because the object folds, or factor because it turns.
 */
export function contractedSuits(surface: KineticSurface): boolean {
  if (!contractsCleanly(surface)) return false;
  return surface.hidesCells || chainOf(surface) !== null;
}

/**
 * Whether any seam set at all can satisfy the count equations.
 *
 * In state q a design is a tree only if the blocks on show number one more
 * than the open seam passages. Summed over the patches of one visibility
 * class that is one equation per state over the class sums, and the equations
 * can be dependent: on the infinity cube three planks and a cube show,
 * between them, exactly the faces two hooks, the other cube and the fourth
 * plank show. Such a
 * dependency λ (λ·A = 0 over the state-by-class incidence A) is satisfiable
 * only if the right-hand sides obey it too — Σ λ_q (E_q + 1) = 0 — and since
 * every seam's pair counts turn out to obey the same dependencies (λ·pairs = 0
 * for every seam, checked here rather than assumed), E_q drops out and what
 * is left is Σ λ_q = 0: a dependency with as many states on each side.
 *
 * The star cube with its four hooks fails this: two of its hooks show what
 * its cube, its star and one plank show together, and carry the same passages
 * at every seam, so two trees would have to have three trees' worth of edges
 * short. No design exists for it, at any ruling, and no search will find one.
 * Exact over the rationals, with BigInt.
 */
export function countsAreConsistent(surface: KineticSurface): boolean {
  const patches = findPatches(surface);
  const states = surface.stateCount;
  const posesOf = patches.map(patch => {
    const poses: number[] = [];
    for (let s = 0; s < states; s++) if (surface.visibleOfState(s)[patch[0]!]) poses.push(s);
    return poses;
  });
  const classStates: number[][] = [];
  const seen = new Set<string>();
  for (const poses of posesOf) {
    if (poses.length === 0) continue;
    const key = poses.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    classStates.push(poses);
  }
  // Pair counts of each seam class in each state.
  const seamIndex = new Map<number, number>();
  surface.cutClasses.forEach((c, k) => seamIndex.set(c, k));
  const pairs: number[][] = surface.cutClasses.map(() => new Array<number>(states).fill(0));
  for (let s = 0; s < states; s++) {
    for (const e of surface.adjOfState(s)) {
      const k = seamIndex.get(e.classId);
      if (k !== undefined) pairs[k]![s] = pairs[k]![s]! + 1;
    }
  }
  // Left null space of A (states x classes): solve Aᵀ λ = 0 by exact
  // Gauss-Jordan over fractions.
  type Q = { n: bigint; d: bigint };
  const gcd = (a: bigint, b: bigint): bigint => { let x = a < 0n ? -a : a; let y = b < 0n ? -b : b; while (y) { [x, y] = [y, x % y]; } return x || 1n; };
  const frac = (n: bigint, d: bigint = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const add = (a: Q, b: Q): Q => frac(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a: Q, b: Q): Q => frac(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a: Q, b: Q): Q => frac(a.n * b.n, a.d * b.d);
  const div = (a: Q, b: Q): Q => frac(a.n * b.d, a.d * b.n);
  const isZero = (a: Q): boolean => a.n === 0n;
  const V = classStates.length;
  const M: Q[][] = classStates.map(poses => {
    const row: Q[] = [];
    for (let s = 0; s < states; s++) row.push(frac(poses.includes(s) ? 1n : 0n));
    return row;
  });
  const pivotCols: number[] = [];
  let rank = 0;
  for (let c = 0; c < states && rank < V; c++) {
    let pivot = -1;
    for (let r = rank; r < V; r++) if (!isZero(M[r]![c]!)) { pivot = r; break; }
    if (pivot < 0) continue;
    [M[rank], M[pivot]] = [M[pivot]!, M[rank]!];
    const inv = div(frac(1n), M[rank]![c]!);
    M[rank] = M[rank]!.map(x => mul(x, inv));
    for (let r = 0; r < V; r++) {
      if (r === rank || isZero(M[r]![c]!)) continue;
      const f = M[r]![c]!;
      M[r] = M[r]!.map((x, j) => sub(x, mul(f, M[rank]![j]!)));
    }
    pivotCols.push(c);
    rank++;
  }
  for (let free = 0; free < states; free++) {
    if (pivotCols.includes(free)) continue;
    // λ with λ[free] = 1, λ[pivot] = -M[row][free], else 0.
    const lambda: Q[] = Array.from({ length: states }, () => frac(0n));
    lambda[free] = frac(1n);
    pivotCols.forEach((pc, row) => { lambda[pc] = sub(frac(0n), M[row]![free]!); });
    let sum = frac(0n);
    for (const x of lambda) sum = add(sum, x);
    for (const row of pairs) {
      let dot = frac(0n);
      for (let s = 0; s < states; s++) dot = add(dot, mul(lambda[s]!, frac(BigInt(row[s]!))));
      // A seam whose pair counts do not obey the dependency would let E_q
      // absorb it; none has been seen, and here it is the honest answer.
      if (!isZero(dot)) return true;
    }
    if (!isZero(sum)) return false;
  }
  return true;
}

/** A design that is a perfect maze in every state, or the best one found. */
export function contractedSearch(
  surface: KineticSurface,
  options: ContractedSearchOptions,
): ContractedResult {
  const search = createContractedSearch(surface, options);
  while (!search.step()) {
    // Every attempt, until it finds one or runs out of them.
  }
  return search.result();
}
