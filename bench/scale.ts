/**
 * How big the problem is, pose by pose: what the cell-level search works on
 * and what the contracted one works on, for every object and ruling the
 * folding page offers.
 *
 *   node bench/scale.ts [--objects all] [--rulings all] [--seed 42] [--json]
 *
 * Per object and ruling: cells, side classes by kind, patches (cells joined
 * by internal classes: one face on most objects, two faces on some), patches
 * no pose shows, visibility groups (patches grouped by the poses they are on
 * show in — the unknowns of the count equations) and the rank of
 * those equations. Per pose: cells on show, which is the cell-level search's
 * node count with one edge fewer in a tree, and the patches, blocks and open
 * seam passages on show, which is the contracted graph's — again a tree, so
 * one passage fewer than blocks, which is checked rather than assumed.
 *
 * Blocks and passages belong to a design, not to the object, so they are read
 * off the one the page ships for `--seed` (42, the one a first visit draws).
 * Everything else is the object's own.
 *
 * Then the contracted graph as a multigraph. What the contraction needs of the
 * surface is checked rather than assumed, and a failure stops the run: a patch
 * is on show whole or buried whole, an internal class is one wall between the
 * same two cells and a side of the surface in exactly the poses its patch is
 * on show, and every passage joins two cells on show. Reported: the most
 * passages one seam class opens in one pose, how many (seam class, pose) pairs
 * open more than one, and how many seam passages join two cells of one patch.
 * And what merging parallel passages would cost: open one seam class the
 * shipped design leaves shut, alone, and in every pose it opens a passage in
 * the maze has a cycle; count the pairs where the graph with parallel
 * passages merged and loops dropped would still be a tree.
 */
import { buildSurface } from '../src/core/kinetic/surface.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';
import { decodeOpenClasses } from '../src/core/kinetic/stored-design.ts';
import { contractsCleanly } from '../src/core/kinetic/maze-contracted.ts';
import { cubeRingDesign } from '../src/core/kinetic/mechanisms/cube-ring-designs.ts';
import { halfCubeRingDesign } from '../src/core/kinetic/mechanisms/half-cube-ring-designs.ts';
import { createFoldMechanism, isHalfCubeRing } from '../src/ui/fold-objects.ts';
import { blocksOf, parseArgs, parseObjects, patchesOf, poseName, rulingsOf } from './lib.ts';

const args = parseArgs(process.argv.slice(2));
const objects = parseObjects(args.get('objects') ?? 'all');
const rulingSpec = args.get('rulings') ?? 'all';
const seed = Number(args.get('seed') ?? 42);
const json = args.has('json');

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

/** Stops the run unless the surface is one the contraction holds on (see above). */
function checkContraction(surface: KineticSurface, where: string): void {
  if (!contractsCleanly(surface)) throw new Error(`${where}: a patch is half on show`);
  const key = (a: number, b: number): string => (a < b ? `${a},${b}` : `${b},${a}`);
  const wallOf = new Map<number, string>();
  for (const e of surface.internalEdges) wallOf.set(e.classId, key(e.a, e.b));
  for (let s = 0; s < surface.stateCount; s++) {
    const visible = surface.visibleOfState(s);
    const sides = new Map<number, number>();
    for (const e of surface.adjOfState(s)) {
      if (!visible[e.a] || !visible[e.b]) throw new Error(`${where}: a passage off show in pose ${s}`);
      const wall = wallOf.get(e.classId);
      if (wall === undefined) continue;
      if (key(e.a, e.b) !== wall) throw new Error(`${where}: internal class ${e.classId} between other cells`);
      sides.set(e.classId, (sides.get(e.classId) ?? 0) + 1);
    }
    for (const e of surface.internalEdges) {
      const shown = visible[e.a] && visible[e.b] ? 1 : 0;
      if ((sides.get(e.classId) ?? 0) !== shown) throw new Error(`${where}: internal class ${e.classId} in pose ${s}`);
    }
  }
}

/** How many passages each seam class opens in each pose, whatever the design. */
function bundlesOf(surface: KineticSurface, patch: Int32Array) {
  let largestBundle = 0;
  let liveSeamPoses = 0;
  let bundledSeamPoses = 0;
  let seamPassagesInsideAPatch = 0;
  for (let s = 0; s < surface.stateCount; s++) {
    const count = new Map<number, number>();
    for (const e of surface.adjOfState(s)) {
      if (surface.classKind[e.classId] !== 'cut') continue;
      count.set(e.classId, (count.get(e.classId) ?? 0) + 1);
      if (patch[e.a] === patch[e.b]) seamPassagesInsideAPatch++;
    }
    for (const passages of count.values()) {
      largestBundle = Math.max(largestBundle, passages);
      liveSeamPoses++;
      if (passages > 1) bundledSeamPoses++;
    }
  }
  return { largestBundle, liveSeamPoses, bundledSeamPoses, seamPassagesInsideAPatch };
}

