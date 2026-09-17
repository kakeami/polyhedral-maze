import type { Rng } from '../prng.ts';
import { UnionFind } from '../graph.ts';
import type { KineticSurface, SurfaceAdjacency } from './surface.ts';
import type { Chain } from './chain.ts';
import { chainOf } from './chain.ts';
import type { ChainBlocks } from './chain-cost.ts';
import { chainBlocks, chainScore } from './chain-cost.ts';

/**
 * Blocks of the cells, with the internal classes a design leaves open already
 * joined up, ready for a walk along the line (`chain-cost.ts`).
 *
 * Everything that asks a question about *every* state goes through here: on a
 * mechanism whose pieces sit in a line, a walk answers it without visiting a
 * state, and the two questions asked below — how many pieces the maze falls
 * into, and whether the seams alone close a loop — are the ones that used to
 * cost a pass over every state apiece.
 */
function blocksOfDesign(
  surface: KineticSurface,
  chain: Chain,
  isOpenInternal: (classId: number) => boolean,
): ChainBlocks {
  const parent = new Int32Array(surface.cellCount);
  for (let cell = 0; cell < surface.cellCount; cell++) parent[cell] = cell;
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root] = parent[parent[root]!]!;
    return root;
  };
  for (const e of surface.internalEdges) {
    if (!isOpenInternal(e.classId)) continue;
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) parent[ra] = rb;
  }
  const root = new Int32Array(surface.cellCount);
  for (let cell = 0; cell < surface.cellCount; cell++) root[cell] = find(cell);
  return chainBlocks(chain, cell => surface.mechanism.cells[cell]!.piece, surface.cellCount, root);
}

/**
 * The two block sets that do not depend on the design, worked out once.
 *
 * `patches` has every internal class open — the pieces cut into the patches of
 * surface they carry — and `cells` has none of them, which is the graph the
 * seam openings alone live on. `chooseCutClasses` asks for both once per
 * candidate class, and on a stack there are hundreds of candidates.
 */
interface FixedBlocks {
  readonly patches: ChainBlocks;
  readonly cells: ChainBlocks;
}
const fixedBlocks = new WeakMap<KineticSurface, FixedBlocks>();
function blocksFor(surface: KineticSurface, chain: Chain): FixedBlocks {
  let had = fixedBlocks.get(surface);
  if (!had) {
    had = {
      patches: blocksOfDesign(surface, chain, () => true),
      cells: blocksOfDesign(surface, chain, () => false),
    };
    fixedBlocks.set(surface, had);
  }
  return had;
}

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

/**
 * Is the maze open across side `side` of cell `cell`?
 *
 * The sides of every cell lie end to end in one array, so a cell's sides start
 * at `sideStart[cell]`; which class a side belongs to is what a design opens
 * or closes. Every drawing of a pattern asks this, and asks it of the cell
 * rather than of the class, so it is worth a name.
 */
export function isSideOpen(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  cell: number,
  side: number,
): boolean {
  return design.open.has(surface.classOf[surface.sideStart[cell]! + side]!);
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
  return surface.adjOfState(stateIndex).filter(e => design.open.has(e.classId));
}

export function stateStats(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
): StateStats {
  const open = openAdjacencies(surface, design, stateIndex);
  const uf = new UnionFind<number>();
  // Only what is on the outside counts. A cell buried inside a folded object
  // carries no maze in this state, and counting it would leave every design
  // looking disconnected by exactly the number of cells it had folded away.
  let components = surface.visibleCount[stateIndex]!;
  let cycles = 0;
  let edges = 0;
  for (const e of open) {
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
 * The longest walk through one state of a design: the maze's own diameter.
 *
 * Two sweeps from anywhere — the far end of the first is an end of some
 * longest walk, and the far end of the second is the other. That only holds on
 * a tree, which is what a design is meant to be here; on one that is not, this
 * still comes back with a walk, just not the longest, which is the right way
 * for a number shown beside a maze to fail.
 *
 * It is a poor measure of how hard a maze is and a good measure of whether it
 * is one: a design that is perfect in every pose and a straight run in one of
 * them is a maze on a plank that also folds, rather than a maze on a folding
 * object.
 */
export function longestWalk(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
): number {
  const near = new Map<number, number[]>();
  for (const e of openAdjacencies(surface, design, stateIndex)) {
    (near.get(e.a) ?? near.set(e.a, []).get(e.a)!).push(e.b);
    (near.get(e.b) ?? near.set(e.b, []).get(e.b)!).push(e.a);
  }
  const sweep = (from: number): { far: number; distance: number } => {
    const seen = new Map<number, number>([[from, 0]]);
    const queue = [from];
    let far = from;
    let distance = 0;
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head]!;
      for (const next of near.get(at) ?? []) {
        if (seen.has(next)) continue;
        const step = seen.get(at)! + 1;
        seen.set(next, step);
        queue.push(next);
        if (step > distance) {
          distance = step;
          far = next;
        }
      }
    }
    return { far, distance };
  };
  const start = near.keys().next();
  if (start.done) return 0;
  return sweep(sweep(start.value).far).distance;
}

