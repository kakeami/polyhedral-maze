/**
 * Reads results files from `bench/run.ts` and prints one table row per method,
 * object and ruling.
 *
 *   node bench/summarize.ts bench/results/a.jsonl [more.jsonl ...] [--csv]
 *
 * The time columns are over every run, the failures counted at the seconds
 * they spent, which is the cap or a little past it. So the median is a time to
 * a design whenever more than half the runs found one, and a lower bound
 * otherwise — the success column says which. The mean is over the runs that
 * found one; it answers "how long, when it works", and is blank when none did.
 *
 * Files made at different commits are not summarised together, and neither is
 * a file made on a dirty tree without `--allow-dirty`: a table is one version
 * of the code or it is nothing.
 */
import { readFileSync } from 'node:fs';
import { quantile } from './lib.ts';

interface RunRecord {
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

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const csv = process.argv.includes('--csv');
const allowDirty = process.argv.includes('--allow-dirty');
if (files.length === 0) throw new Error('usage: node bench/summarize.ts <results.jsonl> ... [--csv] [--allow-dirty]');

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
if (dirty && !allowDirty) throw new Error('results from a dirty working tree; pass --allow-dirty to look anyway');

const groups = new Map<string, RunRecord[]>();
for (const r of runs) {
  const key = `${r.method}|${r.object}|${r.cells}`;
  const list = groups.get(key) ?? [];
  list.push(r);
  groups.set(key, list);
}

const header = ['method', 'object', 'n', 'states', 'found', 'median s', 'p90 s', 'max s', 'mean s (found)', 'attempts (median)', 'steps (median)', 'worst-pose walk (median)'];
const rows: string[][] = [];
for (const [key, list] of groups) {
  const [method, object, cells] = key.split('|');
  const seconds = list.map(r => r.seconds).sort((a, b) => a - b);
  const found = list.filter(r => r.ok);
  const meanFound = found.length ? found.reduce((s, r) => s + r.seconds, 0) / found.length : NaN;
  const attempts = list.map(r => r.attempts).sort((a, b) => a - b);
  const steps = list.map(r => r.steps ?? NaN).sort((a, b) => a - b);
  const walks = found.map(r => r.worstWalk!).sort((a, b) => a - b);
  const fixed = (x: number): string => (Number.isNaN(x) ? '' : x.toFixed(2));
  rows.push([
    method!, object!, cells!, String(list[0]!.states),
    `${found.length}/${list.length}`,
    fixed(quantile(seconds, 0.5)), fixed(quantile(seconds, 0.9)), fixed(seconds[seconds.length - 1]!),
    fixed(meanFound),
    String(quantile(attempts, 0.5)),
    Number.isNaN(quantile(steps, 0.5)) ? '' : String(quantile(steps, 0.5)),
    walks.length ? String(quantile(walks, 0.5)) : '',
  ]);
}

console.log(`commit ${[...commits][0] ?? 'unknown'}${dirty ? ' (dirty)' : ''}, ${runs.length} runs`);
// Times from two kinds of machine do not belong in one column; say so.
console.log(`machine${machines.size > 1 ? 's (times are not comparable across them)' : ''}: ${[...machines].join('; ')}\n`);
if (csv) {
  console.log(header.join(','));
  for (const row of rows) console.log(row.join(','));
} else {
  console.log(`| ${header.join(' | ')} |`);
  console.log(`|${header.map(() => '---').join('|')}|`);
  for (const row of rows) console.log(`| ${row.join(' | ')} |`);
}
