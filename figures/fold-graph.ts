/**
 * An object's poses round a ring, a line between two wherever one fold takes
 * the one to the other.
 *
 *   node figures/fold-graph.ts [--object infinity-cube] [--width 160] [--out figures/out/fold-graph.pdf]
 *
 * Poses with the same neighbours — the two hooks between a plank and a cube,
 * one end folded first or the other — share a place on the ring, one inside
 * it and one outside. Each piece keeps the pale colour it has in the nets.
 *
 * It draws only what it can draw truthfully, and refuses the rest: the places
 * must make one ring, and the folds between any two poses must be the steps
 * between them on the drawing, though a fold may pass through shapes that are
 * not poses. The infinity cube and the frame loop pass; on the others some
 * poses are joined only through shapes that are not poses.
 */
import type { PageItem } from '../src/render/face-page-model.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import { foldObject } from '../src/ui/fold-objects.ts';
import { poseDistances } from '../src/core/kinetic/fold-path.ts';
import { build, parseArgs, poseName } from '../bench/lib.ts';
import { OUT_DIR, PIECE_TINTS, writePdf } from './lib.ts';
import { PAPER_LOOK, drawPose, extent, placeDrawing, restingTurn, turnedMechanism } from './scene.ts';
import type { Drawing, RGB } from './scene.ts';

const args = parseArgs(process.argv.slice(2));
const object = foldObject(args.get('object') ?? 'infinity-cube');
const width = Number(args.get('width') ?? 160);
const out = args.get('out') ?? `${OUT_DIR}/fold-graph.pdf`;

// The motion does not depend on the ruling, so one cell a face is enough.
const { mechanism, surface } = build(object, 1);
const graph = mechanism.foldGraph();
const poses = mechanism.states.length;
const name = (p: number): string => poseName(mechanism, p);

// --- the graph of single folds between poses ---------------------------------------

const poseOfShape = new Map(graph.poseAt.map((shape, pose) => [shape, pose]));
const next: number[][] = graph.poseAt.map(shape => [...new Set(
  graph.folds[shape]!.map(f => poseOfShape.get(f.to)).filter((p): p is number => p !== undefined),
)].sort((a, b) => a - b));

const folds = poseDistances(graph);
for (let p = 0; p < poses; p++) {
  const steps = new Array<number>(poses).fill(-1);
  steps[p] = 0;
  const queue = [p];
  for (let head = 0; head < queue.length; head++) {
    for (const q of next[queue[head]!]!) {
      if (steps[q]! >= 0) continue;
      steps[q] = steps[queue[head]!]! + 1;
      queue.push(q);
    }
  }
  for (let q = 0; q < poses; q++) {
    if (steps[q] !== folds[p]![q]) {
      throw new Error(`${object.id}: ${name(p)} to ${name(q)} is ${folds[p]![q]} folds, ${steps[q]} steps on the drawing`);
    }
  }
}

// Places: poses with the same neighbours share one. The places must make a ring.
const placeOf = new Map<string, number[]>();
for (let p = 0; p < poses; p++) {
  const key = next[p]!.join(',');
  (placeOf.get(key) ?? placeOf.set(key, []).get(key)!).push(p);
}
const places = [...placeOf.values()];
const placeIndex = new Array<number>(poses);
places.forEach((members, i) => { for (const p of members) placeIndex[p] = i; });
const around = places.map(members => [...new Set(next[members[0]!]!.map(q => placeIndex[q]!))].sort((a, b) => a - b));
if (around.some(n => n.length !== 2)) throw new Error(`${object.id}: the poses do not make a ring`);
const ring = [placeIndex[0]!];
for (let prev = -1; ;) {
  const at = ring[ring.length - 1]!;
  const go = around[at]!.find(n => n !== prev)!;
  if (go === ring[0]) break;
  if (ring.includes(go)) throw new Error(`${object.id}: the poses do not make a ring`);
  ring.push(go);
  prev = at;
}
if (ring.length !== places.length) throw new Error(`${object.id}: the poses make more than one ring`);

// --- the pictures ------------------------------------------------------------------

const LOOK = { ...PAPER_LOOK, edgeWidth: 0.12, shading: 0.18 };
const tint = new Map<number, RGB>(mechanism.cells.map((cell, c) => [c, PIECE_TINTS[cell.piece % PIECE_TINTS.length]!]));
const pictures: Drawing[] = mechanism.states.map((_, pose) =>
  drawPose(turnedMechanism(mechanism, restingTurn(mechanism, surface, pose)), surface, pose, { tint, look: LOOK }));

const LABEL = 2.2;
const LABEL_GAP = 1.4;
/** Between the two poses of one place, and between any two places. */
const GAP = 3;
const SPACE = 9;
const ASPECT = 0.55;
const EDGE: RGB = [120, 115, 105];

