/**
 * What the benchmarks share: the objects the folding page offers, the surface
 * each is searched on, the command line, and the record of where a number
 * came from.
 *
 * A number measured here is only worth citing alongside the code that produced
 * it, so every results file opens with the commit, whether the tree was clean,
 * the Node version and the machine. A run on a dirty tree says so rather than
 * refusing: it is how a change gets measured before it is committed, and the
 * flag is what keeps such a run out of anything that gets frozen.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import {
  FOLD_OBJECTS, createFoldMechanism, foldObject, foldRulings,
} from '../src/ui/fold-objects.ts';
import type { FoldMechanism, FoldObject } from '../src/ui/fold-objects.ts';
import { buildSurface } from '../src/core/kinetic/surface.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';

/** `--name value` pairs, and `--flag` alone for true. */
export function parseArgs(argv: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) throw new Error(`expected --name, got ${arg}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out.set(arg.slice(2), 'true');
    else {
      out.set(arg.slice(2), next);
      i++;
    }
  }
  return out;
}

/** `1000-1099`, `1,2,5` or a mix of both: `1-3,7`. */
export function parseRange(spec: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(',')) {
    const dash = part.indexOf('-', 1);
    if (dash < 0) {
      out.push(Number(part));
      continue;
    }
    const from = Number(part.slice(0, dash));
    const to = Number(part.slice(dash + 1));
    for (let n = from; n <= to; n++) out.push(n);
  }
  if (out.some(n => !Number.isInteger(n))) throw new Error(`not a list of integers: ${spec}`);
  return out;
}

/** `all`, or ids separated by commas, in the page's order either way. */
export function parseObjects(spec: string): FoldObject[] {
  if (spec === 'all') return [...FOLD_OBJECTS];
  const wanted = new Set(spec.split(','));
  for (const id of wanted) foldObject(id); // throws on an id the page does not have
  return FOLD_OBJECTS.filter(o => wanted.has(o.id));
}

/**
 * The rulings to run an object at: `all` is every one the page offers it,
 * which is two to ten cells across a face for the rings of cubes and two to
 * eight for the star cube; a list is cut down to the ones the object has.
 */
export function rulingsOf(object: FoldObject, spec: string): number[] {
  const offered = foldRulings(object);
  if (spec === 'all') return offered;
  return parseRange(spec).filter(n => offered.includes(n));
}

export interface Built {
  readonly mechanism: FoldMechanism;
  readonly surface: KineticSurface;
  /** Milliseconds to build both, which no search time includes. */
  readonly buildMs: number;
}

/** The surface the page searches on, built the way the page builds it. */
export function build(object: FoldObject, cells: number): Built {
  const t0 = performance.now();
  const mechanism = createFoldMechanism(object, { cells });
  const surface = buildSurface(mechanism, { maxStates: mechanism.states.length });
  return { mechanism, surface, buildMs: performance.now() - t0 };
}

/**
 * What the page calls a pose: Plank 1, Hook 2, Star. A ring of cubes keeps the
 * name on its poses and answers `stateLabel` with the hinge turns, which is
 * what identifies a pose but not what anyone calls it.
 */
export function poseName(mechanism: FoldMechanism, state: number): string {
  if ('poses' in mechanism) {
    const pose = mechanism.poses[state] as { label?: string } | undefined;
    if (pose?.label) return pose.label;
  }
  return mechanism.stateLabel(state);
}

export interface Provenance {
  readonly commit: string;
  /** Whether the working tree had changes the commit does not hold. */
  readonly dirty: boolean;
  readonly node: string;
  readonly cpu: string;
  readonly cpus: number;
  readonly started: string;
}

export function provenance(): Provenance {
  const git = (...args: string[]): string =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no').length > 0;
  return {
    commit,
    dirty,
    node: process.version,
    cpu: cpus()[0]?.model ?? 'unknown',
    cpus: cpus().length,
    started: new Date().toISOString(),
  };
}

/** Quantile of a sorted list, by the nearest rank. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[rank]!;
}

/** One line of a results file from `bench/run.ts`. */
export interface RunRecord {
  readonly kind: 'run';
  readonly method: string;
  readonly object: string;
  readonly cells: number;
  readonly seed: number;
  readonly ok: boolean;
  readonly perfect: number;
  readonly states: number;
  readonly seconds: number;
  readonly attempts: number;
  readonly steps: number;
  readonly worstWalk: number | null;
  readonly cap: number;
}

interface HeaderRecord {
  readonly kind: 'header';
  readonly commit: string;
  readonly dirty: boolean;
  readonly cpu: string;
  readonly node: string;
}

export interface Runs {
  readonly runs: RunRecord[];
  readonly commits: Set<string>;
  /** `cpu, Node version`, one entry per kind of machine the files were made on. */
  readonly machines: Set<string>;
  readonly dirty: boolean;
}

/**
 * The runs in some results files, refused when they cannot be read as one set.
 *
 * Files made at different commits are refused, and so is a file made on a
 * dirty tree unless `allowDirty`: a table is one version of the code or it is
 * nothing. So is the same run twice — two runs of a results set at one commit,
 * say — which would otherwise be counted as two seeds.
 */
export function readRuns(files: readonly string[], options: { allowDirty?: boolean } = {}): Runs {
  const runs: RunRecord[] = [];
  const commits = new Set<string>();
  const machines = new Set<string>();
  let dirty = false;
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      const record = JSON.parse(line) as RunRecord | HeaderRecord;
      if (record.kind === 'header') {
        commits.add(record.commit);
        machines.add(`${record.cpu}, Node ${record.node}`);
        dirty ||= record.dirty;
      } else runs.push(record);
    }
  }
  if (commits.size > 1) throw new Error(`results from ${commits.size} commits: ${[...commits].join(', ')}`);
  if (dirty && !options.allowDirty) throw new Error('results from a dirty working tree; pass --allow-dirty to look anyway');
  const seen = new Set<string>();
  for (const r of runs) {
    const key = `${r.method} ${r.object} ${r.cells} ${r.seed}`;
    if (seen.has(key)) throw new Error(`the same run twice: ${key}; summarise the files separately`);
    seen.add(key);
  }
  return { runs, commits, machines, dirty };
}
