/**
 * One pose of a maze twice: as the tree its passages make on the cells, and as
 * the tree its seam passages make on the blocks — the cells a face's open
 * walls join — which is what the search works with.
 *
 *   node figures/contraction.ts [--object infinity-cube] [--cells 4] [--pose "Cube 1"] [--seed 42]
 *                               [--width 160] [--out figures/out/contraction.pdf]
 *
 * Only the side of the pose facing the viewer is drawn, so a tree edge that
 * runs over the silhouette is drawn as far as the edge it crosses there. The
 * counts printed are for the whole pose.
 *
 * Blocks are coloured so that no two that touch share a colour (greedy, most
 * neighbours first); the colours mean nothing else.
 */
import type { PageItem } from '../src/render/face-page-model.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import type { Vec3 } from '../src/core/types.ts';
import { dot } from '../src/core/vec3.ts';
import { foldObject } from '../src/ui/fold-objects.ts';
import { blocksOf, build, parseArgs, poseName } from '../bench/lib.ts';
import { OUT_DIR, shippedDesign, writePdf } from './lib.ts';
import {
  DIMETRIC, PAPER_LOOK, cellInWorld, drawPose, extent, normalOf, paintOrder, placeDrawing, restingTurn, turnedMechanism,
} from './scene.ts';
import type { Drawing, RGB } from './scene.ts';

const args = parseArgs(process.argv.slice(2));
const object = foldObject(args.get('object') ?? 'infinity-cube');
const cells = Number(args.get('cells') ?? 4);
const wanted = args.get('pose') ?? 'Cube 1';
const seed = Number(args.get('seed') ?? 42);
const width = Number(args.get('width') ?? 160);
const out = args.get('out') ?? `${OUT_DIR}/contraction.pdf`;

const { mechanism, surface } = build(object, cells);
const open = shippedDesign(object, cells, surface, seed);
const pose = mechanism.states.findIndex((_, s) => poseName(mechanism, s) === wanted);
if (pose < 0) throw new Error(`${object.id} has no pose called ${wanted}`);
const mech = turnedMechanism(mechanism, restingTurn(mechanism, surface, pose));
const state = mech.states[pose]!;
const visible = surface.visibleOfState(pose);
const { eye, project } = paintOrder(mech, surface, pose, DIMETRIC);

// --- what the pose has ---------------------------------------------------------

const corners = new Map<number, Vec3[]>();
const facing = new Set<number>();
for (let c = 0; c < mech.cells.length; c++) {
  if (!visible[c]) continue;
  const pts = cellInWorld(mech, state, c);
  corners.set(c, pts);
  if (dot(normalOf(pts), eye) > 1e-9) facing.add(c);
}
const centre = (c: number): Vec3 => {
  const pts = corners.get(c)!;
  return [0, 1, 2].map(k => pts.reduce((s, p) => s + p[k]!, 0) / pts.length) as Vec3;
};
/** Midpoint of the side two cells share in this pose. */
const sharedMid = (a: number, b: number): Vec3 => {
  const key = (p: Vec3): string => p.map(x => Math.round(x * 1e6)).join(',');
  const inB = new Set(corners.get(b)!.map(key));
  const shared = corners.get(a)!.filter(p => inB.has(key(p)));
  if (shared.length !== 2) throw new Error(`cells ${a} and ${b} do not share a side`);
  return [0, 1, 2].map(k => (shared[0]![k]! + shared[1]![k]!) / 2) as Vec3;
};

const block = blocksOf(surface, open);
const internalOpen = surface.internalEdges.filter(e => visible[e.a] && open.has(e.classId));
const seamOpen = surface.adjOfState(pose).filter(e => surface.classKind[e.classId] === 'cut' && open.has(e.classId));
const blocksOnShow = new Set([...corners.keys()].map(c => block[c]!));
const cellsOnShow = corners.size;
if (internalOpen.length + seamOpen.length !== cellsOnShow - 1) throw new Error('the pose is not a tree on its cells');
if (seamOpen.length !== blocksOnShow.size - 1) throw new Error('the pose is not a tree on its blocks');
console.log(`${object.id} n=${cells} ${wanted}: ${cellsOnShow} cells, ${internalOpen.length + seamOpen.length} passages; `
  + `${blocksOnShow.size} blocks, ${seamOpen.length} seam passages`);

// --- colours for the blocks -------------------------------------------------------

