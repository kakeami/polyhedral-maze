/**
 * One pose of a folding ring as a picture: the cells on show, seen from one
 * direction, with the walls a design prints on them.
 *
 * The screen draws the same thing with Three.js and a depth buffer; a figure
 * has to be vector, so the surface is put in order instead. The cells on show
 * fall into facets — the flat faces of the pieces, one polygon each — and a
 * BSP tree over the facets that face the viewer gives an order in which each
 * is painted over everything behind it, splitting a facet where no order
 * exists. Each piece of a facet is filled, and its cells, edges and walls are
 * clipped to it, so a split leaves no trace in the drawing.
 */
import type { Vec3 } from '../src/core/types.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import { cross, dot, normalize } from '../src/core/vec3.ts';
import type { Mechanism, KineticState, Mat3 } from '../src/core/kinetic/types.ts';
import { applyPlacement } from '../src/core/kinetic/types.ts';
import type { KineticSurface } from '../src/core/kinetic/surface.ts';
import type { PageItem } from '../src/render/face-page-model.ts';

export type RGB = [number, number, number];

/** Which way the viewer looks from, and which way is up on the page. */
export interface Camera {
  /** From the object towards the viewer. */
  readonly eye: Vec3;
  readonly up: Vec3;
}

export const DIMETRIC: Camera = { eye: [-0.9, -1.7, 1.3], up: [0, 0, 1] };

/** Directions the drawing order is checked from (`figures/check.ts`), one per octant and two edge-on-ish. */
export const CAMERAS: Readonly<Record<string, Camera>> = {
  dimetric: DIMETRIC,
  ...Object.fromEntries([-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [-1, 1].map(sz =>
    [`octant${sx > 0 ? '+' : '-'}${sy > 0 ? '+' : '-'}${sz > 0 ? '+' : '-'}`,
      { eye: [0.7 * sx, 1.1 * sy, 0.9 * sz], up: [0, 0, 1] } as Camera])))),
  steep: { eye: [0.05, -0.1, 1], up: [0, 1, 0] },
  shallow: { eye: [1, -0.03, 0.02], up: [0, 0, 1] },
};

export interface Look {
  /** Paper colour, before shading. */
  readonly paper: RGB;
  readonly wall: RGB;
  /** Wall width in mm on the page: widths do not grow with the drawing. */
  readonly wallWidth: number;
  readonly edge: RGB;
  readonly edgeWidth: number;
  /** Where the light comes from, as `eye` does. */
  readonly light: Vec3;
  /** How much darker a face turned from the light is: 0 is flat colour. */
  readonly shading: number;
}

export const PAPER_LOOK: Look = {
  paper: [252, 250, 245],
  wall: [20, 20, 20],
  wallWidth: 0.15,
  edge: [150, 145, 135],
  edgeWidth: 0.05,
  light: [-0.8, -0.35, 1.6],
  shading: 0.4,
};

export interface PoseOptions {
  readonly camera?: Camera;
  readonly look?: Look;
  /** Classes a design leaves open: no wall is drawn across them. Null draws no walls. */
  readonly open?: ReadonlySet<number> | null;
  /** Cells painted in a colour of their own, shaded like the paper. */
  readonly tint?: ReadonlyMap<number, RGB>;
}

export interface Drawing {
  /**
   * Back to front; coordinates are the drawing's units (a cube's edge is 1)
   * with y down, and line widths are mm on the page.
   */
  readonly items: PageItem[];
  /** Bounding box of `items`, before any line width. */
  readonly min: Vec2;
  readonly max: Vec2;
}

export interface Facet {
  readonly normal: Vec3;
  readonly offset: number;
  /** Convex, counter-clockwise from outside. */
  readonly outline: Vec3[];
  readonly cells: number[];
  readonly walls: [Vec3, Vec3][];
}

/** Corners of one cell in the world, in this state. */
export function cellInWorld(mech: Mechanism, state: KineticState, cell: number): Vec3[] {
  const c = mech.cells[cell]!;
  return c.corners.map(corner => applyPlacement(state[c.piece]!, corner));
}

