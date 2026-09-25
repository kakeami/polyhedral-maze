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
  options: { iterations: number; temperature: number; fixedCuts?: readonly number[] },
): Engine {
  const { iterations, temperature: startTemperature, fixedCuts } = options;
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

  const attempt = (rng: Rng, restarts: number): Attempt => {
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

  return { attempt, setStates };
}

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
  const engine = makeEngine(surface, {
    iterations: options.iterations ?? 20000,
    temperature: options.temperature ?? 0.8,
    fixedCuts: options.openCutClasses,
  });

  // A mechanism that turns is a line of pieces, so every state can be scored
  // by walking the line once. Then the anneal need only answer a handful of
  // them and the walk says which to answer next. A mechanism that folds is not
  // a line, and there the anneal runs against all of its poses, as it always
  // did — which is affordable because there are six of them.
  const chain = chainOf(surface);
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
