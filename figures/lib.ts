/**
 * What the figures share: the maze a figure shows, and the file it is written to.
 *
 * A figure is drawn from the same code as the numbers beside it, so every PDF
 * written here carries the commit it came from, and whether the tree was
 * clean, in its own metadata — where a reader of the paper never sees it and
 * anyone holding the file can.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { jsPDF } from 'jspdf';
import { paintItems } from '../src/render/pdf-face-page-painter.ts';
import type { PageItem } from '../src/render/face-page-model.ts';
import { cubeRingDesign } from '../src/core/kinetic/mechanisms/cube-ring-designs.ts';
import { halfCubeRingDesign } from '../src/core/kinetic/mechanisms/half-cube-ring-designs.ts';
import { decodeOpenClasses } from '../src/core/kinetic/stored-design.ts';
import { treeRate } from '../src/core/kinetic/maze.ts';
import { isHalfCubeRing } from '../src/ui/fold-objects.ts';
import type { FoldObject } from '../src/ui/fold-objects.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';
import { provenance } from '../bench/lib.ts';

/** Where figures go unless told otherwise; untracked. */
export const OUT_DIR = 'figures/out';

/**
 * The maze the page shows for this object, ruling and seed: the one it ships,
 * checked as the page checks it.
 *
 * Only shipped designs are drawn. Each is one the page's own search finds from
 * that seed, so a figure needs no search of its own and shows exactly what a
 * visitor sees.
 */
export function shippedDesign(object: FoldObject, cells: number, surface: KineticSurface, seed = 42): Set<number> {
  const stored = isHalfCubeRing(object)
    ? halfCubeRingDesign(object.id, cells, seed)
    : cubeRingDesign(object.id, cells, seed);
  if (!stored) throw new Error(`no shipped design for ${object.id} at ${cells} cells, seed ${seed}`);
  if (stored.classCount !== surface.classCount) throw new Error(`${object.id} at ${cells}: the design is for another surface`);
  const open = decodeOpenClasses(stored);
  if (treeRate(surface, { open }).rate !== 1) throw new Error(`${object.id} at ${cells}: not a perfect maze in every pose`);
  return open;
}

/** One page of `width` by `height` mm, written to `path`. */
export function writePdf(path: string, width: number, height: number, items: PageItem[]): void {
  const doc = new jsPDF({ unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait' });
  const made = provenance();
  doc.setProperties({
    title: path.replace(/^.*\//, ''),
    subject: `polyhedral-maze ${made.commit}${made.dirty ? ' (dirty)' : ''}`,
    creator: 'figures/',
  });
  paintItems(doc, items);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(doc.output('arraybuffer')));
  console.log(`${path}  ${width.toFixed(0)} x ${height.toFixed(0)} mm${made.dirty ? '  (dirty tree)' : ''}`);
}
