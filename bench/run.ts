/**
 * Runs the folding-maze searches over objects x rulings x methods x seeds and
 * appends one JSON line per run.
 *
 *   node bench/run.ts --methods neutral,repair --rulings 4,7 --seeds 1000-1009
 *   node bench/run.ts --methods all --objects infinity-cube --cap 60 --out bench/results/a.jsonl
 *   node bench/run.ts ... --shard 0/2        # and 1/2 in a second process
 *
 * Options (defaults in brackets):
 *   --methods  cell,random,repair,neutral or all            [neutral]
 *   --objects  ids as the page names them, or all            [all]
 *   --rulings  e.g. 2-10 or 4,7; cut to what each object has [all]
 *   --seeds    e.g. 1000-1099                                [1000-1009]
 *   --cap      seconds a run may search                      [60]
 *   --out      results file; appended to, never overwritten  [bench/results/<time>.jsonl]
 *   --shard    i/n: this process takes every n-th run from i [0/1]
 *
 * Seeds start at 1000 by default so as not to measure the seeds the page ships
 * (42 and 1 to 6), which were picked to need no search at all.
 *
 * The file is appended to, and a run already in it is skipped, so a long run
 * that is stopped picks up where it was. Its first line, and the first line
 * of every resumption, records the commit and the machine; the summary refuses
 * to mix commits.
 *
 * Time is the wall clock of one process. Run at most two at once, on a machine
 * doing nothing else: what four processes measure is how they share a memory
 * bus, and that is only good for comparing runs made side by side.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  build, parseArgs, parseObjects, parseRange, provenance, rulingsOf,
} from './lib.ts';
import { parseMethods, run } from './methods.ts';
import type { Method } from './methods.ts';

const args = parseArgs(process.argv.slice(2));
const methods = parseMethods(args.get('methods') ?? 'neutral');
const objects = parseObjects(args.get('objects') ?? 'all');
const rulingSpec = args.get('rulings') ?? 'all';
const seeds = parseRange(args.get('seeds') ?? '1000-1009');
const cap = Number(args.get('cap') ?? 60);
const out = args.get('out')
  ?? `bench/results/${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
const [shard, shards] = (args.get('shard') ?? '0/1').split('/').map(Number) as [number, number];
if (!(cap > 0)) throw new Error('--cap must be a positive number of seconds');
if (!(shards >= 1 && shard >= 0 && shard < shards)) throw new Error('--shard must be i/n with 0 <= i < n');

const keyOf = (method: string, object: string, cells: number, seed: number): string =>
  `${method}|${object}|${cells}|${seed}`;

mkdirSync(dirname(out), { recursive: true });
const done = new Set<string>();
if (existsSync(out)) {
  for (const line of readFileSync(out, 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line) as { kind: string; method: string; object: string; cells: number; seed: number };
    if (r.kind === 'run') done.add(keyOf(r.method, r.object, r.cells, r.seed));
  }
}

const config = {
  methods,
  objects: objects.map(o => o.id),
  rulings: rulingSpec,
  seeds: args.get('seeds') ?? '1000-1009',
  cap,
  shard: `${shard}/${shards}`,
};
const where = provenance();
appendFileSync(out, JSON.stringify({ kind: 'header', ...where, config }) + '\n');
if (where.dirty) console.error('note: the working tree has uncommitted changes; this run is marked dirty');

let index = -1;
let ran = 0;
let skipped = 0;
for (const object of objects) {
  for (const cells of rulingsOf(object, rulingSpec)) {
    // Built only when this shard has something to run on it.
    let built: ReturnType<typeof build> | null = null;
    for (const method of methods) {
      for (const seed of seeds) {
        index++;
        if (index % shards !== shard) continue;
        if (done.has(keyOf(method, object.id, cells, seed))) {
          skipped++;
          continue;
        }
        built ??= build(object, cells);
        const { surface } = built;
        const got = run(method as Method, surface, seed, cap);
        const record = {
          kind: 'run',
          method,
          object: object.id,
          cells,
          seed,
          ...got,
          cap,
          states: surface.stateCount,
          cellCount: surface.cellCount,
          classCount: surface.classCount,
        };
        appendFileSync(out, JSON.stringify(record) + '\n');
        ran++;
        console.error(
          `${method.padEnd(7)} ${object.id} n=${cells} seed ${seed}: `
          + `${got.ok ? 'ok  ' : `${got.perfect}/${surface.stateCount}`} `
          + `${got.seconds.toFixed(2)} s, ${got.attempts} attempts`,
        );
      }
    }
  }
}
console.error(`\n${ran} runs written to ${out}${skipped ? `, ${skipped} already there` : ''}`);