export function normalOf(pts: readonly Vec3[]): Vec3 {
  // Newell's method: right for any planar polygon, whichever corners are collinear.
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalize([nx, ny, nz]);
}

const keyOf = (p: Vec3): string => p.map(x => Math.round(x * 1e6)).join(',');

/**
 * The facets a pose shows: cells of one piece in one plane that share edges,
 * outlined by their hull.
 *
 * Grouped by sharing an edge rather than by plane alone, because the six
 * triangles of a half cube come in coplanar pairs that meet at one point.
 */
function facetsOf(mech: Mechanism, surface: KineticSurface, poseIndex: number, open: ReadonlySet<number> | null): Facet[] {
  const state = mech.states[poseIndex]!;
  const visible = surface.visibleOfState(poseIndex);
  const cells: number[] = [];
  for (let c = 0; c < mech.cells.length; c++) if (visible[c]) cells.push(c);

  const corners = new Map<number, Vec3[]>();
  const normals = new Map<number, Vec3>();
  for (const c of cells) {
    const pts = cellInWorld(mech, state, c);
    corners.set(c, pts);
    normals.set(c, normalOf(pts));
  }

  // Union cells of one piece that share an edge and a plane.
  const parent = new Map<number, number>(cells.map(c => [c, c]));
  const find = (c: number): number => {
    let r = c;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(c, r);
    return r;
  };
  const byEdge = new Map<string, number[]>();
  for (const c of cells) {
    const pts = corners.get(c)!;
    for (let i = 0; i < pts.length; i++) {
      const a = keyOf(pts[i]!), b = keyOf(pts[(i + 1) % pts.length]!);
      const k = `${mech.cells[c]!.piece}|${a < b ? a + '|' + b : b + '|' + a}`;
      const list = byEdge.get(k);
      if (list) list.push(c);
      else byEdge.set(k, [c]);
    }
  }
  for (const list of byEdge.values()) {
    for (let i = 1; i < list.length; i++) {
      const a = list[0]!, b = list[i]!;
      if (dot(normals.get(a)!, normals.get(b)!) > 1 - 1e-9) parent.set(find(a), find(b));
    }
  }

  const groups = new Map<number, number[]>();
  for (const c of cells) {
    const r = find(c);
    const g = groups.get(r);
    if (g) g.push(c);
    else groups.set(r, [c]);
  }

  const facets: Facet[] = [];
  for (const group of groups.values()) {
    const normal = normals.get(group[0]!)!;
    const pts = group.flatMap(c => corners.get(c)!);
    const outline = hullInPlane(pts, normal);
    const walls: [Vec3, Vec3][] = [];
    if (open) {
      const drawnInternal = new Set<number>();
      for (const c of group) {
        const at = corners.get(c)!;
        const base = surface.sideStart[c]!;
        for (let side = 0; side < at.length; side++) {
          const classId = surface.classOf[base + side]!;
          const kind = surface.classKind[classId]!;
          if (kind === 'rim' || open.has(classId)) continue;
          if (kind === 'internal') {
            if (drawnInternal.has(classId)) continue;
            drawnInternal.add(classId);
          }
          walls.push([at[side]!, at[(side + 1) % at.length]!]);
        }
      }
    }
    facets.push({ normal, offset: dot(normal, outline[0]!), outline, cells: group, walls });
  }
  return facets;
}

/** Convex hull of points lying in one plane, counter-clockwise about `normal`. */
function hullInPlane(pts: readonly Vec3[], normal: Vec3): Vec3[] {
  const u = normalize(Math.abs(normal[0]) < 0.9 ? cross(normal, [1, 0, 0]) : cross(normal, [0, 1, 0]));
  const v = cross(normal, u);
  const unique = new Map<string, Vec3>();
  for (const p of pts) unique.set(keyOf(p), p);
  const list = [...unique.values()].map(p => ({ p, x: dot(p, u), y: dot(p, v) }));
  list.sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (o: typeof list[0], a: typeof list[0], b: typeof list[0]): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof list = [];
  for (const q of list) {
    while (lower.length >= 2 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 1e-12) lower.pop();
    lower.push(q);
  }
  const upper: typeof list = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i]!;
    while (upper.length >= 2 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 1e-12) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map(q => q.p);
}

