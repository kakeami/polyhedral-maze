import type { Rng } from '../prng.ts';
import { UnionFind } from '../graph.ts';
import type { KineticSurface, SurfaceAdjacency } from './surface.ts';

/**
 * A design is a set of open side classes. Because a class is shared by every
 * side that can ever meet, opening one opens the same passage in every state —
 * which is why the passage count below turns out to be state-independent.
 */
export interface KineticDesign {
  readonly open: ReadonlySet<number>;
  readonly openCutClasses: readonly number[];
  readonly targetState: number;
}

export interface StateStats {
  readonly edges: number;
  readonly components: number;
  readonly cycles: number;
  readonly perfect: boolean;
}

function openAdjacencies(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
): readonly SurfaceAdjacency[] {
  const adj = surface.adjByState[stateIndex];
  if (!adj) throw new Error(`no such state: ${stateIndex}`);
  return adj.filter(e => design.open.has(e.classId));
}

export function stateStats(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
): StateStats {
  const uf = new UnionFind<number>();
  let components = surface.cellCount;
  let cycles = 0;
  let edges = 0;
  for (const e of openAdjacencies(surface, design, stateIndex)) {
    edges++;
    if (uf.connected(e.a, e.b)) cycles++;
    else {
      uf.union(e.a, e.b);
      components--;
    }
  }
  return { edges, components, cycles, perfect: components === 1 && cycles === 0 };
}

/**
 * Picks cut classes to open, greedily, until every state has all pieces joined.
 * Fewer is better: every opening spends one unit of the spanning-tree budget,
 * so the pieces have to be internally split that much more (corollary 4).
 */
export function chooseCutClasses(surface: KineticSurface, rng: Rng): number[] {
  const pieceOf = surface.mechanism.cells.map(c => c.piece);
  const pieceCount = surface.mechanism.pieceCount;

  const pieceComponents = (open: Set<number>): number => {
    let total = 0;
    for (let s = 0; s < surface.stateCount; s++) {
      const uf = new UnionFind<number>();
      let comps = pieceCount;
      for (const e of surface.adjByState[s]!) {
        if (e.intra || !open.has(e.classId)) continue;
        const pa = pieceOf[e.a]!;
        const pb = pieceOf[e.b]!;
        if (!uf.connected(pa, pb)) {
          uf.union(pa, pb);
          comps--;
        }
      }
      total += comps;
    }
    return total;
  };

  const candidates = [...surface.cutClasses];
  rng.shuffle(candidates);
  const chosen = new Set<number>();
  let best = pieceComponents(chosen);
  const target = surface.stateCount; // every state down to a single piece-component
  for (const c of candidates) {
    if (best === target) break;
    chosen.add(c);
    const next = pieceComponents(chosen);
    if (next < best) best = next;
    else chosen.delete(c);
  }
  if (best !== target) {
    throw new Error('no set of cut classes joins the pieces in every state');
  }
  return [...chosen];
}

/**
 * Builds a design whose target state is a perfect maze.
 *
 * The openings chosen above are forced — they exist in every state — so they go
 * into the spanning tree first, and the rest of the tree is filled in from the
 * pieces' own walls. Any leftover wall stays closed, which is what leaves the
 * pieces internally split.
 */
export function generateKineticMaze(
  surface: KineticSurface,
  options: { rng: Rng; targetState?: number; openCutClasses?: readonly number[] },
): KineticDesign {
  const { rng, targetState = 0 } = options;
  const openCutClasses = options.openCutClasses ?? chooseCutClasses(surface, rng);
  const open = new Set<number>(openCutClasses);

  const uf = new UnionFind<number>();
  for (const e of surface.adjByState[targetState] ?? []) {
    if (!open.has(e.classId)) continue;
    if (uf.connected(e.a, e.b)) {
      throw new Error(
        `the forced openings already close a loop in state ${targetState}; open fewer cut classes`,
      );
    }
    uf.union(e.a, e.b);
  }

  const walls = [...surface.internalEdges];
  rng.shuffle(walls);
  for (const e of walls) {
    if (uf.connected(e.a, e.b)) continue;
    uf.union(e.a, e.b);
    open.add(e.classId);
  }

  return { open, openCutClasses: [...openCutClasses], targetState };
}

