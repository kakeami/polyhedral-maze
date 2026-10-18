/**
 * How big the problem is, pose by pose: what the cell-level search works on
 * and what the contracted one works on, for every object and ruling the
 * folding page offers.
 *
 *   node bench/scale.ts [--objects all] [--rulings all] [--seed 42] [--json]
 *
 * Per object and ruling: cells, side classes by kind, patches (the faces),
 * patches no pose shows, visibility classes (patches grouped by the poses
 * they are on show in — the unknowns of the count equations) and the rank of
 * those equations. Per pose: cells on show, which is the cell-level search's
 * node count with one edge fewer in a tree, and the patches, blocks and open
 * seam passages on show, which is the contracted graph's — again a tree, so
 * one passage fewer than blocks, which is checked rather than assumed.
 *
 * Blocks and passages belong to a design, not to the object, so they are read
 * off the one the page ships for `--seed` (42, the one a first visit draws).
 * Everything else is the object's own.
 */
import { buildSurface } from '../src/core/kinetic/surface.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';
import { decodeOpenClasses } from '../src/core/kinetic/stored-design.ts';
import { cubeRingDesign } from '../src/core/kinetic/mechanisms/cube-ring-designs.ts';
import { halfCubeRingDesign } from '../src/core/kinetic/mechanisms/half-cube-ring-designs.ts';
import { createFoldMechanism, isHalfCubeRing } from '../src/ui/fold-objects.ts';
import { parseArgs, parseObjects, poseName, rulingsOf } from './lib.ts';

const args = parseArgs(process.argv.slice(2));
const objects = parseObjects(args.get('objects') ?? 'all');
const rulingSpec = args.get('rulings') ?? 'all';
const seed = Number(args.get('seed') ?? 42);
const json = args.has('json');

/** Cells joined by internal classes, taken as far as they go: the faces. */
function patchesOf(surface: KineticSurface): Int32Array {
  const parent = new Int32Array(surface.cellCount).map((_unused, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!;
    return x;
  };
  for (const e of surface.internalEdges) parent[find(e.a)] = find(e.b);
  return parent.map((_unused, i) => find(i));
}

/** The cells each cell is joined to by the open walls of a design: its block. */
function blocksOf(surface: KineticSurface, open: ReadonlySet<number>): Int32Array {
  const parent = new Int32Array(surface.cellCount).map((_unused, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!;
    return x;
  };
  for (const e of surface.internalEdges) if (open.has(e.classId)) parent[find(e.a)] = find(e.b);
  return parent.map((_unused, i) => find(i));
}

/** Rank of a 0/1 matrix by elimination; small enough that floating point is exact. */
function rank(rows: number[][]): number {
  const m = rows.map(r => [...r]);
  let r = 0;
  for (let c = 0; c < (m[0]?.length ?? 0) && r < m.length; c++) {
    let pivot = -1;
    for (let i = r; i < m.length; i++) if (Math.abs(m[i]![c]!) > 1e-9) { pivot = i; break; }
    if (pivot < 0) continue;
    [m[r], m[pivot]] = [m[pivot]!, m[r]!];
    for (let i = 0; i < m.length; i++) {
      if (i === r) continue;
      const f = m[i]![c]! / m[r]![c]!;
      if (f !== 0) m[i] = m[i]!.map((x, j) => x - f * m[r]![j]!);
    }
    r++;
  }
  return r;
}

for (const object of objects) {
  for (const cells of rulingsOf(object, rulingSpec)) {
    const mech = createFoldMechanism(object, { cells });
    const surface = buildSurface(mech, { maxStates: mech.states.length });
    const stored = isHalfCubeRing(object)
      ? halfCubeRingDesign(object.id, cells, seed)
      : cubeRingDesign(object.id, cells, seed);
    if (!stored) throw new Error(`no shipped design for ${object.id} at ${cells} cells, seed ${seed}`);
    if (stored.classCount !== surface.classCount) throw new Error(`${object.id} ${cells}: the shipped design is for another surface`);
    const open = decodeOpenClasses(stored);

    const kinds = { internal: 0, cut: 0, rim: 0 };
    for (const kind of surface.classKind) kinds[kind]++;
    const patch = patchesOf(surface);
    const patchIds = [...new Set(patch)];
    const block = blocksOf(surface, open);

    // Which poses each patch is on show in, as a key, and the classes of those.
    const showsIn = new Map<number, string>();
    for (const p of patchIds) {
      const poses: number[] = [];
      for (let s = 0; s < surface.stateCount; s++) if (surface.visibleOfState(s)[p]) poses.push(s);
      showsIn.set(p, poses.join(','));
    }
    const unseen = [...showsIn.values()].filter(k => k === '').length;
    const visibilityClasses = [...new Set([...showsIn.values()].filter(k => k !== ''))];
    const matrix = Array.from({ length: surface.stateCount }, (_unused, s) =>
      visibilityClasses.map(k => (k.split(',').map(Number).includes(s) ? 1 : 0)));

    const poses = [];
    for (let s = 0; s < surface.stateCount; s++) {
      const visible = surface.visibleOfState(s);
      const shownPatches = new Set<number>();
      const shownBlocks = new Set<number>();
      for (let cell = 0; cell < surface.cellCount; cell++) {
        if (!visible[cell]) continue;
        shownPatches.add(patch[cell]!);
        shownBlocks.add(block[cell]!);
      }
      let passages = 0;
      for (const e of surface.adjOfState(s)) {
        if (surface.classKind[e.classId] === 'cut' && open.has(e.classId)) passages++;
      }
      if (passages !== shownBlocks.size - 1) {
        throw new Error(`${object.id} ${cells} ${poseName(mech, s)}: ${shownBlocks.size} blocks and ${passages} passages is not a tree`);
      }
      poses.push({
        pose: poseName(mech, s),
        cells: surface.visibleCount[s]!,
        patches: shownPatches.size,
        blocks: shownBlocks.size,
        passages,
      });
    }

    const summary = {
      object: object.id,
      n: cells,
      seed,
      cells: surface.cellCount,
      classes: surface.classCount,
      ...kinds,
      patches: patchIds.length,
      unseenPatches: unseen,
      visibilityClasses: visibilityClasses.length,
      countRank: rank(matrix),
      states: surface.stateCount,
      poses,
    };
    if (json) {
      console.log(JSON.stringify(summary));
      continue;
    }
    console.log(`\n### ${object.id}, n=${cells}`);
    console.log(
      `${summary.cells} cells; ${summary.classes} side classes (${kinds.internal} internal, ${kinds.cut} cut, ${kinds.rim} rim); `
      + `${summary.patches} patches, ${unseen} never on show; ${summary.visibilityClasses} visibility classes; `
      + `count equations: ${summary.states} in ${summary.visibilityClasses} unknowns, rank ${summary.countRank}`,
    );
    console.log('\n| pose | cells on show | cell-level edges | patches on show | blocks on show | open seam passages |');
    console.log('|---|---|---|---|---|---|');
    for (const p of poses) {
      console.log(`| ${p.pose} | ${p.cells} | ${p.cells - 1} | ${p.patches} | ${p.blocks} | ${p.passages} |`);
    }
  }
}