// --- BSP --------------------------------------------------------------------

export interface Fragment {
  readonly facet: number;
  readonly pts: Vec3[];
}

interface BspNode {
  readonly normal: Vec3;
  readonly offset: number;
  readonly on: Fragment[];
  readonly front: BspNode | null;
  readonly back: BspNode | null;
}

const EPS = 1e-7;

function splitFragment(f: Fragment, normal: Vec3, offset: number): { front: Fragment | null; back: Fragment | null } {
  const d = f.pts.map(p => dot(normal, p) - offset);
  if (d.every(x => x >= -EPS)) return { front: f, back: null };
  if (d.every(x => x <= EPS)) return { front: null, back: f };
  const front: Vec3[] = [];
  const back: Vec3[] = [];
  for (let i = 0; i < f.pts.length; i++) {
    const a = f.pts[i]!, b = f.pts[(i + 1) % f.pts.length]!;
    const da = d[i]!, db = d[(i + 1) % f.pts.length]!;
    if (da >= -EPS) front.push(a);
    if (da <= EPS) back.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db);
      const m: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      front.push(m);
      back.push(m);
    }
  }
  return {
    front: front.length >= 3 ? { facet: f.facet, pts: front } : null,
    back: back.length >= 3 ? { facet: f.facet, pts: back } : null,
  };
}

function buildBsp(fragments: Fragment[], facets: readonly Facet[]): BspNode | null {
  if (fragments.length === 0) return null;
  const splitter = facets[fragments[0]!.facet]!;
  const on: Fragment[] = [];
  const front: Fragment[] = [];
  const back: Fragment[] = [];
  for (const f of fragments) {
    const d = f.pts.map(p => dot(splitter.normal, p) - splitter.offset);
    if (d.every(x => Math.abs(x) <= EPS)) {
      on.push(f);
      continue;
    }
    const parts = splitFragment(f, splitter.normal, splitter.offset);
    if (parts.front) front.push(parts.front);
    if (parts.back) back.push(parts.back);
  }
  return {
    normal: splitter.normal,
    offset: splitter.offset,
    on,
    front: buildBsp(front, facets),
    back: buildBsp(back, facets),
  };
}

function backToFront(node: BspNode | null, eye: Vec3, out: Fragment[]): void {
  if (!node) return;
  const viewerInFront = dot(node.normal, eye) > 0;
  backToFront(viewerInFront ? node.back : node.front, eye, out);
  out.push(...node.on);
  backToFront(viewerInFront ? node.front : node.back, eye, out);
}

// --- 2D clipping --------------------------------------------------------------

function signedArea(poly: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** `subject` cut down to the convex `clip` (Sutherland–Hodgman). */
export function clipPolygon(subject: readonly Vec2[], clip: readonly Vec2[]): Vec2[] {
  const sign = signedArea(clip) >= 0 ? 1 : -1;
  let out = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]!, b = clip[(i + 1) % clip.length]!;
    const side = (p: Vec2): number => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j]!, q = input[(j + 1) % input.length]!;
      const sp = side(p), sq = side(q);
      if (sp >= -1e-12) out.push(p);
      if ((sp > 1e-12 && sq < -1e-12) || (sp < -1e-12 && sq > 1e-12)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** The part of segment `ab` inside the convex `clip` (Cyrus–Beck), or null. */
export function clipSegment(a: Vec2, b: Vec2, clip: readonly Vec2[]): [Vec2, Vec2] | null {
  const sign = signedArea(clip) >= 0 ? 1 : -1;
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i]!, q = clip[(i + 1) % clip.length]!;
    // Inside is side(x) >= 0, with side linear along the segment.
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const s0 = sign * (ex * (a[1] - p[1]) - ey * (a[0] - p[0]));
    const ds = sign * (ex * dy - ey * dx);
    if (Math.abs(ds) < 1e-15) {
      if (s0 < -1e-9) return null;
      continue;
    }
    const t = -s0 / ds;
    if (ds > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1 + 1e-12) return null;
  }
  if (t1 - t0 < 1e-9) return null;
  return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
}