export interface TreeRate {
  /** Indices of the states that are perfect mazes. */
  readonly perfectStates: readonly number[];
  readonly rate: number;
  /** Passage count per state; constant by the edge-count invariance theorem. */
  readonly edgeCounts: readonly number[];
  readonly edgeCountInvariant: boolean;
}

/** Difficulty, measured over every state the mechanism can reach. */
export function treeRate(surface: KineticSurface, design: Pick<KineticDesign, 'open'>): TreeRate {
  const perfectStates: number[] = [];
  const edgeCounts: number[] = [];
  for (let s = 0; s < surface.stateCount; s++) {
    const stats = stateStats(surface, design, s);
    edgeCounts.push(stats.edges);
    if (stats.perfect) perfectStates.push(s);
  }
  const first = edgeCounts[0];
  return {
    perfectStates,
    rate: perfectStates.length / surface.stateCount,
    edgeCounts,
    edgeCountInvariant: edgeCounts.every(n => n === first),
  };
}

export interface DesignSearchResult {
  readonly design: KineticDesign;
  readonly treeRate: TreeRate;
  readonly attempts: number;
}

/**
 * Picks the design whose tree rate lands closest to `targetRate`.
 *
 * The target state is always a perfect maze, so the rate is never 0; what it
 * controls is how many *other* states also happen to be perfect, which is what
 * a visitor feels as difficulty. A rate near 0 means one lucky configuration
 * out of hundreds; a high rate means the object is nearly always solved.
 */
export function searchDesign(
  surface: KineticSurface,
  options: {
    rng: Rng;
    attempts?: number;
    targetRate?: number;
    targetState?: number;
    openCutClasses?: readonly number[];
  },
): DesignSearchResult {
  const attempts = options.attempts ?? 32;
  const targetRate = options.targetRate ?? 0;
  let best: DesignSearchResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const design = generateKineticMaze(surface, {
      rng: options.rng,
      targetState: options.targetState,
      openCutClasses: options.openCutClasses,
    });
    const rate = treeRate(surface, design);
    if (!best || Math.abs(rate.rate - targetRate) < Math.abs(best.treeRate.rate - targetRate)) {
      best = { design, treeRate: rate, attempts };
    }
  }
  if (!best) throw new Error('attempts must be at least 1');
  return best;
}

/**
 * Union-Find over a fixed cell count, reused across annealing steps.
 *
 * The public `UnionFind` in core/graph.ts is Map-backed and general; this one
 * exists only because the optimiser below runs it tens of thousands of times
 * over the same vertex set, where allocation dominates.
 */
class CellUnionFind {
  private readonly parent: Int32Array;
  private readonly rank: Uint8Array;
  components: number;

  constructor(private readonly size: number) {
    this.parent = new Int32Array(size);
    this.rank = new Uint8Array(size);
    this.components = size;
  }

  reset(): void {
    for (let i = 0; i < this.size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
    this.components = this.size;
  }

  find(x: number): number {
    let root = x;
    while (this.parent[root]! !== root) root = this.parent[root]!;
    let node = x;
    while (this.parent[node]! !== root) {
      const next = this.parent[node]!;
      this.parent[node] = root;
      node = next;
    }
    return root;
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    const rankA = this.rank[ra]!;
    const rankB = this.rank[rb]!;
    if (rankA < rankB) this.parent[ra] = rb;
    else if (rankA > rankB) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra] = rankA + 1;
    }
    this.components--;
    return true;
  }
}

export interface MultiStateResult {
  readonly design: KineticDesign;
  /** Sum over the target states of (components - 1). Zero means all are perfect. */
  readonly cost: number;
  readonly targetStates: readonly number[];
  readonly restarts: number;
  readonly iterations: number;
  /** Annealing steps actually taken, summed over the restarts. */
  readonly steps: number;
}

/** Sum over `states` of (components - 1) — the quantity the optimiser drives to 0. */
export function costOverStates(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  states: readonly number[],
): number {
  let cost = 0;
  for (const s of states) cost += stateStats(surface, design, s).components - 1;
  return cost;
}

/**
 * Looks for a design that is a perfect maze in *several* states at once.
 *
 * Opening a wall somewhere always closes one elsewhere, because the passage
 * count is pinned at N-1; so this swaps one open internal class for a closed
 * one and anneals on how far the target states are from being connected. The
 * cut classes are left alone — changing them would change the budget.
 *
 * A mechanism with few states (a hinged ring, a kaleidocycle) can plausibly be
 * made perfect in *every* state this way, which is the strongest form of the
 * idea: an object that is a finished maze however you fold it.
 */
