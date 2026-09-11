/**
 * Per-piece drawing model for large papercraft.
 *
 * Turns the unfolded net into a list of drawing primitives **in page
 * millimetres**, one piece at a time, so a very large model can be printed at
 * a scale the whole-net PDF could never reach (the net has to fit a single
 * sheet; a single face may have a sheet to itself). Where the pieces are
 * actually laid down — one to a page, or several packed onto one sheet — is
 * `face-sheet-layout.ts`'s business; this module draws into whatever rectangle
 * it is given.
 *
 * Two properties make the output buildable and both are enforced here:
 *
 * - **One scale for every piece.** `computeFacePageScale` picks the largest
 *   mm-per-unit factor at which *every* face still fits the printable area,
 *   and every piece then uses it. Per-page fitting would produce pieces that
 *   cannot be joined.
 * - **Nothing is drawn inside the piece that must not survive cutting.** The
 *   assembly aids (edge labels naming the neighbouring face) live in a ring
 *   *outside* the cut line, so they are cut away rather than printed on the
 *   finished model. Only the maze itself and the S/G/W markers stay inside.
 *
 * DOM-free on purpose: the geometry is unit-testable, and `pdf-face-pages.ts`
 * only has to paint the primitives.
 */

import type { NetLayout } from './net-layout.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import type { CellKey, Face } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import type { Vec2 } from '../core/vec2.ts';
import { centroid2 } from '../core/vec2.ts';
import { buildEdgeIndex } from './edge-index.ts';
import { hasTreeEdgeToFace } from './render-utils.ts';
import { cellVerts2d, sharedEdge2d } from './net-cell-geometry.ts';
import { FACE_PAGE_STYLE, type RGB } from './face-page-constants.ts';

// ─── Page geometry ────────────────────────────────────────────────

export interface PageGeometry {
  /** Sheet size in mm. */
  pageW: number;
  pageH: number;
  /** Outer page margin in mm. */
  margin: number;
  /** Band reserved at the top for the title and the locator diagram. */
  headerH: number;
  /** Band reserved at the bottom for the footer line. */
  footerH: number;
  /** Ring kept free around the piece for edge labels (outside the cut line). */
  ring: number;
}

export const A4_PORTRAIT: PageGeometry = {
  pageW: 210, pageH: 297, margin: 10, headerH: 30, footerH: 8, ring: 8,
};

export interface Rect { x: number; y: number; w: number; h: number }

/** Area a piece may occupy, in page mm (y grows downward, as in a PDF). */
export function pieceArea(page: PageGeometry): Rect {
  const { pageW, pageH, margin, headerH, footerH, ring } = page;
  return {
    x: margin + ring,
    y: margin + headerH + ring,
    w: pageW - 2 * (margin + ring),
    h: pageH - margin - headerH - footerH - margin - 2 * ring,
  };
}

// ─── Shared scale across all pages ────────────────────────────────

export interface FacePlacement {
  faceId: number;
  /**
   * How far the piece is turned on the paper, in radians counter-clockwise in
   * net coordinates. The scale only ever asks for 0 or a quarter turn; a
   * packed sheet may ask for any angle, since turning a piece to its tightest
   * bounding box is free — the piece keeps its size, and the locator diagram
   * is turned with it so the two still read the same way up.
   */
  turn: number;
}

/** A quarter turn, the only rotation the page-fitting scale considers. */
export const QUARTER_TURN = Math.PI / 2;

export interface FacePageScale {
  /** Page millimetres per net unit — identical on every page. */
  mmPerUnit: number;
  placements: Map<number, FacePlacement>;
  area: Rect;
}

/**
 * A quarter turn has to beat the upright fit by this much to be used. Without
 * a margin, a square piece flips on floating-point noise; a fraction of a
 * percent of scale is not worth an unexpected rotation.
 */
const TURN_GAIN_THRESHOLD = 1.005;

/**
 * Largest scale at which every face fits the printable area of one page.
 * Each face independently takes the sheet orientation (upright or a quarter
 * turn) that suits it better; the global scale is then the minimum over the
 * fits of the orientations actually chosen.
 */