/**
 * Whether the seam openings alone stay a forest in every state.
 *
 * Two of them that close a loop would put a cycle in the maze that no choice
 * of walls could undo, because a seam opening is forced: it is there in every
 * state whether the design wants it or not.
 */
function staysForest(surface: KineticSurface, open: ReadonlySet<number>): boolean {
  const chain = chainOf(surface);
  if (chain) {
    // The seam openings alone, over the cells: a forest in every state is the
    // same thing as no state closing a loop, which the walk counts.
    return chainScore(chain, blocksFor(surface, chain).cells, c => open.has(c)).cycles === 0;
  }
  for (let s = 0; s < surface.stateCount; s++) {
    const uf = new UnionFind<number>();
    for (const e of surface.adjOfState(s)) {
      if (!open.has(e.classId)) continue;
      if (uf.connected(e.a, e.b)) return false;
      uf.union(e.a, e.b);
    }
  }
  return true;
}

/**
 * Picks cut classes to open, greedily, until every state *could* be one maze —
 * that is, until opening every free wall as well would join the whole visible
 * surface into a single piece.
 * Fewer is better: every opening spends one unit of the spanning-tree budget,
 * so the pieces have to be internally split that much more (corollary 4).
 *
 * What is counted is the surface, not the pieces. One piece can carry two
 * patches of surface that meet nowhere on it — the outer and the inner wall of
 * a ring — and counting pieces would call such a state joined while half of
 * its maze was still stranded. On a mechanism whose pieces each carry one
 * patch the two counts agree, so this picks what it always picked.
 */
