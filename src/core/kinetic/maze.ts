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
