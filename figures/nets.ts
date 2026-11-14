/**
 * Poses that are boxes — the infinity cube's two cubes, a plank — unfolded
 * flat, side by side: the maze each one shows, its marks, and the walk
 * between them.
 *
 *   node figures/nets.ts [--object infinity-cube] [--cells 3] [--poses "Cube 1,Cube 2"] [--seed 42]
 *                        [--width 160] [--out figures/out/nets.pdf]
 *
 * The same eight pieces make every pose, so each piece is given one pale
 * colour, the same in every net: two cubes built from the same pieces, each
 * piece showing different faces in each.
 *
 * Each net is the box's surface cut into a cross — the four sides in a row,
 * the top above the second and the bottom below it — so a passage that runs
 * across a cut is drawn as two open sides on the edges that meet in the box,
 * and the walk is broken there. A pose whose surface is not a box is refused.
 */
import type { PageItem } from '../src/render/face-page-model.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import type { Vec3 } from '../src/core/types.ts';
import { foldObject } from '../src/ui/fold-objects.ts';
import { pickPrintedEnds } from '../src/core/kinetic/maze.ts';
import { solutionCells } from '../src/render/kinetic-geometry.ts';
import { build, parseArgs, poseName } from '../bench/lib.ts';
import { OUT_DIR, shippedDesign, writePdf } from './lib.ts';
import { cellInWorld, normalOf } from './scene.ts';
import type { RGB } from './scene.ts';

const args = parseArgs(process.argv.slice(2));
const object = foldObject(args.get('object') ?? 'infinity-cube');
const cells = Number(args.get('cells') ?? 3);
const wanted = (args.get('poses') ?? 'Cube 1,Cube 2').split(',');
const seed = Number(args.get('seed') ?? 42);
const width = Number(args.get('width') ?? 160);
const out = args.get('out') ?? `${OUT_DIR}/nets.pdf`;

const { mechanism, surface } = build(object, cells);
const open = shippedDesign(object, cells, surface, seed);
const ends = pickPrintedEnds(surface, { open, targetState: 0 });

const PIECE_TINTS: RGB[] = [
  [214, 230, 250], [250, 222, 208], [208, 238, 224], [250, 234, 196],
  [246, 220, 232], [224, 220, 247], [232, 236, 214], [222, 226, 230],
];
const WALL: RGB = [20, 20, 20];
const SEAM: RGB = [160, 155, 145];
const START: RGB = [0x2a, 0x78, 0xd6];
const GOAL: RGB = [0xeb, 0x68, 0x34];

interface Net {
  readonly name: string;
  readonly size: Vec2;
  readonly items: PageItem[];
}

