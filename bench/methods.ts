/**
 * The searches being compared, each run the same way: from one seed, attempt
 * after independent attempt, until a design is perfect in every pose or the
 * time is up.
 *
 *   cell     the cell-level anneal (`searchAllStates`), one boolean per side
 *            class, as it was before the contraction. Run to its own budget
 *            and started again — a fresh seam set — for as long as there is time.
 *   random   the contracted search with uniform moves: a wall or a seam at
 *            random, under the rule that a wall inside one block is not a move.
 *   repair   the contracted search with aimed moves: cut the block a loop runs
 *            through, join two blocks across a gap.
 *   neutral  the contracted search that solves the count equations first and
 *            then anneals in moves that leave every count alone. What the
 *            folding page runs.
 *
 * There is no other limit, so a run that finds nothing is a run that used the
 * whole cap. The time is checked between attempts (between rounds, for
 * `cell`), so such a run can go past the cap by one attempt; it reports the
 * seconds it really took.
 *
 * What is not timed: building the surface, and checking the answer. A design
 * reported perfect is checked here again, pose by pose, with nothing the
 * search used — an answer that fails that check is an error, not a miss.
 */
import { createAllStatesSearch, longestWalk, stateStats } from '../src/core/kinetic/maze.ts';
import type { KineticDesign } from '../src/core/kinetic/maze.ts';
import { createContractedSearch } from '../src/core/kinetic/maze-contracted.ts';
import type { Strategy } from '../src/core/kinetic/maze-contracted.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';
import { createRng } from '../src/core/prng.ts';

export const METHODS = ['cell', 'random', 'repair', 'neutral'] as const;
export type Method = typeof METHODS[number];

export function parseMethods(spec: string): Method[] {
  const out = spec === 'all' ? [...METHODS] : spec.split(',');
  for (const m of out) {
    if (!(METHODS as readonly string[]).includes(m)) throw new Error(`no such method: ${m}`);
  }
  return out as Method[];
}

export interface Outcome {
  /** Perfect in every pose, and checked. */
  readonly ok: boolean;
  /** Poses the best design found is a perfect maze in. */
  readonly perfect: number;
  readonly seconds: number;
  /** Attempts made, or rounds for `cell`: each is an anneal from scratch or close to it. */
  readonly attempts: number;
  /**
   * The longest walk in the pose where it is shortest — how much maze the
   * easiest pose still has. Only for a design that is perfect.
   */
  readonly worstWalk: number | null;
}

/** Runs one method from one seed until it finds a design or `capSeconds` pass. */
export function run(
  method: Method,
  surface: KineticSurface,
  seed: number,
  capSeconds: number,
): Outcome {
  const t0 = performance.now();
  const elapsed = (): number => (performance.now() - t0) / 1000;
  const got = method === 'cell'
    ? runCell(surface, seed, capSeconds, elapsed)
    : runContracted(method, surface, seed, capSeconds, elapsed);
  const seconds = elapsed();
  const ok = got.design !== null && got.perfect === surface.stateCount;
  if (ok) audit(surface, got.design!, method, seed);
  return {
    ok,
    perfect: got.perfect,
    seconds,
    attempts: got.attempts,
    worstWalk: ok ? worstWalkOf(surface, got.design!) : null,
  };
}

interface Raw {
  readonly design: KineticDesign | null;
  readonly perfect: number;
  readonly attempts: number;
}

function runContracted(
  strategy: Strategy,
  surface: KineticSurface,
  seed: number,
  capSeconds: number,
  elapsed: () => number,
): Raw {
  const search = createContractedSearch(surface, {
    rng: createRng(seed),
    maxRounds: Number.MAX_SAFE_INTEGER,
    strategy,
  });
  let done = false;
  while (!done && elapsed() < capSeconds) done = search.step();
  const attempts = search.progress.rounds;
  // An attempt that never got going (no seam set joined every pose) leaves
  // nothing to report, and a run made only of those has no best design.
  let result;
  try {
    result = search.result();
  } catch {
    return { design: null, perfect: 0, attempts };
  }
  return { design: result.design, perfect: result.rate.perfect, attempts };
}

/**
 * The cell-level search, restarted until the time is up.
 *
 * One `searchAllStates` keeps the seam set it drew at the start for all of its
 * rounds, and gives up after its own budget; if that seam set admits no
 * design it never will. So a fresh one is started from the same stream of
 * random numbers, which is what a caller with time to spare would do, and is
 * the fair way to give it the same minute the others get.
 */
function runCell(
  surface: KineticSurface,
  seed: number,
  capSeconds: number,
  elapsed: () => number,
): Raw {
  const rng = createRng(seed);
  let design: KineticDesign | null = null;
  let perfect = 0;
  let rounds = 0;
  while (elapsed() < capSeconds && perfect < surface.stateCount) {
    let search;
    try {
      search = createAllStatesSearch(surface, { rng });
    } catch {
      continue; // no seam set joined every pose on this shuffle; draw again
    }
    let done = false;
    while (!done && elapsed() < capSeconds) done = search.step();
    rounds += search.progress.rounds;
    let result;
    try {
      result = search.result();
    } catch {
      break; // the time ran out before its first round
    }
    if (result.rate.perfect > perfect) {
      design = result.design;
      perfect = result.rate.perfect;
    }
  }
  return { design, perfect, attempts: rounds };
}

/** Every pose a tree on the cells it shows, counted from the geometry again. */
function audit(surface: KineticSurface, design: KineticDesign, method: Method, seed: number): void {
  for (let state = 0; state < surface.stateCount; state++) {
    const stats = stateStats(surface, design, state);
    if (!stats.perfect || stats.edges !== surface.visibleCount[state]! - 1) {
      throw new Error(`${method} seed ${seed}: reported perfect, and pose ${state} is not`);
    }
  }
}

function worstWalkOf(surface: KineticSurface, design: KineticDesign): number {
  let worst = Infinity;
  for (let state = 0; state < surface.stateCount; state++) {
    worst = Math.min(worst, longestWalk(surface, design, state));
  }
  return worst;
}