export function optimizeForStates(
  surface: KineticSurface,
  options: {
    rng: Rng;
    targetStates: readonly number[];
    openCutClasses?: readonly number[];
    iterations?: number;
    restarts?: number;
    startTemperature?: number;
  },
): MultiStateResult {
  const { rng, targetStates } = options;
  const iterations = options.iterations ?? 20000;
  const restarts = options.restarts ?? 4;
  const startTemperature = options.startTemperature ?? 2.5;
  if (targetStates.length === 0) throw new Error('targetStates must not be empty');
  for (const s of targetStates) {
    if (s < 0 || s >= surface.stateCount) throw new Error(`no such state: ${s}`);
  }

  const openCutClasses = options.openCutClasses ?? chooseCutClasses(surface, rng);
  const cutSet = new Set(openCutClasses);

  // Flatten the parts of the graph the inner loop touches.
  const internal = surface.internalEdges;
  const internalA = Int32Array.from(internal, e => e.a);
  const internalB = Int32Array.from(internal, e => e.b);
  const cutPairs = targetStates.map(s => {
    const pairs: number[] = [];
    for (const e of surface.adjByState[s]!) {
      if (cutSet.has(e.classId)) pairs.push(e.a, e.b);
    }
    return Int32Array.from(pairs);
  });

  const uf = new CellUnionFind(surface.cellCount);
  const classIndexOf = new Map<number, number>();
  internal.forEach((e, i) => classIndexOf.set(e.classId, i));

  const evaluate = (openList: Int32Array): number => {
    let cost = 0;
    for (const pairs of cutPairs) {
      uf.reset();
      for (let i = 0; i < pairs.length; i += 2) uf.union(pairs[i]!, pairs[i + 1]!);
      for (const e of openList) uf.union(internalA[e]!, internalB[e]!);
      cost += uf.components - 1;
    }
    return cost;
  };

  let bestList: Int32Array | null = null;
  let bestCost = Infinity;
  let steps = 0;

  for (let restart = 0; restart < restarts && bestCost > 0; restart++) {
    const seed = generateKineticMaze(surface, {
      rng,
      targetState: targetStates[0]!,
      openCutClasses,
    });
    const openIndices: number[] = [];
    for (const classId of seed.open) {
      const index = classIndexOf.get(classId);
      if (index !== undefined) openIndices.push(index);
    }
    let current = Int32Array.from(openIndices);
    const isOpen = new Uint8Array(internal.length);
    for (const i of current) isOpen[i] = 1;
    let cost = evaluate(current);
    const trial = new Int32Array(current.length);

    for (let step = 0; step < iterations && cost > 0; step++) {
      steps++;
      const temperature = startTemperature * (1 - step / iterations) + 0.02;
      const slot = rng.nextInt(current.length);
      const leaving = current[slot]!;
      const entering = rng.nextInt(internal.length);
      if (isOpen[entering]) continue;
      trial.set(current);
      trial[slot] = entering;
      const next = evaluate(trial);
      if (next <= cost || rng.next() < Math.exp((cost - next) / temperature)) {
        isOpen[leaving] = 0;
        isOpen[entering] = 1;
        current.set(trial);
        cost = next;
      }
    }

    if (cost < bestCost) {
      bestCost = cost;
      bestList = Int32Array.from(current);
    }
  }

  const open = new Set<number>(openCutClasses);
  for (const i of bestList ?? []) open.add(internal[i]!.classId);
  return {
    design: { open, openCutClasses: [...openCutClasses], targetState: targetStates[0]! },
    cost: bestCost,
    targetStates: [...targetStates],
    restarts,
    iterations,
    steps,
  };
}

export interface StartGoal {
  readonly start: number;
  readonly goal: number;
}

/**
 * Puts the entrance and the exit on dead ends of the free rim, as far apart as
 * the maze allows.
 *
 * Dead ends are the point: a marker dropped in the middle of a corridor leaves
 * a stub of maze hanging off it that goes nowhere. Which rim each marker lands
 * on is left alone, so the pair is free to be the longest walk in the tree even
 * when that means entering and leaving near the same place.
 *
 * The cell is printed once and the object then moves, so a dead end is only
 * worth choosing if it stays one in every state. It does wherever a rim cell's
 * other sides are all internal — true of the stack, whose rings are more than
 * one cell tall. Where it is not, the choice holds for `stateIndex`.
 */