// --- the picture ----------------------------------------------------------------

function shade(colour: RGB, normal: Vec3, look: Look): RGB {
  const lit = Math.max(0, dot(normal, normalize(look.light)));
  const k = 1 - look.shading * (1 - lit);
  return colour.map(c => Math.round(c * k)) as RGB;
}

// --- turning a pose to rest -------------------------------------------------------

const mul = (a: Mat3, b: Mat3): Mat3 =>
  [0, 1, 2].map(i => [0, 1, 2].map(j => a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!)) as unknown as Mat3;
const apply = (m: Mat3, v: Vec3): Vec3 =>
  [0, 1, 2].map(i => m[i]![0]! * v[0] + m[i]![1]! * v[1] + m[i]![2]! * v[2]) as Vec3;

/** Whether `b` beats `a`, comparing criterion by criterion. */
function laterIsBetter(a: readonly number[], b: readonly number[]): boolean {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return b[k]! > a[k]!;
  return false;
}

/** The 24 turns that carry the cubic lattice onto itself. */
export const LATTICE_TURNS: readonly Mat3[] = (() => {
  const out: Mat3[] = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const perm of perms) {
    for (let signs = 0; signs < 8; signs++) {
      const m = [0, 1, 2].map(row => [0, 1, 2].map(col =>
        col === perm[row] ? ((signs >> row) & 1 ? -1 : 1) : 0));
      const det = m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!)
        - m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!)
        + m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
      if (det === 1) out.push(m as unknown as Mat3);
    }
  }
  return out;
})();

/** The same mechanism with every state turned by `turn` about the origin. */
export function turnedMechanism<M extends Mechanism>(mech: M, turn: Mat3): M {
  return {
    ...mech,
    states: mech.states.map(state => state.map(at => ({ rot: mul(turn, at.rot), offset: apply(turn, at.offset) }))),
  };
}

/**
 * The turn a pose is drawn in: lying as low as it will, its longest side
 * across the page, and of what is left the way round that shows the most of
 * it. A shape has no way up of its own — a hand sets it down any way — so
 * this is a choice of picture and nothing else.
 */
export function restingTurn(mech: Mechanism, surface: KineticSurface, poseIndex: number, camera: Camera = DIMETRIC): Mat3 {
  const state = mech.states[poseIndex]!;
  const visible = surface.visibleOfState(poseIndex);
  const eye = normalize(camera.eye);
  const cells: { corners: Vec3[]; normal: Vec3; area: number }[] = [];
  for (let c = 0; c < mech.cells.length; c++) {
    if (!visible[c]) continue;
    const corners = cellInWorld(mech, state, c);
    const normal = normalOf(corners);
    let twice = 0;
    for (let i = 1; i + 1 < corners.length; i++) {
      const a = corners[0]!, b = corners[i]!, d = corners[i + 1]!;
      const cr = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - a[0], d[1] - a[1], d[2] - a[2]]);
      twice += Math.hypot(...cr);
    }
    cells.push({ corners, normal, area: twice / 2 });
  }
  let best: { turn: Mat3; score: number[] } | null = null;
  for (const turn of LATTICE_TURNS) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    let shown = 0;
    for (const cell of cells) {
      for (const p of cell.corners) {
        const q = apply(turn, p);
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k]!, q[k]!);
          hi[k] = Math.max(hi[k]!, q[k]!);
        }
      }
      shown += cell.area * Math.max(0, dot(apply(turn, cell.normal), eye));
    }
    // Rounded, so that what is equal is equal and the next criterion decides.
    const score = [-(hi[2]! - lo[2]!), hi[0]! - lo[0]!, shown].map(x => Math.round(x * 1e6));
    if (!best || laterIsBetter(best.score, score)) best = { turn, score };
  }
  return best!.turn;
}

export interface PaintOrder {
  readonly facets: readonly Facet[];
  /** Back to front. */
  readonly fragments: readonly Fragment[];
  readonly eye: Vec3;
  project(p: Vec3): Vec2;
}

/**
 * The facets of a pose that face the viewer, cut where they must be and put in
 * the order they are painted. Exported so the order can be checked against a
 * ray cast (`figures/check.ts`), which is the only test a picture gets here.
 */
