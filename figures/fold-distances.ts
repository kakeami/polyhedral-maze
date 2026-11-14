/**
 * How many folds apart each pair of poses is, a table an object, as LaTeX.
 *
 *   node figures/fold-distances.ts [--objects all] [--out figures/out/fold-distances.tex]
 *
 * The fewest folds from one pose to the other, through any shapes on the way,
 * poses or not (`poseDistances`). Rows carry the pose's name and columns its
 * initial and number (P1, H3, C); an object whose initials would collide gets
 * names on both. Each table is also printed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { poseDistances } from '../src/core/kinetic/fold-path.ts';
import { build, parseArgs, parseObjects, poseName, provenance } from '../bench/lib.ts';
import { OUT_DIR } from './lib.ts';

const args = parseArgs(process.argv.slice(2));
const objects = parseObjects(args.get('objects') ?? 'all');
const out = args.get('out') ?? `${OUT_DIR}/fold-distances.tex`;

const made = provenance();
const tex: string[] = [`% polyhedral-maze ${made.commit}${made.dirty ? ' (dirty)' : ''}: folds between poses`];
for (const object of objects) {
  // The motion does not depend on the ruling.
  const { mechanism } = build(object, 1);
  const graph = mechanism.foldGraph();
  const folds = poseDistances(graph);
  const names = mechanism.states.map((_, p) => poseName(mechanism, p));
  const initials = names.map(n => n.replace(/^(\S)\S*\s*(\d*)$/, '$1$2'));
  const heads = new Set(initials).size === names.length ? initials : names;

  const cell = (p: number, q: number): string => (p === q ? '$\\cdot$' : String(folds[p]![q]));
  tex.push(
    '',
    `% ${object.label}: ${names.length} poses, ${graph.shapes.length} shapes in all`,
    `\\begin{tabular}{l*{${names.length}}{c}}`,
    `  & ${heads.join(' & ')} \\\\`,
    '  \\hline',
    ...names.map((n, p) => `  ${n} & ${names.map((_, q) => cell(p, q)).join(' & ')} \\\\`),
    '\\end{tabular}',
  );

  const width = Math.max(...names.map(n => n.length));
  console.log(`${object.label}: ${names.length} poses, ${graph.shapes.length} shapes in all, farthest apart ${Math.max(...folds.flat())} folds`);
  console.log(`  ${''.padEnd(width)} ${heads.map(h => h.padStart(3)).join('')}`);
  names.forEach((n, p) => console.log(`  ${n.padEnd(width)} ${names.map((_, q) => (p === q ? '·' : String(folds[p]![q]))).map(c => c.padStart(3)).join('')}`));
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${tex.join('\n')}\n`);
console.log(`${out}${made.dirty ? '  (dirty tree)' : ''}`);