export function pickStartGoal(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open' | 'targetState'>,
  options: { stateIndex?: number } = {},
): StartGoal {
  const stateIndex = options.stateIndex ?? design.targetState;
  const adj = surface.adjByState[stateIndex];
  if (!adj) throw new Error(`no such state: ${stateIndex}`);

  const neighbours = new Map<number, number[]>();
  for (const e of adj) {
    if (!design.open.has(e.classId)) continue;
    if (!neighbours.has(e.a)) neighbours.set(e.a, []);
    if (!neighbours.has(e.b)) neighbours.set(e.b, []);
    neighbours.get(e.a)!.push(e.b);
    neighbours.get(e.b)!.push(e.a);
  }

  const onRim: number[] = [];
  for (let cell = 0; cell < surface.cellCount; cell++) {
    const from = surface.sideStart[cell]!;
    const to = surface.sideStart[cell + 1]!;
    for (let side = from; side < to; side++) {
      if (surface.classKind[surface.classOf[side]!] === 'rim') {
        onRim.push(cell);
        break;
      }
    }
  }

  // Prefer leaves: a marker in the middle of a corridor leaves a stub of maze
  // hanging off it that goes nowhere.
  const leaves = onRim.filter(c => (neighbours.get(c)?.length ?? 0) === 1);
  const candidates = leaves.length >= 2 ? leaves : onRim;
  if (candidates.length < 2) throw new Error('no candidate cells to start or finish at');

  let best: StartGoal | null = null;
  let bestDistance = -1;
  for (const from of candidates) {
    const distance = new Map<number, number>([[from, 0]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i]!;
      const d = distance.get(node)! + 1;
      for (const next of neighbours.get(node) ?? []) {
        if (distance.has(next)) continue;
        distance.set(next, d);
        queue.push(next);
      }
    }
    for (const to of candidates) {
      const d = distance.get(to);
      if (d === undefined || d <= bestDistance) continue;
      bestDistance = d;
      best = { start: from, goal: to };
    }
  }
  if (!best) throw new Error('no two candidates are joined in this state');
  return best;
}

/**
 * Opens `extra` cut classes beyond the minimum the mechanism needs.
 *
 * This is the stack's analogue of the polyhedral maze's `k`: how many passages
 * cross a seam between one piece and the next. The minimum is whatever it takes
 * to join the pieces in every state; each one above that buys another way
 * across at the price of one more island inside a piece (corollary 4), which is
 * what makes a bigger `k` a harder maze rather than an easier one.
 *
 * A candidate is only taken if the forced openings stay a forest in *every*
 * state. Two openings that close a loop would put a cycle in the maze that no
 * choice of walls could undo, and `generateKineticMaze` rightly refuses it.
 */
export function expandCutClasses(
  surface: KineticSurface,
  options: { rng: Rng; base?: readonly number[]; extra: number },
): number[] {
  const { rng, extra } = options;
  const chosen = [...(options.base ?? chooseCutClasses(surface, rng))];
  if (extra <= 0) return chosen;

  const staysForest = (open: Set<number>): boolean => {
    for (let s = 0; s < surface.stateCount; s++) {
      const uf = new UnionFind<number>();
      for (const e of surface.adjByState[s]!) {
        if (!open.has(e.classId)) continue;
        if (uf.connected(e.a, e.b)) return false;
        uf.union(e.a, e.b);
      }
    }
    return true;
  };

  const open = new Set(chosen);
  const candidates = surface.cutClasses.filter(c => !open.has(c));
  rng.shuffle(candidates);
  let added = 0;
  for (const c of candidates) {
    if (added === extra) break;
    open.add(c);
    if (staysForest(open)) {
      chosen.push(c);
      added++;
    } else {
      open.delete(c);
    }
  }
  return chosen;
}

export interface AllStatesResult {
  readonly design: KineticDesign;
  readonly rate: TreeRate;
  /** How many rounds of anneal-then-verify it took. */
  readonly rounds: number;
  /** Size of the working set the last anneal ran against. */
  readonly workingStates: number;
  /** Whether the search stopped because it ran out of budget, not answers. */
  readonly exhausted: boolean;
}