const touching = new Map<number, Set<number>>();
const touch = (a: number, b: number): void => {
  const x = block[a]!, y = block[b]!;
  if (x === y) return;
  (touching.get(x) ?? touching.set(x, new Set()).get(x)!).add(y);
  (touching.get(y) ?? touching.set(y, new Set()).get(y)!).add(x);
};
for (const e of surface.internalEdges) if (visible[e.a]) touch(e.a, e.b);
for (const e of surface.adjOfState(pose)) touch(e.a, e.b);
const TINTS: RGB[] = [
  [205, 226, 251], [251, 214, 196], [196, 236, 218], [251, 228, 176], [244, 210, 225], [216, 211, 246], [222, 222, 215],
];
const colourOf = new Map<number, number>();
for (const b of [...blocksOnShow].sort((x, y) => (touching.get(y)?.size ?? 0) - (touching.get(x)?.size ?? 0) || x - y)) {
  const taken = new Set([...(touching.get(b) ?? [])].map(n => colourOf.get(n)).filter(c => c !== undefined));
  const free = TINTS.findIndex((_, i) => !taken.has(i));
  if (free < 0) throw new Error('ran out of block colours');
  colourOf.set(b, free);
}
const tint = new Map<number, RGB>([...corners.keys()].map(c => [c, TINTS[colourOf.get(block[c]!)!]!]));

// --- the two pictures ------------------------------------------------------------------

const GAP = 10;
const LOOK = { ...PAPER_LOOK, wallWidth: 0.45, edgeWidth: 0.1, shading: 0.18 };
const plain = drawPose(mech, surface, pose, { open, look: LOOK });
const [w, h] = extent(plain);
const scale = (width - GAP) / (2 * w);
/** A length in mm on the page, in the drawing's units. */
const mm = (x: number): number => x / scale;

/** Both trees, in one colour: the walls are black. */
const TREE: RGB = [0x2a, 0x78, 0xd6];
const P = (p: Vec3): Vec2 => project(p);

/** A tree edge over the surface: from one end, over the side the two cells share, to the other. */
function bend(from: Vec3 | null, mid: Vec3, to: Vec3 | null, stroke: RGB, w: number): PageItem[] {
  const out: PageItem[] = [];
  if (from) out.push({ kind: 'line', a: P(from), b: P(mid), stroke, width: w, cap: 'round' });
  if (to) out.push({ kind: 'line', a: P(mid), b: P(to), stroke, width: w, cap: 'round' });
  return out;
}
function disc(at: Vec3, r: number, fill: RGB): PageItem {
  const c = P(at);
  return {
    kind: 'poly', fill, stroke: [255, 255, 255], width: r * scale * 0.35,
    pts: Array.from({ length: 16 }, (_, i) => [c[0] + r * Math.cos((i / 16) * 2 * Math.PI), c[1] + r * Math.sin((i / 16) * 2 * Math.PI)] as Vec2),
  };
}

// Left: the maze as printed, with the tree its passages make on the cells.
const left: Drawing = plain;
for (const e of [...internalOpen, ...seamOpen]) {
  if (!facing.has(e.a) && !facing.has(e.b)) continue;
  left.items.push(...bend(facing.has(e.a) ? centre(e.a) : null, sharedMid(e.a, e.b), facing.has(e.b) ? centre(e.b) : null, TREE, 0.25));
}
for (const c of facing) left.items.push(disc(centre(c), mm(0.65), TREE));

// Right: the blocks, and the tree the seam passages make on them. A block's
// node sits on its cell nearest the middle of its facing cells.
const right: Drawing = drawPose(mech, surface, pose, { open, tint, look: LOOK });
const node = new Map<number, Vec3>();
for (const b of blocksOnShow) {
  const mine = [...facing].filter(c => block[c] === b);
  if (mine.length === 0) continue;
  const mean = [0, 1, 2].map(k => mine.reduce((s, c) => s + centre(c)[k]!, 0) / mine.length) as Vec3;
  const nearest = mine.reduce((best, c) => {
    const d = (p: Vec3): number => (p[0] - mean[0]) ** 2 + (p[1] - mean[1]) ** 2 + (p[2] - mean[2]) ** 2;
    return d(centre(c)) < d(centre(best)) ? c : best;
  });
  node.set(b, centre(nearest));
}
for (const e of seamOpen) {
  if (!facing.has(e.a) && !facing.has(e.b)) continue;
  const from = facing.has(e.a) ? node.get(block[e.a]!)! : null;
  const to = facing.has(e.b) ? node.get(block[e.b]!)! : null;
  right.items.push(...bend(from, sharedMid(e.a, e.b), to, TREE, 0.35));
}
for (const at of node.values()) right.items.push(disc(at, mm(1.3), TREE));

// --- side by side ------------------------------------------------------------------

const items: PageItem[] = [
  ...placeDrawing(left, [0, 0], scale),
  ...placeDrawing(right, [w * scale + GAP, 0], scale),
];
writePdf(out, width, h * scale + 1, items);