export function paintOrder(
  mech: Mechanism,
  surface: KineticSurface,
  poseIndex: number,
  camera: Camera = DIMETRIC,
  open: ReadonlySet<number> | null = null,
): PaintOrder {
  const eye = normalize(camera.eye);
  const right = normalize(cross(camera.up, eye));
  const up = cross(eye, right);
  const facets = facetsOf(mech, surface, poseIndex, open);
  const facing = facets
    .map((facet, index) => ({ facet, index }))
    .filter(({ facet }) => dot(facet.normal, eye) > 1e-9);
  const tree = buildBsp(facing.map(({ facet, index }) => ({ facet: index, pts: facet.outline })), facets);
  const fragments: Fragment[] = [];
  backToFront(tree, eye, fragments);
  return { facets, fragments, eye, project: (p: Vec3): Vec2 => [dot(p, right), -dot(p, up)] };
}

/** One pose, drawn. Coordinates are in cube edges; scale them with `placeDrawing`. */
export function drawPose(
  mech: Mechanism,
  surface: KineticSurface,
  poseIndex: number,
  options: PoseOptions = {},
): Drawing {
  const look = options.look ?? PAPER_LOOK;
  const state = mech.states[poseIndex]!;
  const { facets, fragments: order, project } =
    paintOrder(mech, surface, poseIndex, options.camera ?? DIMETRIC, options.open ?? null);

  const items: PageItem[] = [];
  const min: Vec2 = [Infinity, Infinity];
  const max: Vec2 = [-Infinity, -Infinity];
  for (const fragment of order) {
    const facet = facets[fragment.facet]!;
    const poly = fragment.pts.map(project);
    for (const p of poly) {
      min[0] = Math.min(min[0], p[0]); min[1] = Math.min(min[1], p[1]);
      max[0] = Math.max(max[0], p[0]); max[1] = Math.max(max[1], p[1]);
    }
    const paper = shade(look.paper, facet.normal, look);
    // Stroked in its own colour, so two pieces of one split facet leave no hairline.
    items.push({ kind: 'poly', pts: poly, fill: paper, stroke: paper, width: 0.02 });
    if (options.tint) {
      for (const c of facet.cells) {
        const colour = options.tint.get(c);
        if (!colour) continue;
        const cell = clipPolygon(cellInWorld(mech, state, c).map(project), poly);
        if (cell.length < 3) continue;
        const fill = shade(colour, facet.normal, look);
        items.push({ kind: 'poly', pts: cell, fill, stroke: fill, width: 0.02 });
      }
    }
    const outline = facet.outline.map(project);
    for (let i = 0; i < outline.length; i++) {
      const seg = clipSegment(outline[i]!, outline[(i + 1) % outline.length]!, poly);
      if (seg) items.push({ kind: 'line', a: seg[0], b: seg[1], stroke: look.edge, width: look.edgeWidth });
    }
    for (const [a, b] of facet.walls) {
      const seg = clipSegment(project(a), project(b), poly);
      if (seg) items.push({ kind: 'line', a: seg[0], b: seg[1], stroke: look.wall, width: look.wallWidth, cap: 'round' });
    }
  }
  return { items, min, max };
}

/** `drawing` scaled by `mmPerUnit` and moved so its box starts at `at`; line widths stay as they are. */
export function placeDrawing(drawing: Drawing, at: Vec2, mmPerUnit: number): PageItem[] {
  const map = (p: Vec2): Vec2 => [
    at[0] + (p[0] - drawing.min[0]) * mmPerUnit,
    at[1] + (p[1] - drawing.min[1]) * mmPerUnit,
  ];
  return drawing.items.map((item): PageItem => {
    if (item.kind === 'poly') return { ...item, pts: item.pts.map(map) };
    if (item.kind === 'line') return { ...item, a: map(item.a), b: map(item.b) };
    return { ...item, at: map(item.at) };
  });
}

/** Size of a drawing's box, in cube edges. */
export function extent(drawing: Drawing): Vec2 {
  return [drawing.max[0] - drawing.min[0], drawing.max[1] - drawing.min[1]];
}