interface Box { x: number; y: number; w: number; h: number }
/** Each pose's picture and name, at `mmPerUnit`, round an ellipse `a` mm across its half width. */
function placed(mmPerUnit: number, a: number): Box[] {
  const size = (p: number): Vec2 => {
    const [w, h] = extent(pictures[p]!);
    return [w * mmPerUnit, h * mmPerUnit + LABEL_GAP + LABEL];
  };
  const b = a * ASPECT;
  const boxes: Box[] = [];
  ring.forEach((place, i) => {
    const angle = Math.PI / 2 - (2 * Math.PI * i) / ring.length;
    const at: Vec2 = [a * Math.cos(angle), -b * Math.sin(angle)];
    const length = Math.hypot(at[0], at[1]);
    const u: Vec2 = [at[0] / length, at[1] / length];
    const members = places[place]!;
    // Side by side along the radius, inside to outside.
    const step = Math.max(...members.map(p => Math.abs(u[0]) * size(p)[0] + Math.abs(u[1]) * size(p)[1])) + GAP;
    members.forEach((p, j) => {
      const shift = (j - (members.length - 1) / 2) * step;
      const [w, h] = size(p);
      boxes[p] = { x: at[0] + u[0] * shift - w / 2, y: at[1] + u[1] * shift - h / 2, w, h };
    });
  });
  return boxes;
}
const across = (boxes: Box[]): number => Math.max(...boxes.map(b => b.x + b.w)) - Math.min(...boxes.map(b => b.x));
/** At `mmPerUnit`, round the widest ellipse that keeps everything on the page. */
function layout(mmPerUnit: number): Box[] {
  let lo = 0, hi = width;
  for (let i = 0; i < 40; i++) {
    const a = (lo + hi) / 2;
    if (across(placed(mmPerUnit, a)) <= width) lo = a;
    else hi = a;
  }
  return placed(mmPerUnit, lo);
}
const fits = (boxes: Box[]): boolean => {
  if (across(boxes) > width + 1e-6) return false;
  for (let p = 0; p < boxes.length; p++) {
    for (let q = p + 1; q < boxes.length; q++) {
      const A = boxes[p]!, B = boxes[q]!;
      const room = placeIndex[p] === placeIndex[q] ? GAP : SPACE;
      if (A.x < B.x + B.w + room && B.x < A.x + A.w + room && A.y < B.y + B.h + room && B.y < A.y + A.h + room) return false;
    }
  }
  return true;
};
let scale = 10;
while (!fits(layout(scale))) {
  scale *= 0.97;
  if (scale < 0.5) throw new Error(`${object.id}: the poses do not fit ${width} mm across`);
}
const boxes = layout(scale);
const left = Math.min(...boxes.map(b => b.x)), top = Math.min(...boxes.map(b => b.y));
for (const b of boxes) { b.x -= left; b.y -= top; }
const height = Math.max(...boxes.map(b => b.y + b.h));

/** Where the line from `from` to `to` leaves the box round `from`, `margin` outside it. */
function leave(box: Box, from: Vec2, to: Vec2, margin: number): Vec2 {
  const d: Vec2 = [to[0] - from[0], to[1] - from[1]];
  let t = Infinity;
  if (d[0] > 0) t = Math.min(t, (box.x + box.w + margin - from[0]) / d[0]);
  if (d[0] < 0) t = Math.min(t, (box.x - margin - from[0]) / d[0]);
  if (d[1] > 0) t = Math.min(t, (box.y + box.h + margin - from[1]) / d[1]);
  if (d[1] < 0) t = Math.min(t, (box.y - margin - from[1]) / d[1]);
  return [from[0] + d[0] * t, from[1] + d[1] * t];
}
const middle = (b: Box): Vec2 => [b.x + b.w / 2, b.y + b.h / 2];

const items: PageItem[] = [];
for (let p = 0; p < poses; p++) {
  for (const q of next[p]!) {
    if (q < p) continue;
    const a = leave(boxes[p]!, middle(boxes[p]!), middle(boxes[q]!), 1);
    const b = leave(boxes[q]!, middle(boxes[q]!), middle(boxes[p]!), 1);
    items.push({ kind: 'line', a, b, stroke: EDGE, width: 0.35, cap: 'round' });
  }
}
for (let p = 0; p < poses; p++) {
  const box = boxes[p]!;
  const [w] = extent(pictures[p]!);
  items.push(...placeDrawing(pictures[p]!, [box.x + (box.w - w * scale) / 2, box.y], scale));
  items.push({ kind: 'text', at: [box.x + box.w / 2, box.y + box.h - LABEL / 2], text: name(p), size: LABEL, color: [30, 30, 30] });
}

const edges = next.reduce((s, n) => s + n.length, 0) / 2;
console.log(`${object.id}: ${poses} poses in ${ring.length} places round a ring, ${edges} single folds; `
  + `${graph.shapes.length} shapes in all; farthest apart ${Math.max(...folds.flat())} folds`);
writePdf(out, width, height, items);
