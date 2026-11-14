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
 *
 * Three more tables follow the first. Each method over every object and
 * ruling. Then, when `neutral` (what the page runs) is among the methods, the
 * others against it seed by seed: for one object, ruling and seed, the other
 * method's seconds over neutral's, and per object and ruling the median of
 * that over the seeds both ran. The methods of one object and ruling run back
 * to back in one process, so a pair ran under the same load. A ratio marked ≥
 * had the other method run out of time on some seed, which makes it a lower
 * bound; one marked ? had neutral run out of time. Those medians are then
 * gathered by the number of poses. Last, the worst pose's longest walk,
 * neutral's over the other's, on the seeds where both found a design.
 */
import { quantile, readRuns } from './lib.ts';
import type { RunRecord } from './lib.ts';

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const csv = process.argv.includes('--csv');
const allowDirty = process.argv.includes('--allow-dirty');
if (files.length === 0) throw new Error('usage: node bench/summarize.ts <results.jsonl> ... [--csv] [--allow-dirty]');

const { runs, commits, machines, dirty } = readRuns(files, { allowDirty });

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

/** A table in the format asked for, with a title line above it. */
function print(title: string, columns: readonly string[], body: readonly string[][]): void {
  if (body.length === 0) return;
  if (csv) {
    console.log(`\n# ${title}`);
    console.log(columns.join(','));
    for (const row of body) console.log(row.join(','));
    return;
  }
  console.log(`\n${title}\n`);
  console.log(`| ${columns.join(' | ')} |`);
  console.log(`|${columns.map(() => '---').join('|')}|`);
  for (const row of body) console.log(`| ${row.join(' | ')} |`);
}
const sorted = (xs: readonly number[]): number[] => [...xs].sort((a, b) => a - b);
const median = (xs: readonly number[]): number => quantile(sorted(xs), 0.5);
const two = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : '');
const methods = [...new Set(runs.map(r => r.method))];

print('Each method, over every object and ruling',
  ['method', 'runs', 'found', 'out of time', 'median s', 'p90 s', 'max s', 'total h'],
  methods.map(method => {
    const list = runs.filter(r => r.method === method);
    const seconds = sorted(list.map(r => r.seconds));
    const found = list.filter(r => r.ok).length;
    return [
      method, String(list.length), String(found), String(list.length - found),
      two(quantile(seconds, 0.5)), two(quantile(seconds, 0.9)), two(seconds[seconds.length - 1]!),
      (seconds.reduce((a, b) => a + b, 0) / 3600).toFixed(1),
    ];
  }));

const REFERENCE = 'neutral';
const others = methods.filter(m => m !== REFERENCE);
if (methods.includes(REFERENCE) && others.length > 0) {
  const bySeed = new Map<string, RunRecord>();
  for (const r of runs) bySeed.set(`${r.method}|${r.object}|${r.cells}|${r.seed}`, r);
  const pairs = [...new Set(runs.filter(r => r.method === REFERENCE).map(r => `${r.object}|${r.cells}`))];
  /** Per object and ruling, the other method's seconds over neutral's, median over seeds. */
  const ratios = pairs.map(pair => {
    const [object, cells] = pair.split('|');
    const reference = runs.filter(r => r.method === REFERENCE && r.object === object && String(r.cells) === cells);
    const byMethod = others.map(method => {
      const xs: number[] = [];
      let otherOut = false;
      let referenceOut = false;
      for (const n of reference) {
        const o = bySeed.get(`${method}|${object}|${cells}|${n.seed}`);
        if (!o) continue;
        xs.push(o.seconds / n.seconds);
        otherOut ||= !o.ok;
        referenceOut ||= !n.ok;
      }
      return { ratio: median(xs), seeds: xs.length, mark: referenceOut ? '?' : otherOut ? '≥' : '' };
    });
    return { object: object!, cells: cells!, states: reference[0]!.states, byMethod };
  });
  print(`Seconds against ${REFERENCE}, seed by seed (median over the seeds both ran)`,
    ['object', 'n', 'states', ...others.map(m => `${m} ÷ ${REFERENCE}`), 'seeds'],
    ratios.map(r => [
      r.object, r.cells, String(r.states),
      ...r.byMethod.map(b => (b.seeds ? `${b.mark}${two(b.ratio)}` : '')),
      r.byMethod.map(b => b.seeds).join(' / '),
    ]));

  const counts = [...new Set(ratios.map(r => r.states))].sort((a, b) => b - a);
  const groups: [string, (states: number) => boolean][] = counts.map(c => [`${c} poses`, s => s === c]);
  if (counts.length > 2) groups.push([`fewer than ${counts[0]} poses`, s => s < counts[0]!]);
  if (counts.length > 1) groups.push(['all', () => true]);
  print(`Those medians, gathered by poses: min / median / max over the object-and-ruling pairs, and how many fall below 1`,
    ['poses', ...others.map(m => `${m} ÷ ${REFERENCE}`)],
    groups.map(([label, has]) => {
      const chosen = ratios.filter(r => has(r.states));
      return [label, ...others.map((_m, i) => {
        const xs = chosen.map(r => r.byMethod[i]!).filter(b => b.seeds > 0).map(b => b.ratio);
        if (xs.length === 0) return '';
        return `${two(Math.min(...xs))} / ${two(median(xs))} / ${two(Math.max(...xs))} over ${xs.length}, below 1: ${xs.filter(x => x < 1).length}`;
      })];
    }));

  const objects = [...new Set(ratios.map(r => r.object))];
  print(`Worst pose's longest walk, ${REFERENCE} over the other (median over the seeds both found)`,
    ['object', ...others.map(m => `÷ ${m} (seeds)`)],
    objects.map(object => [object, ...others.map(method => {
      const xs: number[] = [];
      for (const n of runs) {
        if (n.method !== REFERENCE || n.object !== object || !n.ok) continue;
        const o = bySeed.get(`${method}|${object}|${n.cells}|${n.seed}`);
        if (o?.ok) xs.push(n.worstWalk! / o.worstWalk!);
      }
      return xs.length ? `${two(median(xs))} (${xs.length})` : '';
    })]));
}
