/**
 * Why the star cube with its hooks has no design and the infinity cube does:
 * a dependency between the poses' count equations, drawn as the faces each
 * pose shows.
 *
 *   node figures/dependency.ts [--cells 2] [--width 160] [--out figures/out/dependency.pdf]
 *
 * A pose is a tree only if its blocks on show number one more than its open
 * seam passages: one equation a pose, in the faces' block counts and the seam
 * classes' openings. A set of weights on the poses that cancels every face and
 * every seam class — a dependency — leaves only the right-hand sides, so a
 * design can exist only if the weights sum to zero. The figure takes, for each
 * object, the dependency with the fewest poses (weights of one, searched
 * exhaustively), shows only the poses it weights, and gives a row to each set
 * of faces those poses show alike: in every row the faces on show in the
 * poses weighted +1 match those in the poses weighted -1.
 *
 * What the figure claims is checked here, not trusted: each dependency cancels
 * every face and every seam class's passage count, the infinity cube's weights
 * sum to zero and the star cube's do not, and `countsAreConsistent` agrees.
 */
import type { PageItem } from '../src/render/face-page-model.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import { buildSurface } from '../src/core/kinetic/surface.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';
import type { Mechanism } from '../src/core/kinetic/types.ts';
import { countsAreConsistent } from '../src/core/kinetic/maze-contracted.ts';
import { INFINITY_CUBE } from '../src/core/kinetic/mechanisms/cube-ring-objects.ts';
import { cubeRingShape } from '../src/core/kinetic/mechanisms/cube-ring.ts';
import { STAR_CUBE, createHalfCubeRing } from '../src/core/kinetic/mechanisms/half-cube-ring.ts';
import { build, parseArgs, patchesOf, poseName } from '../bench/lib.ts';
import { OUT_DIR, writePdf } from './lib.ts';
import { drawPose, extent, placeDrawing, restingTurn, turnedMechanism } from './scene.ts';
import type { RGB } from './scene.ts';

const args = parseArgs(process.argv.slice(2));
const cells = Number(args.get('cells') ?? 2);
const width = Number(args.get('width') ?? 160);
const out = args.get('out') ?? `${OUT_DIR}/dependency.pdf`;

interface Case {
  readonly title: string;
  readonly mech: Mechanism;
  readonly surface: KineticSurface;
  readonly names: readonly string[];
}

/** The star cube with all ten of the ring's poses, its hooks among them, as the tests build it. */
function starCubeWithHooks(): Case {
  const six = createHalfCubeRing(STAR_CUBE, { cells });
  const shape = cubeRingShape(STAR_CUBE.halves);
  const states = shape.poses.map(pose => shape.closures[pose.closure]!);
  const mech = { ...six, states };
  const names = shape.poses.map(pose =>
    six.poses.find(named => named.closure === pose.closure)?.label ?? pose.label);
  return { title: 'Star cube with its hooks', mech, surface: buildSurface(mech, { maxStates: states.length }), names };
}

function infinityCube(): Case {
  const { mechanism, surface } = build(INFINITY_CUBE, cells);
  return {
    title: 'Infinity cube', mech: mechanism, surface,
    names: mechanism.states.map((_, pose) => poseName(mechanism, pose)),
  };
}

interface Dependency {
  readonly weights: number[];
  /** Faces (patches) on show, as a 0/1 row per pose. */
  readonly shows: number[][];
  readonly faces: number[];
}

/**
 * The dependency with the fewest poses whose weights are all +1 or -1,
 * preferring one whose weights do not sum to zero where there is one, signed
 * so that fewer poses are weighted +1 than -1.
 */
function sparsestDependency(surface: KineticSurface): Dependency {
  const states = surface.stateCount;
  const patch = patchesOf(surface);
  const faces = [...new Set(patch)];
  const shows = Array.from({ length: states }, (_, s) => {
    const visible = surface.visibleOfState(s);
    return faces.map(face => visible[face]!);
  });
  const passages = Array.from({ length: states }, (_, s) => {
    const count = new Map<number, number>();
    for (const e of surface.adjOfState(s)) {
      if (surface.classKind[e.classId] === 'cut') count.set(e.classId, (count.get(e.classId) ?? 0) + 1);
    }
    return count;
  });
  const seams = [...new Set(passages.flatMap(m => [...m.keys()]))];

  const cancels = (w: readonly number[]): boolean =>
    faces.every((_, f) => w.reduce((sum, x, s) => sum + x * shows[s]![f]!, 0) === 0)
    && seams.every(k => w.reduce((sum, x, s) => sum + x * (passages[s]!.get(k) ?? 0), 0) === 0);

  let best: number[] | null = null;
  const score = (w: readonly number[]): [number, number] =>
    [w.filter(x => x !== 0).length, w.reduce((a, b) => a + b, 0) === 0 ? 1 : 0];
  const total = 3 ** states;
  for (let code = 1; code < total; code++) {
    const w: number[] = [];
    // Digits 0, 1, 2 are weights 0, +1, -1, so only code 0 is all zero.
    for (let s = 0, c = code; s < states; s++, c = Math.floor(c / 3)) w.push([0, 1, -1][c % 3]!);
    // One of each pair w, -w: the first weight is +1.
    if (w.find(x => x !== 0)! < 0) continue;
    if (!cancels(w)) continue;
    if (!best) best = w;
    else {
      const [a, za] = score(w), [b, zb] = score(best);
      if (za < zb || (za === zb && a < b)) best = w;
    }
  }
  if (!best) throw new Error('no dependency with weights of one');
  // The shorter side weighted +1, so it reads "these show what those show together".
  const plus = best.filter(x => x > 0).length;
  const weights = plus > best.length - plus - best.filter(x => x === 0).length ? best.map(x => -x) : best;
  return { weights, shows, faces };
}