function netOf(pose: number): Net {
  const state = mechanism.states[pose]!;
  const visible = surface.visibleOfState(pose);
  const shown: number[] = [];
  const corners = new Map<number, Vec3[]>();
  for (let c = 0; c < mechanism.cells.length; c++) {
    if (!visible[c]) continue;
    shown.push(c);
    corners.set(c, cellInWorld(mechanism, state, c));
  }
  const all = [...corners.values()].flat();
  const lo = [0, 1, 2].map(k => Math.min(...all.map(p => p[k]!)));
  const hi = [0, 1, 2].map(k => Math.max(...all.map(p => p[k]!)));
  const [X, Y, Z] = [0, 1, 2].map(k => hi[k]! - lo[k]!) as [number, number, number];
  const rel = (p: Vec3): Vec3 => [p[0] - lo[0]!, p[1] - lo[1]!, p[2] - lo[2]!];

  // Which side of the box a cell is on: the axis its normal points along.
  const sideOf = (c: number): string => {
    const n = normalOf(corners.get(c)!);
    const k = [0, 1, 2].reduce((best, axis) => (Math.abs(n[axis]!) > Math.abs(n[best]!) ? axis : best), 0);
    const side = `${n[k]! > 0 ? '+' : '-'}${'xyz'[k]}`;
    const at = rel(corners.get(c)![0]!)[k]!;
    if (Math.abs(at - (n[k]! > 0 ? [X, Y, Z][k]! : 0)) > 1e-6) throw new Error(`${poseName(mechanism, pose)} is not a box`);
    return side;
  };
  // The cross, V up: -x -y +x +y in a row of height Z, +z above -y, -z below it.
  const flat = (side: string, q: Vec3): Vec2 => {
    const [x, y, z] = rel(q);
    switch (side) {
      case '-x': return [Y - y, Y + z];
      case '-y': return [Y + x, Y + z];
      case '+x': return [Y + X + y, Y + z];
      case '+y': return [2 * Y + X + (X - x), Y + z];
      case '+z': return [Y + x, Y + Z + y];
      case '-z': return [Y + x, Y - y];
      default: throw new Error(side);
    }
  };
  const W = 2 * X + 2 * Y, H = 2 * Y + Z;
  const page = (p: Vec2): Vec2 => [p[0], H - p[1]];
  const side = new Map(shown.map(c => [c, sideOf(c)]));
  const at = (c: number, p: Vec3): Vec2 => page(flat(side.get(c)!, p));
  const middle = (c: number): Vec2 => {
    const pts = corners.get(c)!.map(p => at(c, p));
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  };

  const items: PageItem[] = [];
  for (const c of shown) {
    const fill = PIECE_TINTS[mechanism.cells[c]!.piece % PIECE_TINTS.length]!;
    items.push({ kind: 'poly', pts: corners.get(c)!.map(p => at(c, p)), fill, stroke: fill, width: 0.02 });
  }
  // Where one piece's face meets another's, faintly, then the walls over it.
  const walls: PageItem[] = [];
  const drawnInternal = new Set<number>();
  for (const c of shown) {
    const pts = corners.get(c)!;
    const base = surface.sideStart[c]!;
    for (let s = 0; s < pts.length; s++) {
      const classId = surface.classOf[base + s]!;
      const kind = surface.classKind[classId]!;
      const a = at(c, pts[s]!), b = at(c, pts[(s + 1) % pts.length]!);
      if (kind !== 'internal') items.push({ kind: 'line', a, b, stroke: SEAM, width: 0.12 });
      if (kind === 'rim' || open.has(classId)) continue;
      if (kind === 'internal') {
        if (drawnInternal.has(classId)) continue;
        drawnInternal.add(classId);
      }
      walls.push({ kind: 'line', a, b, stroke: WALL, width: 0.3, cap: 'round' });
    }
  }
  items.push(...walls);

  // The walk, broken where the net is cut, then the marks on show.
  const pair = ends.byState[pose]!;
  const route = solutionCells(surface, { open }, pose, pair).cells;
  const cellSize = 1 / cells;
  for (let i = 1; i < route.length; i++) {
    const a = middle(route[i - 1]!), b = middle(route[i]!);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > cellSize * 1.01) continue;
    items.push({ kind: 'line', a, b, stroke: [200, 30, 30], width: 0.35, cap: 'round' });
  }
  const mark = (c: number, colour: RGB, letter: string): void => {
    const m = middle(c);
    const r = cellSize * 0.34;
    items.push({
      kind: 'poly', fill: colour, stroke: [255, 255, 255], width: 0.15,
      pts: Array.from({ length: 20 }, (_, i) => [m[0] + r * Math.cos((i / 20) * 2 * Math.PI), m[1] + r * Math.sin((i / 20) * 2 * Math.PI)] as Vec2),
    });
    items.push({ kind: 'text', at: m, text: letter, size: r * 1.3, color: [255, 255, 255], bold: true });
  };
  for (const c of ends.start) if (visible[c]) mark(c, START, 'S');
  for (const c of ends.goal) if (visible[c]) mark(c, GOAL, 'G');
  console.log(`${poseName(mechanism, pose)}: ${shown.length} cells on show, walk of ${route.length} cells`);
  return { name: poseName(mechanism, pose), size: [W, H], items };
}

const poses = wanted.map(name => {
  const pose = mechanism.states.findIndex((_, s) => poseName(mechanism, s) === name);
  if (pose < 0) throw new Error(`${object.id} has no pose called ${name}`);
  return pose;
});
const nets = poses.map(netOf);

// One scale for all, nets side by side, names under them.
const GAP = 8;
const LABEL = 5;
const scale = (width - GAP * (nets.length - 1)) / nets.reduce((s, n) => s + n.size[0], 0);
const items: PageItem[] = [];
let x = 0;
for (const net of nets) {
  const ox = x;
  // Text sizes are mm already; only positions scale.
  for (const item of net.items) {
    if (item.kind === 'poly') items.push({ ...item, pts: item.pts.map(p => [ox + p[0] * scale, p[1] * scale] as Vec2) });
    else if (item.kind === 'line') items.push({ ...item, a: [ox + item.a[0] * scale, item.a[1] * scale], b: [ox + item.b[0] * scale, item.b[1] * scale] });
    else items.push({ ...item, at: [ox + item.at[0] * scale, item.at[1] * scale], size: item.size * scale });
  }
  items.push({
    kind: 'text', at: [ox + (net.size[0] * scale) / 2, Math.max(...nets.map(n => n.size[1])) * scale + LABEL / 2],
    text: net.name, size: 2.4, color: [30, 30, 30],
  });
  x += net.size[0] * scale + GAP;
}
writePdf(out, width, Math.max(...nets.map(n => n.size[1])) * scale + LABEL, items);