export function chooseCutClasses(surface: KineticSurface, rng: Rng): number[] {
  const chain = chainOf(surface);
  const patchComponents = (open: Set<number>): number => {
    // Over the patches, a state's components are what the walk carries: the
    // internal classes are all open, so they are inside the blocks already.
    if (chain) return chainScore(chain, blocksFor(surface, chain).patches, c => open.has(c)).components;
    let total = 0;
    for (let s = 0; s < surface.stateCount; s++) {
      const uf = new UnionFind<number>();
      let comps = surface.visibleCount[s]!;
      for (const e of surface.adjOfState(s)) {
        if (surface.classKind[e.classId] !== 'internal' && !open.has(e.classId)) continue;
        if (!uf.connected(e.a, e.b)) {
          uf.union(e.a, e.b);
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
  let best = patchComponents(chosen);
  const target = surface.stateCount; // every state down to a single patch
  for (const c of candidates) {
    if (best === target) break;
    chosen.add(c);
    // A class can carry many sides at once on a mechanism that folds, so the
    // one that joins the most surface is quite capable of closing a loop while
    // it does it. Such a class is no use at any price: the loop is forced.
    const next = staysForest(surface, chosen) ? patchComponents(chosen) : best;
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
  for (const e of surface.adjOfState(targetState)) {
    if (!open.has(e.classId)) continue;
    if (uf.connected(e.a, e.b)) {
      throw new Error(
        `the forced openings already close a loop in state ${targetState}; open fewer cut classes`,
      );
    }
    uf.union(e.a, e.b);
  }

  // A wall that is buried in the target state is no wall there: opening it
  // would spend a passage the state cannot see. The order of the rest is the
  // order they were found in, so a mechanism that never buries anything gets
  // exactly the list it always got.
  const present = new Set<number>();
  for (const e of surface.adjOfState(targetState)) {
    if (surface.classKind[e.classId] === 'internal') present.add(e.classId);
  }
  const walls = surface.internalEdges.filter(e => present.has(e.classId));
  rng.shuffle(walls);
  for (const e of walls) {
    if (uf.connected(e.a, e.b)) continue;
    uf.union(e.a, e.b);
    open.add(e.classId);
  }

  return { open, openCutClasses: [...openCutClasses], targetState };
}

export interface TreeRate {
  /** How many of the states are perfect mazes. */
  readonly perfect: number;
  readonly rate: number;
  /** Passages in a state; the same in every one by the invariance theorem. */
  readonly passages: number;
  /** Whether that held — it is a theorem, so a false here is a broken build. */
  readonly edgeCountInvariant: boolean;
  /** A state that is not a perfect maze, or -1 when every one is. */
  readonly witness: number;
}

/**
 * Difficulty, measured over every state the mechanism can reach.
 *
 * A count rather than a list of states, because on a mechanism whose pieces
 * sit in a line it is worked out without visiting one: the walk along the line
 * carries how many states end up in each shape, and a quarter of a million of
 * them would be a list nobody reads. What wants the list is the cell-level
 * search, which visits every state anyway — `rateByState` hands it both.
 */
export function treeRate(surface: KineticSurface, design: Pick<KineticDesign, 'open'>): TreeRate {
  const chain = chainOf(surface);
  if (!chain) return rateByState(surface, design).rate;

  const blocks = blocksOfDesign(surface, chain, c => design.open.has(c));
  const score = chainScore(chain, blocks, c => design.open.has(c));
  // The walk counts the passages at the seams; the walls a design opens inside
  // a piece are the same in every state, so they are added rather than walked.
  let openWalls = 0;
  for (const e of surface.internalEdges) if (design.open.has(e.classId)) openWalls++;
  return {
    perfect: score.perfect,
    rate: score.perfect / surface.stateCount,
    passages: openWalls + score.passages,
    edgeCountInvariant: !score.passagesVary,
    witness: score.witness,
  };
}

/** The same, one state at a time, and which of them came out perfect. */
export function rateByState(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
): { rate: TreeRate; perfect: Uint8Array } {
  const perfect = new Uint8Array(surface.stateCount);
  let count = 0;
  let passages = 0;
  let invariant = true;
  let witness = -1;
  for (let s = 0; s < surface.stateCount; s++) {
    const stats = stateStats(surface, design, s);
    if (s === 0) passages = stats.edges;
    else if (stats.edges !== passages) invariant = false;
    if (stats.perfect) {
      perfect[s] = 1;
      count++;
    } else if (witness === -1) witness = s;
  }
  return {
    rate: {
      perfect: count,
      rate: surface.stateCount === 0 ? 0 : count / surface.stateCount,
      passages,
      edgeCountInvariant: invariant,
      witness,
    },
    perfect,
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
  private readonly size: number;
  private readonly parent: Int32Array;
  private readonly rank: Uint8Array;
  components: number;

  // Written out rather than declared in the parameter list, so that the whole
  // of core/ still loads in a plain `node file.ts` — which is how the probes
  // in .dev/ run it.
  constructor(size: number) {
    this.size = size;
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
  /** `costOverStates` for the target states. Zero means all are perfect. */
  readonly cost: number;
  readonly targetStates: readonly number[];
  readonly restarts: number;
  readonly iterations: number;
  /** Annealing steps actually taken, summed over the restarts. */
  readonly steps: number;
}

/**
 * Sum over `states` of (components - 1) + cycles — what the optimiser drives to 0.
 *
 * Both ends of the same gap are charged for. Where the passage count is pinned
 * at N-1 the two terms are always equal, so this is twice the old measure and
 * the search is unchanged but for its scale; where a state can bury cells, the
 * count is no longer pinned and a design may be connected *and* looped, which
 * only the second term can see.
 */
export function costOverStates(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  states: readonly number[],
): number {
  let cost = 0;
  for (const s of states) {
    const stats = stateStats(surface, design, s);
    cost += stats.components - 1 + stats.cycles;
  }
  return cost;
}

/**
 * Looks for a design that is a perfect maze in *several* states at once.
 *
 * Where no cell is ever buried, opening a wall somewhere always closes one
 * elsewhere, because the passage count is pinned at N-1; so this swaps one
 * open internal class for a closed one and anneals on how far the target
 * states are from being a tree. The cut classes are left alone — changing them
 * would change the budget.
 *
 * A mechanism that folds shut has no such budget. The same wall counts in one
 * state and is buried in the next, so the number of open classes is not the
 * number of passages, and a swap can no longer reach every design: the search
 * must be free to open one more wall than it closes. It is given that freedom
 * only where it is needed, so a mechanism that hides nothing takes exactly the
 * moves it always took, in the same order, from the same seed.
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
  // Twice what it was, because the cost now charges for both ends of a gap
  // (see `costOverStates`) and the acceptance rule only ever sees the ratio.
  const startTemperature = options.startTemperature ?? 5;
  if (targetStates.length === 0) throw new Error('targetStates must not be empty');
  for (const s of targetStates) {
    if (s < 0 || s >= surface.stateCount) throw new Error(`no such state: ${s}`);
  }

  const canToggle = surface.hidesCells;
  const openCutClasses = options.openCutClasses ?? chooseCutClasses(surface, rng);
  const cutSet = new Set(openCutClasses);

  // Flatten the parts of the graph the inner loop touches.
  const internal = surface.internalEdges;
  const internalCount = internal.length;
  const classIndexOf = new Map<number, number>();
  internal.forEach((e, i) => classIndexOf.set(e.classId, i));
  // Where cells can be buried, the seams are design variables too.
  //
  // Freezing them is a consequence of the budget, not a rule of its own: where
  // the passage count is pinned at N-1, a seam opening spends one unit of it
  // in every state at once, so the set has to be settled before the walls are
  // arranged around it. A mechanism that folds shut has no such count to
  // spend, and holding its seams still only costs it: the greedy choice is
  // made against connectivity alone, blind to whether the loops it leaves can
  // be undone anywhere. Measured on the eight-cube ring, freeing them is the
  // difference between finding a design for two tapings out of four and for
  // all four.
  const seams: readonly number[] = canToggle ? surface.cutClasses : [];
  seams.forEach((c, i) => classIndexOf.set(c, internalCount + i));
  // Seam openings the design is stuck with: none, where it may move them.
  const cutPairs = targetStates.map(s => {
    const pairs: number[] = [];
    if (!canToggle) {
      for (const e of surface.adjOfState(s)) {
        if (cutSet.has(e.classId)) pairs.push(e.a, e.b);
      }
    }
    return Int32Array.from(pairs);
  });
  // Which cells a wall joins, per state: -1 where it is buried and joins none.
  const wallPairs = targetStates.map(s => {
    const pairs = new Int32Array(internalCount * 2).fill(-1);
    for (const e of surface.adjOfState(s)) {
      const index = classIndexOf.get(e.classId);
      if (index === undefined || index >= internalCount) continue;
      pairs[2 * index] = e.a;
      pairs[2 * index + 1] = e.b;
    }
    return pairs;
  });
  // A seam is not one wall but as many as happen to meet along it in this
  // state, so it needs a list where a wall needs a pair. Kept apart from the
  // walls rather than folded in with them, so that the common case — one pair,
  // or none — stays the two array reads it always was.
  const seamStart = targetStates.map(() => new Int32Array(seams.length + 1));
  const seamPairs = targetStates.map((s, t) => {
    const buckets: number[][] = seams.map(() => []);
    for (const e of surface.adjOfState(s)) {
      const index = classIndexOf.get(e.classId);
      if (index === undefined || index < internalCount) continue;
      buckets[index - internalCount]!.push(e.a, e.b);
    }
    const start = seamStart[t]!;
    const flat: number[] = [];
    buckets.forEach((pairs, i) => {
      start[i] = flat.length;
      flat.push(...pairs);
    });
    start[seams.length] = flat.length;
    return Int32Array.from(flat);
  });
  const buried = targetStates.map(s => surface.cellCount - surface.visibleCount[s]!);

  const uf = new CellUnionFind(surface.cellCount);

  // What each state costs on its own, written by every `evaluate` and kept for
  // the accepted design, so the next move can be aimed at a state that fails.
  const trialPerState = new Int32Array(targetStates.length);
  const costPerState = new Int32Array(targetStates.length);

  const evaluate = (openList: Int32Array, count: number): number => {
    let cost = 0;
    for (let t = 0; t < cutPairs.length; t++) {
      const pairs = cutPairs[t]!;
      const walls = wallPairs[t]!;
      uf.reset();
      let cycles = 0;
      for (let i = 0; i < pairs.length; i += 2) {
        if (!uf.union(pairs[i]!, pairs[i + 1]!)) cycles++;
      }
      const start = seamStart[t]!;
      const seamData = seamPairs[t]!;
      for (let k = 0; k < count; k++) {
        const index = openList[k]!;
        if (index < internalCount) {
          const wall = 2 * index;
          const a = walls[wall]!;
          if (a < 0) continue; // buried here, so it joins nothing here
          if (!uf.union(a, walls[wall + 1]!)) cycles++;
          continue;
        }
        const seam = index - internalCount;
        for (let p = start[seam]!; p < start[seam + 1]!; p += 2) {
          if (!uf.union(seamData[p]!, seamData[p + 1]!)) cycles++;
        }
      }
      // A buried cell is a component of its own; it is not part of the maze.
      const own = uf.components - buried[t]! - 1 + cycles;
      trialPerState[t] = own;
      cost += own;
    }
    return cost;
  };

  const capacity = internalCount + seams.length;

  /**
   * A wall to flip, chosen where the design is actually broken.
   *
   * A uniform flip is a bad bet late on: nearly every wall is already where
   * some state wants it, so the move is nearly always rejected and the search
   * stalls a long way from zero. This picks a state that still fails, rebuilds
   * just that state, and offers a wall that answers its complaint — one that
   * spans two of its pieces of surface, or one of the walls that closed a loop
   * in it. Either is an improvement *there* by construction; whether it is an
   * improvement overall is still the acceptance rule's to decide, so the moves
   * are biased but the distribution they anneal against is not.
   *
   * Only where cells can be buried. A mechanism with a fixed passage count
   * never reaches this: it swaps rather than flips, and its behaviour from a
   * given seed is unchanged.
   */
  const failing: number[] = [];
  const looped: number[] = [];
  const proposeDefect = (
    openList: Int32Array,
    count: number,
    isOpen: Uint8Array,
  ): number => {
    failing.length = 0;
    for (let t = 0; t < costPerState.length; t++) {
      if (costPerState[t]! > 0) failing.push(t);
    }
    if (failing.length === 0) return rng.nextInt(capacity);
    const t = failing[rng.nextInt(failing.length)]!;
    const pairs = cutPairs[t]!;
    const walls = wallPairs[t]!;

    const start = seamStart[t]!;
    const seamData = seamPairs[t]!;
    uf.reset();
    for (let i = 0; i < pairs.length; i += 2) uf.union(pairs[i]!, pairs[i + 1]!);
    looped.length = 0;
    for (let k = 0; k < count; k++) {
      const index = openList[k]!;
      if (index < internalCount) {
        const wall = 2 * index;
        const a = walls[wall]!;
        if (a < 0) continue;
        if (!uf.union(a, walls[wall + 1]!)) looped.push(index);
        continue;
      }
      const seam = index - internalCount;
      for (let p = start[seam]!; p < start[seam + 1]!; p += 2) {
        if (!uf.union(seamData[p]!, seamData[p + 1]!)) looped.push(index);
      }
    }
    const components = uf.components - buried[t]! - 1;

    // A loop is only ever undone by closing one of the walls that made it, so
    // where the state is whole and looped there is nothing else worth trying.
    if (looped.length > 0 && (components === 0 || rng.next() < HALF)) {
      return looped[rng.nextInt(looped.length)]!;
    }
    // A gap, likewise, only by opening a wall whose two sides are on opposite
    // banks of it. Sampled rather than scanned: the walls that span a gap are
    // a large share of the closed ones while the state is badly broken, and by
    // the time they are scarce the loop term above is usually what is left.
    for (let tries = 0; tries < DEFECT_TRIES; tries++) {
      const index = rng.nextInt(capacity);
      if (isOpen[index]) continue;
      if (index < internalCount) {
        const wall = 2 * index;
        const a = walls[wall]!;
        if (a < 0) continue;
        if (uf.find(a) !== uf.find(walls[wall + 1]!)) return index;
        continue;
      }
      const seam = index - internalCount;
      for (let p = start[seam]!; p < start[seam + 1]!; p += 2) {
        if (uf.find(seamData[p]!) !== uf.find(seamData[p + 1]!)) return index;
      }
    }
    return rng.nextInt(capacity);
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
    const current = new Int32Array(capacity);
    current.set(openIndices);
    let size = openIndices.length;
    const isOpen = new Uint8Array(capacity);
    for (const i of openIndices) isOpen[i] = 1;
    let cost = evaluate(current, size);
    costPerState.set(trialPerState);
    const trial = new Int32Array(capacity);

    for (let step = 0; step < iterations && cost > 0; step++) {
      steps++;
      const temperature = startTemperature * (1 - step / iterations) + 0.02;

      if (canToggle && rng.next() < TOGGLE_SHARE) {
        const index = rng.next() < DEFECT_SHARE
          ? proposeDefect(current, size, isOpen)
          : rng.nextInt(capacity);
        let trialSize = 0;
        if (isOpen[index]) {
          for (let k = 0; k < size; k++) {
            if (current[k] !== index) trial[trialSize++] = current[k]!;
          }
        } else {
          trial.set(current.subarray(0, size));
          trial[size] = index;
          trialSize = size + 1;
        }
        const next = evaluate(trial, trialSize);
        if (next <= cost || rng.next() < Math.exp((cost - next) / temperature)) {
          isOpen[index] = isOpen[index] ? 0 : 1;
          current.set(trial.subarray(0, trialSize));
          size = trialSize;
          cost = next;
          costPerState.set(trialPerState);
        }
        continue;
      }

      const slot = rng.nextInt(size);
      const leaving = current[slot]!;
      const entering = rng.nextInt(capacity);
      if (isOpen[entering]) continue;
      trial.set(current.subarray(0, size));
      trial[slot] = entering;
      const next = evaluate(trial, size);
      if (next <= cost || rng.next() < Math.exp((cost - next) / temperature)) {
        isOpen[leaving] = 0;
        isOpen[entering] = 1;
        current.set(trial.subarray(0, size));
        cost = next;
        costPerState.set(trialPerState);
      }
    }

    if (cost < bestCost) {
      bestCost = cost;
      bestList = Int32Array.from(current.subarray(0, size));
    }
  }

  // The seams it was given, unless it was free to choose its own — in which
  // case which of them ended up open is a result, not a setting.
  const open = new Set<number>(canToggle ? [] : openCutClasses);
  for (const i of bestList ?? []) {
    open.add(i < internalCount ? internal[i]!.classId : seams[i - internalCount]!);
  }
  const cutsOpen = canToggle
    ? seams.filter(c => open.has(c))
    : [...openCutClasses];
  return {
    design: { open, openCutClasses: cutsOpen, targetState: targetStates[0]! },
    cost: bestCost,
    targetStates: [...targetStates],
    restarts,
    iterations,
    steps,
  };
}

/**
 * How often the annealer opens or closes a wall rather than moving one.
 *
 * Only where cells can be buried, and an even split there: a run of swaps is
 * what actually rearranges a maze, while toggles are what let the number of
 * passages settle where each state needs it.
 */
const TOGGLE_SHARE = 0.5;

/**
 * How often a flip is aimed at a state that fails rather than thrown at random.
 * High, because the uniform flip is what the aimed one is there to replace;
 * the remainder is what keeps the search from only ever touching the walls the
 * failing states have an opinion about.
 */
const DEFECT_SHARE = 0.9;

/**
 * Closed walls to sample when looking for one that spans a gap, before giving
 * up and flipping something at random. A handful: where such walls are common
 * the first try usually finds one, and where they are rare the search is close
 * enough to done that the loop term is the one that matters.
 */
const DEFECT_TRIES = 16;

/** Named only because a bare 0.5 in the middle of the aim reads as a threshold. */
const HALF = 0.5;

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
 *
 * A closed object has no rim at all: two solids glued at a face, or one cut
 * open and turned, is a sphere with no edge to enter by. There the dead ends
 * themselves are the candidates, and only those that stay dead ends in every
 * state, since the markers are printed before the object is ever turned.
 */
export function pickStartGoal(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open' | 'targetState'>,
  options: { stateIndex?: number } = {},
): StartGoal {
  const stateIndex = options.stateIndex ?? design.targetState;
  const adj = surface.adjOfState(stateIndex);

  const neighbours = new Map<number, number[]>();
  for (const e of adj) {
    if (!design.open.has(e.classId)) continue;
    if (!neighbours.has(e.a)) neighbours.set(e.a, []);
    if (!neighbours.has(e.b)) neighbours.set(e.b, []);
    neighbours.get(e.a)!.push(e.b);
    neighbours.get(e.b)!.push(e.a);
  }

  // A marker is printed once and the object then moves, so it can only go
  // somewhere that is on the outside however the object is folded.
  const onRim: number[] = [];
  for (const cell of surface.alwaysVisible) {
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
  const candidates = leaves.length >= 2 ? leaves
    : onRim.length >= 2 ? onRim
    : deadEndsInEveryState(surface, design);
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
 * Where the entrance and the exit are printed, and which one is out in each
 * state.
 *
 * `pickStartGoal` needs one cell that is on show however the object is moved,
 * and a mechanism that folds shut has none: every square of a ring of cubes is
 * buried in some pose. So a marker goes on *more than one* cell — as many as
 * it takes for exactly one of them to be on the outside in every state — and
 * the walk runs between whichever pair is showing.
 *
 * Two cells is always enough here, and never fewer: cells whose visibility is
 * complementary come in thousands on the folding ring, and a set of three
 * would show two of its marks in some pose. What is *not* true is the guess
 * that the pair is a cube's two opposite faces — on the ring, a cube's
 * opposite faces are both on show in some pose, and the pairs that work join
 * two faces that meet at an edge, or two different cubes entirely
 * (`.dev/probe-fold-marks.ts`). Which is why this asks the surface rather than
 * the mechanism: the rule is complementary visibility, and where the geometry
 * puts that is the geometry's business.
 */
export interface PrintedEnds {
  /** Cells the entrance is printed on: exactly one is on show in any state. */
  readonly start: readonly number[];
  readonly goal: readonly number[];
  /** The pair the walk runs between, one per state. */
  readonly byState: readonly StartGoal[];
}

export function pickPrintedEnds(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open' | 'targetState'>,
): PrintedEnds {
  // Nothing is ever hidden: one cell each, and `pickStartGoal` knows more
  // about where to put them — it keeps them on a free rim, which is the
  // difference between an entrance and a hole in the middle of a wall.
  if (!surface.hidesCells) {
    const ends = pickStartGoal(surface, design);
    return {
      start: [ends.start],
      goal: [ends.goal],
      byState: Array.from({ length: surface.stateCount }, () => ends),
    };
  }

  const states = surface.stateCount;
  const neighbours: number[][][] = [];
  const degree: Int32Array[] = [];
  for (let state = 0; state < states; state++) {
    const near: number[][] = Array.from({ length: surface.cellCount }, () => []);
    const count = new Int32Array(surface.cellCount);
    for (const e of surface.adjOfState(state)) {
      if (!design.open.has(e.classId)) continue;
      near[e.a]!.push(e.b);
      near[e.b]!.push(e.a);
      count[e.a]!++;
      count[e.b]!++;
    }
    neighbours.push(near);
    degree.push(count);
  }

  /** Which states a cell is on show in, as text, so any number of them fits. */
  const showsIn = (cell: number): string => {
    let bits = '';
    for (let state = 0; state < states; state++) bits += surface.visibleOfState(state)[cell] ? '1' : '0';
    return bits;
  };
  const complement = (bits: string): string => [...bits].map(b => (b === '1' ? '0' : '1')).join('');

  const leaves = markerPairs(surface, degree, showsIn, complement, true);
  const pairs = leaves.length > 1 ? leaves : markerPairs(surface, degree, showsIn, complement, false);
  if (pairs.length < 2) throw new Error('no pair of cells is on show one at a time');

  const walks = new Map<number, Int32Array[]>();
  const walksFrom = (cell: number): Int32Array[] => {
    const had = walks.get(cell);
    if (had) return had;
    const made = Array.from({ length: states }, (_unused, state) =>
      (surface.visibleOfState(state)[cell] ? distancesFrom(neighbours[state]!, cell) : EMPTY));
    walks.set(cell, made);
    return made;
  };

  /**
   * The longest walk that starts at a pair, in the pose where that is shortest.
   *
   * No combination can score better than this at either end, because the score
   * is a distance from one of these cells in some pose and this is the
   * furthest anything is. So it is an upper bound on every combination the
   * pair takes part in, and pairs can be looked at in order of it.
   */
  const reachOf = (pair: readonly [number, number]): number => {
    let worst = Infinity;
    for (let state = 0; state < states; state++) {
      const from = surface.visibleOfState(state)[pair[0]] ? pair[0] : pair[1];
      const far = walksFrom(from)[state]!;
      let furthest = 0;
      for (let cell = 0; cell < far.length; cell++) if (far[cell]! > furthest) furthest = far[cell]!;
      worst = Math.min(worst, furthest);
    }
    return worst;
  };

  // Every pair of pairs, judged by the walk in the state where it is shortest
  // — the same measure the shipped designs are ranked by. Quadratic in the
  // number of dead ends, and that number grows with the ruling rather than
  // staying a handful: 1032 pairs at three cells across a face and 26726 at
  // seven, which is 357 million combinations. So they are taken in order of
  // the bound above and the sweep stops at the first pair that cannot beat
  // what has already been found — everything after it is worse still. Within a
  // combination, likewise, the moment it is worse in one pose the rest are not
  // looked at.
  const order = pairs
    .map((pair, index) => ({ pair, index, reach: reachOf(pair) }))
    .sort((a, b) => b.reach - a.reach || a.index - b.index);
  let best: PrintedEnds | null = null;
  let bestWalk = -Infinity;
  for (let i = 0; i < order.length; i++) {
    if (order[i]!.reach <= bestWalk) break;
    const s = order[i]!.pair;
    const fromStart = [walksFrom(s[0]), walksFrom(s[1])];
    for (let j = i + 1; j < order.length; j++) {
      if (order[j]!.reach <= bestWalk) break;
      const g = order[j]!.pair;
      if (g[0] === s[0] || g[0] === s[1] || g[1] === s[0] || g[1] === s[1]) continue;
      const byState: StartGoal[] = [];
      let worst = Infinity;
      for (let state = 0; state < states; state++) {
        const start = surface.visibleOfState(state)[s[0]] ? s[0] : s[1];
        const goal = surface.visibleOfState(state)[g[0]] ? g[0] : g[1];
        byState.push({ start, goal });
        worst = Math.min(worst, fromStart[start === s[0] ? 0 : 1]![state]![goal] ?? -1);
        if (worst <= bestWalk) break;
      }
      if (worst <= bestWalk) continue;
      bestWalk = worst;
      best = { start: [...s], goal: [...g], byState };
    }
  }
  if (!best) throw new Error('no two pairs of cells can hold an entrance and an exit');
  return best;
}

const EMPTY = new Int32Array(0);

/**
 * Cells that are on show one at a time, taken two at a time.
 *
 * With `leavesOnly`, both cells must also be a dead end in every state they
 * are on show in — a marker in the middle of a corridor leaves a stub of maze
 * hanging off it, exactly as on a fixed object. It is asked for first and
 * dropped if it turns out to be impossible, since it is a preference and being
 * able to print the thing at all is not.
 */
function markerPairs(
  surface: KineticSurface,
  degree: readonly Int32Array[],
  showsIn: (cell: number) => string,
  complement: (bits: string) => string,
  leavesOnly: boolean,
): [number, number][] {
  const byPattern = new Map<string, number[]>();
  for (let cell = 0; cell < surface.cellCount; cell++) {
    let anywhere = false;
    let leaf = true;
    for (let state = 0; state < surface.stateCount; state++) {
      if (!surface.visibleOfState(state)[cell]) continue;
      anywhere = true;
      if (degree[state]![cell] !== 1) leaf = false;
    }
    if (!anywhere || (leavesOnly && !leaf)) continue;
    const bits = showsIn(cell);
    const found = byPattern.get(bits);
    if (found) found.push(cell);
    else byPattern.set(bits, [cell]);
  }

  const pairs: [number, number][] = [];
  for (const [bits, cells] of byPattern) {
    const other = complement(bits);
    // Each pattern and its complement, once between them.
    if (other <= bits) continue;
    for (const partner of byPattern.get(other) ?? []) {
      for (const cell of cells) pairs.push([cell, partner]);
    }
  }
  return pairs;
}

function distancesFrom(neighbours: readonly number[][], from: number): Int32Array {
  const distance = new Int32Array(neighbours.length).fill(-1);
  distance[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const next of neighbours[at]!) {
      if (distance[next] !== -1) continue;
      distance[next] = distance[at]! + 1;
      queue.push(next);
    }
  }
  return distance;
}

/**
 * Cells that are a dead end whichever way the object is turned.
 *
 * Whether a side is open is a property of its class rather than of a state, so
 * on most mechanisms a cell's degree never changes and this is just "the leaves
 * of the tree". It is worked out per state anyway, because a class that goes
 * unpaired in some states — a side that meets nothing there — would otherwise
 * put a marker on a cell that is a dead end in one configuration and a corridor
 * in the next, and the marker is printed only once.
 */
function deadEndsInEveryState(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
): number[] {
  const stillLeaf = new Uint8Array(surface.cellCount);
  for (const cell of surface.alwaysVisible) stillLeaf[cell] = 1;
  const degree = new Int32Array(surface.cellCount);
  for (let state = 0; state < surface.stateCount; state++) {
    degree.fill(0);
    for (const e of surface.adjOfState(state)) {
      if (!design.open.has(e.classId)) continue;
      degree[e.a]!++;
      degree[e.b]!++;
    }
    for (let cell = 0; cell < surface.cellCount; cell++) {
      if (degree[cell] !== 1) stillLeaf[cell] = 0;
    }
  }
  const found: number[] = [];
  for (let cell = 0; cell < surface.cellCount; cell++) if (stillLeaf[cell]) found.push(cell);
  return found;
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

  const open = new Set(chosen);
  const candidates = surface.cutClasses.filter(c => !open.has(c));
  rng.shuffle(candidates);
  let added = 0;
  for (const c of candidates) {
    if (added === extra) break;
    open.add(c);
    if (staysForest(surface, open)) {
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
export interface AllStatesSearchOptions {
  rng: Rng;
  sampleSize?: number;
  maxRounds?: number;
  addPerRound?: number;
  restarts?: number;
  openCutClasses?: readonly number[];
  /** Cell-state units to spend; see `DEFAULT_SEARCH_EFFORT`. */
  effort?: number;
}

export interface SearchProgress {
  /** Rounds of anneal-then-verify finished so far. */
  readonly rounds: number;
  readonly maxRounds: number;
  readonly spent: number;
  readonly effort: number;
  /** States that are perfect mazes under the best design found so far. */
  readonly perfectStates: number;
  readonly stateCount: number;
}

export interface AllStatesSearch {
  /** Runs one round. Returns true when there is nothing left to try. */
  step(): boolean;
  readonly progress: SearchProgress;
  /** The best design found so far; valid after at least one step. */
  result(): AllStatesResult;
}

/**
 * The same search as `searchAllStates`, one round at a time.
 *
 * Handed out a round at a time because a page has one thread: a search that
 * runs to completion in a single call is a page that stops repainting, and a
 * visitor cannot tell that from a crash. Stepping it lets the caller put the
 * object back on screen between rounds and say how far along it is. The rounds
 * themselves are unchanged, so what it finds is exactly what the all-at-once
 * version finds from the same seed.
 */
export function createAllStatesSearch(
  surface: KineticSurface,
  options: AllStatesSearchOptions,
): AllStatesSearch {
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
  let round = 0;
  let finished = false;

  const step = (): boolean => {
    if (finished) return true;
    round++;
    // The budget buys rounds, never shorter anneals. Cutting an anneal short
    // is not a cheaper search, it is a worse one: the temperature schedule is
    // laid out over the iteration count, so halving it does not halve the work
    // done, it halves the cooling — and a design a full-length anneal finds on
    // the first attempt can elude four compressed ones. Measured, the
    // compressed version failed on half the mechanisms the full-length one
    // solved, and then spent the whole budget failing.
    if (round > maxRounds || (round > 1 && spent >= effort)) {
      finished = true;
      return true;
    }

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

    const { rate, perfect: perfectStates } = rateByState(surface, attempt.design);
    if (!best || rate.perfect > best.rate.perfect) {
      best = {
        design: attempt.design, rate, rounds: round,
        workingStates: working.size, exhausted: false,
      };
    }
    if (rate.rate === 1) {
      finished = true;
      return true;
    }

    // Feed the states it got wrong back in, so the next anneal has to answer
    // for them. Sampling rather than adding them all keeps a step cheap.
    const failed: number[] = [];
    for (let s = 0; s < surface.stateCount; s++) if (!perfectStates[s]) failed.push(s);
    if (failed.length === 0) {
      finished = true;
      return true;
    }
    for (let i = 0; i < addPerRound; i++) working.add(failed[rng.nextInt(failed.length)]!);
    return false;
  };

  return {
    step,
    get progress(): SearchProgress {
      return {
        rounds: Math.min(round, maxRounds),
        maxRounds,
        spent,
        effort,
        perfectStates: best?.rate.perfect ?? 0,
        stateCount: surface.stateCount,
      };
    },
    result(): AllStatesResult {
      if (!best) throw new Error('the search has not run a round yet');
      return { ...best, exhausted: best.rate.rate < 1 };
    },
  };
}

export function searchAllStates(
  surface: KineticSurface,
  options: AllStatesSearchOptions,
): AllStatesResult {
  const search = createAllStatesSearch(surface, options);
  while (!search.step()) {
    // Every round, until it finds one or runs out of budget.
  }
  return search.result();
}