/**
 * How much arithmetic a search may spend, counted in cell-state units — one
 * unit is roughly what it costs to test one cell in one state.
 *
 * Counted rather than timed on purpose. A wall clock would make the result
 * depend on how busy the machine was, and these designs are shared as URLs: a
 * seed has to mean the same maze on a laptop as on a phone. A count of work is
 * the same everywhere, and still bounds the wait, because the cost per unit is
 * a property of the code rather than the problem.
 *
 * Note what it does *not* buy: a search that is going to succeed exits the
 * moment it does, so this is only ever spent failing. Asking for a design that
 * cannot exist — too many seam openings for the spanning-tree budget to carry
 * — is what actually spends it all, and the point of the budget is to be told
 * so in a couple of seconds instead of twenty.
 */
export const DEFAULT_SEARCH_EFFORT = 3e8;

/**
 * Iterations in one anneal. Full length or nothing, for the reason given where
 * the budget is spent; the same default `optimizeForStates` has always used.
 */
const ANNEAL_ITERATIONS = 20000;

/**
 * Finds a design that is a perfect maze in every state — the gamma version.
 *
 * `optimizeForStates` can be pointed at all of them at once, but the cost of a
 * single annealing step is proportional to how many states it scores, so that
 * spends most of its time re-checking states that were never in danger. This
 * anneals against a handful of states instead, then verifies against all of
 * them and feeds the failures back into the working set. In practice a design
 * that survives eight random states usually survives all of them, so the first
 * round is normally the last, and the search comes back three to twelve times
 * sooner.
 *
 * The exact answer is unaffected: what is returned is measured by `treeRate`
 * over every state, whatever the working set happened to be.
 */
export function searchAllStates(
  surface: KineticSurface,
  options: {
    rng: Rng;
    sampleSize?: number;
    maxRounds?: number;
    addPerRound?: number;
    restarts?: number;
    openCutClasses?: readonly number[];
    /** Cell-state units to spend; see `DEFAULT_SEARCH_EFFORT`. */
    effort?: number;
  },
): AllStatesResult {
  const { rng } = options;
  const sampleSize = options.sampleSize ?? 8;
  const maxRounds = options.maxRounds ?? 8;
  const addPerRound = options.addPerRound ?? 4;
  const restarts = options.restarts ?? 2;
  const effort = options.effort ?? DEFAULT_SEARCH_EFFORT;
  const openCutClasses = options.openCutClasses ?? chooseCutClasses(surface, rng);

  const working = new Set<number>([0]);
  while (working.size < Math.min(sampleSize, surface.stateCount)) {
    working.add(rng.nextInt(surface.stateCount));
  }

  let best: AllStatesResult | null = null;
  let spent = 0;
  for (let round = 1; round <= maxRounds; round++) {
    // The budget buys rounds, never shorter anneals. Cutting an anneal short
    // is not a cheaper search, it is a worse one: the temperature schedule is
    // laid out over the iteration count, so halving it does not halve the work
    // done, it halves the cooling — and a design a full-length anneal finds on
    // the first attempt can elude four compressed ones. Measured, the
    // compressed version failed on half the mechanisms the full-length one
    // solved, and then spent the whole budget failing.
    if (round > 1 && spent >= effort) break;

    const attempt = optimizeForStates(surface, {
      rng,
      targetStates: [...working],
      openCutClasses,
      restarts,
      iterations: ANNEAL_ITERATIONS,
    });
    // Charged for what it did, not for what it was allowed to do. A round that
    // satisfies its sample in five hundred steps and then fails the full check
    // costs almost nothing, and there is no reason to stop after one of those:
    // it is the growing working set, not the annealing, that gets there.
    spent += attempt.steps * working.size * surface.cellCount;

    const rate = treeRate(surface, attempt.design);
    if (!best || rate.perfectStates.length > best.rate.perfectStates.length) {
      best = {
        design: attempt.design, rate, rounds: round,
        workingStates: working.size, exhausted: false,
      };
    }
    if (rate.rate === 1) break;

    // Feed the states it got wrong back in, so the next anneal has to answer
    // for them. Sampling rather than adding them all keeps a step cheap.
    const perfect = new Set(rate.perfectStates);
    const failed: number[] = [];
    for (let s = 0; s < surface.stateCount; s++) if (!perfect.has(s)) failed.push(s);
    if (failed.length === 0) break;
    for (let i = 0; i < addPerRound; i++) working.add(failed[rng.nextInt(failed.length)]!);
  }
  return { ...best!, exhausted: best!.rate.rate < 1 };
}