/**
 * Open each seam class the design leaves shut, alone, and in each pose it
 * opens a passage in, ask whether the blocks would still look like a tree
 * with parallel passages merged and loops dropped. The design is a tree in
 * every pose, so with one more passage it is not, and every "yes" is a cycle
 * that merging hides.
 */
function simpleGraphMisses(surface: KineticSurface, open: ReadonlySet<number>, block: Int32Array) {
  let oneSeamCycles = 0;
  let misses = 0;
  for (let s = 0; s < surface.stateCount; s++) {
    const visible = surface.visibleOfState(s);
    const nodes = new Set<number>();
    for (let cell = 0; cell < surface.cellCount; cell++) if (visible[cell]) nodes.add(block[cell]!);
    const openPairs: [number, number][] = [];
    const shut = new Map<number, [number, number][]>();
    for (const e of surface.adjOfState(s)) {
      if (surface.classKind[e.classId] !== 'cut') continue;
      const pair: [number, number] = [block[e.a]!, block[e.b]!];
      if (open.has(e.classId)) openPairs.push(pair);
      else shut.set(e.classId, [...(shut.get(e.classId) ?? []), pair]);
    }
    for (const added of shut.values()) {
      oneSeamCycles++;
      // The simple graph: distinct pairs of distinct blocks.
      const pairs = new Set<string>();
      for (const [a, b] of [...openPairs, ...added]) if (a !== b) pairs.add(a < b ? `${a},${b}` : `${b},${a}`);
      if (pairs.size !== nodes.size - 1) continue;
      const parent = new Map<number, number>();
      const find = (x: number): number => {
        while ((parent.get(x) ?? x) !== x) x = parent.get(x)!;
        return x;
      };
      let joined = 0;
      for (const pair of pairs) {
        const [a, b] = pair.split(',').map(Number) as [number, number];
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) { parent.set(ra, rb); joined++; }
      }
      if (joined === nodes.size - 1) misses++;
    }
  }
  return { oneSeamCycles, simpleGraphMisses: misses };
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
    checkContraction(surface, `${object.id} ${cells}`);

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
    const visibilityGroups = [...new Set([...showsIn.values()].filter(k => k !== ''))];
    const matrix = Array.from({ length: surface.stateCount }, (_unused, s) =>
      visibilityGroups.map(k => (k.split(',').map(Number).includes(s) ? 1 : 0)));

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
      visibilityGroups: visibilityGroups.length,
      countRank: rank(matrix),
      states: surface.stateCount,
      ...bundlesOf(surface, patch),
      ...simpleGraphMisses(surface, open, block),
      poses,
    };
    if (json) {
      console.log(JSON.stringify(summary));
      continue;
    }
    console.log(`\n### ${object.id}, n=${cells}`);
    console.log(
      `${summary.cells} cells; ${summary.classes} side classes (${kinds.internal} internal, ${kinds.cut} cut, ${kinds.rim} rim); `
      + `${summary.patches} patches, ${unseen} never on show; ${summary.visibilityGroups} visibility groups; `
      + `count equations: ${summary.states} in ${summary.visibilityGroups} unknowns, rank ${summary.countRank}`,
    );
    console.log(
      `contracted graph: up to ${summary.largestBundle} passages from one seam class in one pose; `
      + `${summary.bundledSeamPoses} of ${summary.liveSeamPoses} (seam class, pose) pairs open more than one; `
      + `${summary.seamPassagesInsideAPatch} seam passages inside one patch. `
      + `Opening one shut seam class: ${summary.oneSeamCycles} (class, pose) cycles, `
      + `${summary.simpleGraphMisses} of them hidden by merging parallel passages`,
    );
    console.log('\n| pose | cells on show | cell-level edges | patches on show | blocks on show | open seam passages |');
    console.log('|---|---|---|---|---|---|');
    for (const p of poses) {
      console.log(`| ${p.pose} | ${p.cells} | ${p.cells - 1} | ${p.patches} | ${p.blocks} | ${p.passages} |`);
    }
  }
}