const INK: RGB = [30, 30, 30];
const MUTED: RGB = [110, 110, 110];
const RULE: RGB = [215, 215, 210];
const PLUS: RGB = [0x2a, 0x78, 0xd6];
const MINUS: RGB = [0xeb, 0x68, 0x34];
const TEXT = 2.3;
const SMALL = 2.0;

const items: PageItem[] = [];
const text = (at: Vec2, s: string, size: number, color: RGB, align: 'left' | 'center' = 'center'): void => {
  items.push({ kind: 'text', at, text: s, size, color, align });
};
const line = (a: Vec2, b: Vec2, stroke: RGB, w: number): void => {
  items.push({ kind: 'line', a, b, stroke, width: w });
};
function dot(at: Vec2, r: number, colour: RGB): void {
  items.push({
    kind: 'poly',
    pts: Array.from({ length: 16 }, (_, i) => [at[0] + r * Math.cos((i / 16) * 2 * Math.PI), at[1] + r * Math.sin((i / 16) * 2 * Math.PI)] as Vec2),
    fill: colour, stroke: colour, width: 0.1,
  });
}

const LABEL_W = 16;
const COLUMN_W = 15;
const ROW_H = 3.2;
const THUMB_H = 13;
let y = 0;

for (const make of [infinityCube, starCubeWithHooks]) {
  const { title, mech, surface, names } = make();
  const { weights, shows, faces } = sparsestDependency(surface);
  const sum = weights.reduce((a, b) => a + b, 0);
  const consistent = countsAreConsistent(surface);
  if (consistent !== (sum === 0)) throw new Error(`${title}: countsAreConsistent says ${consistent}, the weights sum to ${sum}`);

  // The poses weighted +1, then those weighted -1, each in the page's order.
  const columns = [
    ...weights.flatMap((w, s) => (w > 0 ? [s] : [])),
    ...weights.flatMap((w, s) => (w < 0 ? [s] : [])),
  ];
  // Faces shown alike by those poses, as rows; a face none of them shows has no row.
  const rows = new Map<string, number>();
  faces.forEach((_, f) => {
    const key = columns.map(s => shows[s]![f]!).join('');
    if (key.includes('1')) rows.set(key, (rows.get(key) ?? 0) + 1);
  });
  // Most faces first, so the rows read from the bulk of the object to its corners.
  const ordered = [...rows.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));

  const plus = columns.filter(s => weights[s]! > 0).length;
  text([0, y + 2], `${title}`, TEXT, INK, 'left');
  text([0, y + 5], `${plus} poses against ${columns.length - plus}; weights sum to ${sum === 0 ? '0' : sum.toString().replace('-', '–')}`, SMALL, MUTED, 'left');
  y += 7;

  // The poses themselves at the column heads.
  const x0 = LABEL_W;
  const drawings = columns.map(s => drawPose(turnedMechanism(mech, restingTurn(mech, surface, s)), surface, s));
  const scale = Math.min(...drawings.map(d => Math.min((COLUMN_W - 2) / extent(d)[0], (THUMB_H - 4) / extent(d)[1])));
  columns.forEach((s, i) => {
    const d = drawings[i]!;
    const [w, h] = extent(d);
    const cx = x0 + i * COLUMN_W + COLUMN_W / 2;
    items.push(...placeDrawing(d, [cx - (w * scale) / 2, y + THUMB_H - 3.5 - h * scale], scale));
    text([cx, y + THUMB_H - 1.2], names[s]!, SMALL, INK);
  });
  y += THUMB_H + 1;

  const tableTop = y;
  const divider = x0 + plus * COLUMN_W;
  for (const [key, count] of ordered) {
    const cy = y + ROW_H / 2;
    text([0, cy], `${count} face${count === 1 ? '' : 's'}`, SMALL, MUTED, 'left');
    [...key].forEach((bit, i) => {
      if (bit === '1') dot([x0 + i * COLUMN_W + COLUMN_W / 2, cy], 0.75, i < plus ? PLUS : MINUS);
    });
    line([x0, y + ROW_H], [x0 + columns.length * COLUMN_W, y + ROW_H], RULE, 0.12);
    y += ROW_H;
  }
  line([divider, tableTop - 0.5], [divider, y + ROW_H + 0.5], MUTED, 0.2);
  // The weights.
  columns.forEach((s, i) => {
    const w = weights[s]!;
    text([x0 + i * COLUMN_W + COLUMN_W / 2, y + ROW_H / 2 + 0.3], w > 0 ? '+1' : '–1', TEXT, w > 0 ? PLUS : MINUS);
  });
  text([0, y + ROW_H / 2 + 0.3], 'weight', SMALL, MUTED, 'left');
  y += ROW_H + 8;

  console.log(`${title}: ${columns.map(s => `${weights[s]! > 0 ? '+' : '-'}${names[s]}`).join(' ')}; sum ${sum}; ${ordered.length} rows; countsAreConsistent ${consistent}`);
}

writePdf(out, width, y - 6, items);