export function computeFacePageScale(
  layout: NetLayout, page: PageGeometry = A4_PORTRAIT,
): FacePageScale {
  const area = pieceArea(page);
  const placements = new Map<number, FacePlacement>();
  let mmPerUnit = Infinity;

  for (const nf of layout.faces) {
    const [w, h] = bboxSize(nf.vertices2d, 0);
    const upright = Math.min(area.w / w, area.h / h);
    const turned = Math.min(area.w / h, area.h / w);
    const rotate90 = turned > upright * TURN_GAIN_THRESHOLD;
    placements.set(nf.faceId, { faceId: nf.faceId, turn: rotate90 ? QUARTER_TURN : 0 });
    mmPerUnit = Math.min(mmPerUnit, rotate90 ? turned : upright);
  }

  return { mmPerUnit: Number.isFinite(mmPerUnit) ? mmPerUnit : 1, placements, area };
}

/** Median edge length of the solid, in net units. */
export function medianEdgeLength(faces: Face[]): number {
  const lengths: number[] = [];
  for (const f of faces) {
    const v = f.vertices;
    const nv = v.length;
    for (let i = 0; i < nv; i++) {
      const a = v[i]!, b = v[(i + 1) % nv]!;
      lengths.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
  }
  if (lengths.length === 0) return 0;
  lengths.sort((p, q) => p - q);
  return lengths[Math.floor(lengths.length / 2)]!;
}

/**
 * Net units → page mm for one face: the placement's turn, uniform scale, Y
 * flipped (net is y-up, the page is y-down), centred in `rect`.
 */
export function faceToPageTransform(
  vertices2d: Vec2[], placement: FacePlacement, mmPerUnit: number, rect: Rect,
): (p: Vec2) => Vec2 {
  const angle = placement.turn;
  const [w, h] = bboxSize(vertices2d, angle);
  const [minX, minY] = bboxMin(vertices2d, angle);
  const padX = (rect.w - w * mmPerUnit) / 2;
  const padY = (rect.h - h * mmPerUnit) / 2;

  return (p: Vec2): Vec2 => {
    const [x, y] = turn(p, angle);
    return [
      rect.x + padX + (x - minX) * mmPerUnit,
      rect.y + rect.h - padY - (y - minY) * mmPerUnit,
    ];
  };
}

/**
 * The page millimetres a face's bounding box takes in its printed
 * orientation — what a layout needs to reserve for the piece itself.
 */
export function faceFootprint(
  vertices2d: Vec2[], placement: FacePlacement, mmPerUnit: number,
): [number, number] {
  const [w, h] = bboxSize(vertices2d, placement.turn);
  return [w * mmPerUnit, h * mmPerUnit];
}

// ─── Drawing primitives (page mm, y down) ─────────────────────────

export type PageItem =
  | {
      kind: 'poly';
      pts: Vec2[];
      fill?: RGB;
      stroke?: RGB;
      width?: number;
      dash?: [number, number];
    }
  | {
      kind: 'line';
      a: Vec2;
      b: Vec2;
      stroke: RGB;
      width: number;
      dash?: [number, number];
      /**
       * Round ends the wall, as the net renderer does. At a mitred corner the
       * two round caps meet on the bisector and fill the notch that butt ends
       * leave — a notch as deep as half the wall, which at this weight looks
       * like a chipped piece. The cap circle is tangent to both cut lines, so
       * nothing spills past the outline.
       */
      cap?: 'round';
    }
  | {
      kind: 'text';
      at: Vec2;
      text: string;
      /** Cap height in mm; the painter converts to points. */
      size: number;
      color: RGB;
      /** Degrees counter-clockwise, as jsPDF expects. */
      angle?: number;
      /** Centred on `at` unless told otherwise; 'left' starts the text there. */
      align?: 'left' | 'center';
      bold?: boolean;
      /**
       * Rule under the text. Every face number carries one: a loose piece is
       * turned every which way while it is being assembled, and without the
       * rule 6 and 9 — or 16 and 91 — are the same mark.
       */
      underline?: boolean;
    };

export interface FacePageOptions {
  /**
   * Where to draw the piece (page mm). Defaults to the full-page piece area
   * the scale was computed from; a panel on a packed sheet passes its own,
   * which is the same scale on less paper.
   */
  area?: Rect;
  /** Draw the locator diagram into this rect (page mm). */
  locator?: Rect;
  /**
   * Turn the piece as this says instead of as the scale chose. A packed sheet
   * uses it to lay a piece down in its tightest orientation.
   */
  placement?: FacePlacement;
}

export interface FacePage {
  faceId: number;
  placement: FacePlacement;
  items: PageItem[];
  /** Face ids this piece is joined to, in edge order. */
  neighbors: (number | null)[];
}

/**
 * Everything that gets drawn on the page for one face: cut guide, maze walls,
 * markers, edge labels and (optionally) the locator diagram.
 */
export function buildFacePage(
  layout: NetLayout,
  mazeGraph: MazeGraph,
  maze: Maze,
  scale: FacePageScale,
  faceId: number,
  options: FacePageOptions = {},
): FacePage {
  const faces = mazeGraph.polyhedron.faces();
  const face = faces.find(f => f.id === faceId);
  const netFace = layout.faces.find(nf => nf.faceId === faceId);
  if (!face || !netFace) throw new Error(`Unknown face id: ${faceId}`);

  const n = mazeGraph.n;
  const grid = mazeGraph.grids.get(faceId)!;
  const edgeIndex = buildEdgeIndex(faces);
  const placement = options.placement ?? scale.placements.get(faceId)!;
  const area = options.area ?? scale.area;
  const tf = faceToPageTransform(netFace.vertices2d, placement, scale.mmPerUnit, area);

  const verts2d = netFace.vertices2d;
  const pagePts = verts2d.map(tf);
  const center = centroid2(pagePts);
  const nv = face.vertices.length;
  const S = FACE_PAGE_STYLE;

  const items: PageItem[] = [];
  const neighbors: (number | null)[] = [];

  // 1. Cut guide: dashed, on the outline itself. The boundary wall covers most
  //    of it and is inset so its outer edge coincides with the guide; the
  //    dashes stay visible across the passage gaps, where the outline has no
  //    wall to follow.
  for (let i = 0; i < nv; i++) {
    items.push({
      kind: 'line', a: pagePts[i]!, b: pagePts[(i + 1) % nv]!,
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    });
  }

  // 2. Cell markers (behind the walls, inside the piece — these belong on the
  //    finished model).
  for (const { cell, color, label } of markersOnFace(maze, faceId)) {
    const cv = cellVerts2d(verts2d, cell, n, grid.kind).map(tf);
    items.push({ kind: 'poly', pts: cv, fill: color });
    const c = centroid2(cv);
    items.push({
      kind: 'text',
      at: c,
      text: label,
      size: inradius(cv, c) * S.labelInradiusScale,
      color: S.labelColor,
      bold: true,
    });
  }

  // 3. Internal walls — grid edges the spanning tree did not open.
  const treeSet = new Set<string>();
  for (const [a, b] of maze.tree.edges()) {
    treeSet.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  for (const [c1, c2] of grid.internalEdges()) {
    const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`;
    if (treeSet.has(key)) continue;
    const edge = sharedEdge2d(
      cellVerts2d(verts2d, c1, n, grid.kind),
      cellVerts2d(verts2d, c2, n, grid.kind),
    );
    if (!edge) continue;
    items.push({
      kind: 'line', a: tf(edge[0]), b: tf(edge[1]),
      stroke: S.wallColor, width: S.wallWidth, cap: 'round',
    });
  }

  // 4. Boundary walls, with a gap wherever the maze passes to the neighbour.
  //    Every edge of a face page is a cut edge — including seams between
  //    coplanar faces, which the net renderer can draw as a mere grid
  //    division because there the paper stays continuous.
  const insetPts = insetPolygon(pagePts, center, S.boundaryInset);
  for (let i = 0; i < nv; i++) {
    const adjFaceId = edgeIndex.findAdjacentFace(faceId, i);
    neighbors.push(adjFaceId);
    const es = insetPts[i]!;
    const ee = insetPts[(i + 1) % nv]!;

    let boundaryCells: CellKey[];
    try {
      boundaryCells = grid.boundaryCells(face.vertices[i]!, face.vertices[(i + 1) % nv]!);
    } catch {
      items.push({
        kind: 'line', a: es, b: ee,
        stroke: S.boundaryColor, width: S.boundaryWidth, cap: 'round',
      });
      continue;
    }

    const du: Vec2 = [(ee[0] - es[0]) / n, (ee[1] - es[1]) / n];
    for (let j = 0; j < boundaryCells.length; j++) {
      const cell = boundaryCells[j]!;
      if (adjFaceId !== null && hasTreeEdgeToFace(cell, maze.tree, adjFaceId)) continue;
      items.push({
        kind: 'line',
        a: [es[0] + j * du[0], es[1] + j * du[1]],
        b: [es[0] + (j + 1) * du[0], es[1] + (j + 1) * du[1]],
        stroke: S.boundaryColor,
        width: S.boundaryWidth,
        cap: 'round',
      });
    }
  }

  // 5. Edge labels — the face each edge joins. Placed outside the cut line so
  //    they are cut away; without glue tabs these are the only join hints.
  const faceById = new Map(faces.map(f => [f.id, f]));
  for (let i = 0; i < nv; i++) {
    const adjFaceId = neighbors[i]!;
    if (adjFaceId === null) continue;
    const other = faceById.get(adjFaceId)!;
    const coplanar = dot3(face.normal, other.normal) > 1 - 1e-9;
    const a = pagePts[i]!;
    const b = pagePts[(i + 1) % nv]!;
    const [p, q] = offsetOutward(a, b, center, S.edgeLabelOffset);
    items.push({
      kind: 'text',
      at: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2],
      text: `${adjFaceId}${coplanar ? S.flatSeamMark : ''}`,
      size: S.edgeLabelSize,
      color: S.edgeLabelColor,
      angle: readableAngle(a, b),
      underline: true,
    });
  }

  if (options.locator) {
    items.push(...buildLocatorItems(layout, faceId, placement, options.locator));
  }

  return { faceId, placement, items, neighbors };
}

/**
 * The whole net in miniature with this piece filled in — where the page sits
 * in the overall unfolding. Turned the same quarter turn as the piece, so the
 * big drawing and the diagram always read in the same orientation.
 */
export function buildLocatorItems(
  layout: NetLayout, faceId: number, placement: FacePlacement, rect: Rect,
): PageItem[] {
  const all: Vec2[] = layout.faces.flatMap(nf => nf.vertices2d);
  if (all.length === 0) return [];

  const [w, h] = bboxSize(all, placement.turn);
  const [minX, minY] = bboxMin(all, placement.turn);
  const s = Math.min(rect.w / (w || 1), rect.h / (h || 1));
  const padX = (rect.w - w * s) / 2;
  const padY = (rect.h - h * s) / 2;
  const tf = (p: Vec2): Vec2 => {
    const [x, y] = turn(p, placement.turn);
    return [
      rect.x + padX + (x - minX) * s,
      rect.y + rect.h - padY - (y - minY) * s,
    ];
  };

  const S = FACE_PAGE_STYLE;
  const items: PageItem[] = [];
  const labels: PageItem[] = [];
  for (const nf of layout.faces) {
    const pts = nf.vertices2d.map(tf);
    const highlighted = nf.faceId === faceId;
    items.push(highlighted
      ? { kind: 'poly', pts, fill: S.locatorHighlight, stroke: S.locatorColor, width: S.locatorWidth }
      : { kind: 'poly', pts, stroke: S.locatorColor, width: S.locatorWidth });

    // Numbered, so the diagram says *which* neighbours surround the piece and
    // not merely where it sits. A face too small to hold a legible number is
    // left blank rather than smudged: that is what the index sheet is for.
    const c = centroid2(pts);
    const size = labelSize(
      inradius(pts, c), String(nf.faceId).length,
      S.locatorLabelScale, S.locatorLabelMaxWidthRatio,
    );
    if (size < S.locatorLabelMinSize) continue;
    labels.push({
      kind: 'text',
      at: c,
      text: String(nf.faceId),
      size,
      color: highlighted ? S.locatorLabelHighlightColor : S.locatorLabelColor,
      bold: true,
      underline: true,
    });
  }
  // Labels last: the highlighted face is filled, and a fill painted over its
  // own number would erase it.
  return [...items, ...labels];
}

// ─── Helpers ──────────────────────────────────────────────────────

function markersOnFace(
  maze: Maze, faceId: number,
): { cell: CellKey; color: RGB; label: string }[] {
  const S = FACE_PAGE_STYLE;
  const all: { cell: CellKey; color: RGB; label: string }[] = [
    { cell: maze.start, color: S.startColor, label: 'S' },
    { cell: maze.goal, color: S.goalColor, label: 'G' },
  ];
  if (maze.warp) {
    all.push(
      { cell: maze.warp.cellA, color: S.warpColor, label: 'W' },
      { cell: maze.warp.cellB, color: S.warpColor, label: 'W' },
    );
  }
  return all.filter(m => parseCell(m.cell).faceId === faceId);
}

/** `p` turned `angle` radians counter-clockwise in net coordinates. */
function turn(p: Vec2, angle: number): Vec2 {
  if (angle === 0) return [p[0], p[1]];
  const c = Math.cos(angle), s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Bounding box of `pts` once turned by `angle`. */
export function turnedBBoxSize(pts: Vec2[], angle: number): [number, number] {
  return bboxSize(pts, angle);
}

function bboxSize(pts: Vec2[], angle: number): [number, number] {
  const [minX, minY, maxX, maxY] = bbox(pts, angle);
  return [maxX - minX, maxY - minY];
}

function bboxMin(pts: Vec2[], angle: number): [number, number] {
  const [minX, minY] = bbox(pts, angle);
  return [minX, minY];
}

function bbox(pts: Vec2[], angle: number): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    const [x, y] = turn(p, angle);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/**
 * The piece outline pushed `inset` mm inward, corners mitred.
 *
 * Offsetting each edge on its own leaves a wedge of white at every corner as
 * wide as the wall itself; at this line weight that reads as a chipped piece.
 * Mitring puts the corner back on the bisector, where the wall's outer edge
 * still meets the cut line exactly. A corner too sharp to mitre sanely (the
 * miter point would run away up the bisector) keeps the plain offset.
 */
function insetPolygon(pts: Vec2[], center: Vec2, inset: number): Vec2[] {
  const nv = pts.length;
  const edges = pts.map((p, i) => offsetOutward(p, pts[(i + 1) % nv]!, center, -inset));
  const limit = MITER_LIMIT * inset;
  return pts.map((vertex, i) => {
    const prev = edges[(i - 1 + nv) % nv]!;
    const cur = edges[i]!;
    const corner = lineIntersection(prev[0], prev[1], cur[0], cur[1]);
    if (!corner) return cur[0];
    return Math.hypot(corner[0] - vertex[0], corner[1] - vertex[1]) > limit
      ? cur[0]
      : corner;
  });
}

/** How far up the bisector a mitred corner may travel, in wall insets. */
const MITER_LIMIT = 6;

/** Where the infinite lines through ab and cd meet, or null if they are parallel. */
function lineIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  return [a[0] + t * r[0], a[1] + t * r[1]];
}

/** Helvetica figures are tabular: every digit advances by this fraction of an em. */
const DIGIT_ADVANCE = 0.556;

/**
 * Largest font size at which a number of `digits` digits sits inside a face's
 * inscribed circle — height-limited for one digit, width-limited for three.
 */
function labelSize(
  inr: number, digits: number, scale: number, maxWidthRatio: number,
): number {
  if (!Number.isFinite(inr) || inr <= 0) return 0;
  return Math.min(inr * scale, (inr * maxWidthRatio) / (digits * DIGIT_ADVANCE));
}

/** Shift segment ab away from `from` by `dist` mm. */
function offsetOutward(a: Vec2, b: Vec2, from: Vec2, dist: number): [Vec2, Vec2] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return [a, b];
  const nx = -dy / len, ny = dx / len;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const s = (from[0] - mx) * nx + (from[1] - my) * ny > 0 ? -1 : 1;
  const ox = nx * s * dist, oy = ny * s * dist;
  return [[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy]];
}

/**
 * Angle for text running along ab, in degrees counter-clockwise (jsPDF's
 * convention) on a y-down page, always within ±90° so the label reads
 * upright rather than upside down.
 */
function readableAngle(a: Vec2, b: Vec2): number {
  let deg = -Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

/** Min distance from a point to any edge of a polygon — the inscribed radius. */
function inradius(verts: Vec2[], center: Vec2): number {
  let min = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!, b = verts[(i + 1) % verts.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    const d = Math.abs((center[0] - a[0]) * dy - (center[1] - a[1]) * dx) / len;
    if (d < min) min = d;
  }
  return min;
}

function dot3(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}
