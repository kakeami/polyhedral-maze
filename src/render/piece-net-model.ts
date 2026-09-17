/**
 * One piece of a turning object, laid flat with its maze on it.
 *
 * Both objects cut from a catalogued solid print the same thing: a connected
 * set of that solid's faces, unfolded, with the walls the design leaves
 * standing drawn on their cells and the mouth where the bulkhead goes left
 * open. The two differ only in which faces a piece keeps — the glued pair
 * drops the face it is glued at, a cut solid keeps everything and shares it
 * out — so the drawing lives here and is called twice rather than written
 * twice.
 *
 * DOM-free, like everything else that ends in `-model.ts`.
 */

import type { Vec2 } from '../core/vec2.ts';
import { centroid2 } from '../core/vec2.ts';
import type { CellKey, Face } from '../core/types.ts';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { PageItem } from './face-page-model.ts';
// The rim is ruled the way a printed face of a solid is ruled, by calling the
// same code rather than by imitating it.
import { insetPolygon } from './face-page-model.ts';
import { computeNetLayout } from './net-layout.ts';
import type { NetLayout } from './net-layout.ts';
import { cellVerts2d } from './net-cell-geometry.ts';
import type { EdgeIndex } from './edge-index.ts';
import { glueTabQuad } from './kinetic-sheet-parts.ts';
import { STACK_SHEET_STYLE as S } from './kinetic-sheet-constants.ts';

/** A piece's faces, unfolded, and the numbering the unfolder used. */
export interface PieceLayout {
  readonly faces: readonly Face[];
  readonly layout: NetLayout;
  /** Face id of the solid -> the id the net knows it by. */
  readonly netIdOf: ReadonlyMap<number, number>;
  /** Flat outline of each face, by the solid's own face id. */
  readonly flatOf: ReadonlyMap<number, Vec2[]>;
  /** Size of the net, in the solid's own units. */
  readonly width: number;
  readonly height: number;
}

/**
 * A set of faces as something the unfolder will lay flat.
 *
 * The faces are renumbered 0, 1, 2, ... because the unfolder reaches for
 * `faces[id]`: leave a gap in the numbering and it walks off the end of its own
 * array. Everything else keeps the solid's real face ids, so the translation
 * happens here and nowhere else.
 */
export function layOutPiece(polyhedron: Polyhedron, faces: readonly Face[]): PieceLayout {
  const netIdOf = new Map(faces.map((face, index) => [face.id, index]));
  const renumbered = faces.map((face, index) => ({ ...face, id: index }));
  const layout = computeNetLayout({
    faces: () => renumbered,
    faceAdjacency: () => polyhedron.faceAdjacency(),
    gridForFace: (face, n) => polyhedron.gridForFace(face, n),
  });
  const byNetId = new Map(layout.faces.map(f => [f.faceId, f.vertices2d]));
  const flatOf = new Map<number, Vec2[]>();
  for (const face of faces) {
    const flat = byNetId.get(netIdOf.get(face.id)!);
    if (flat) flatOf.set(face.id, flat);
  }
  return { faces, layout, netIdOf, flatOf, width: layout.width, height: layout.height };
}

export interface PieceNetRequest {
  readonly piece: PieceLayout;
  readonly polyhedron: Polyhedron;
  /** Over the *whole* solid: a piece's mouth is an edge whose face went elsewhere. */
  readonly edgeIndex: EdgeIndex;
  /** Cells along one edge of a face. */
  readonly n: number;
  /** Millimetres to one unit of the solid's own coordinates. */
  readonly scale: number;
  /** Page position of the net's top-left corner, before the glue tabs. */
  readonly origin: Vec2;
  /** How far a glue tab stands off an edge. */
  readonly tabMm: number;
  /** Millimetres one cell comes to, which sets how near counts as on an edge. */
  readonly cellMm: number;
  /** This piece's cell index for a cell of a face, or undefined. */
  cellIndexOf(faceId: number, cell: CellKey): number | undefined;
  isOpen(cellIndex: number, side: number): boolean;
  readonly start?: number;
  readonly goal?: number;
}

/**
 * The piece as a draw list, in page millimetres.
 *
 * Drawn in the order the net PDF draws its own: glue tabs underneath, then the
 * faces themselves over any tab that falls across one, then the guides, then
 * the maze — the rim over the walls, and the letters over everything, because
 * they are the puzzle and a wall is only a wall.
 */
export function drawPieceNet(request: PieceNetRequest): PageItem[] {
  const { piece, polyhedron, edgeIndex, n, scale, origin, tabMm, cellMm } = request;
  const { layout, netIdOf } = piece;

  // Page millimetres run y-down and the net comes out y-up.
  const place = ([x, y]: Vec2): Vec2 =>
    [origin[0] + x * scale, origin[1] + (layout.height - y) * scale];

  const tabs: PageItem[] = [];
  const paper: PageItem[] = [];
  const guides: PageItem[] = [];
  const marks: PageItem[] = [];
  const walls: PageItem[] = [];
  const rim: PageItem[] = [];
  const letters: PageItem[] = [];

  for (const face of piece.faces) {
    const flat = piece.flatOf.get(face.id);
    if (!flat) continue;
    const grid = polyhedron.gridForFace(face, n);
    const sides = face.vertices.length;
    const outline = flat.map(place);
    const inside = centroid2(outline);
    // Where a rim wall runs: the outline pushed in by half the wall's width,
    // corners mitred, so the wall's outer edge lands on the cut guide.
    const rimLine = insetPolygon(outline, inside, S.boundaryInset);
    // A ten-thousandth of a cell: far above what the arithmetic loses and far
    // below any real gap, so what it separates is a cell side lying *on* an
    // edge of the face from one merely near it.
    const onEdgeTol = cellMm * 1e-4;
    const folds: boolean[] = [];

    paper.push({ kind: 'poly', pts: outline, fill: S.paperColor });

    // Outline: a cut guide where the face's edge is an edge of the net, and
    // nothing at all where the neighbour was unfolded beside it. A crease is
    // not drawn, for the same reason the net PDF does not draw one: the line
    // would have to run straight through the passages that cross it, and a
    // dashed line across an opening reads as a wall. What marks a crease is
    // the rim wall on either side of the gap. An edge whose neighbouring face
    // went to another piece gets no tab either — the unfolder only gives one
    // to an edge whose partner is in the same net — and that is exactly the
    // mouth the bulkhead closes.
    for (let e = 0; e < sides; e++) {
      const a = outline[e]!;
      const b = outline[(e + 1) % sides]!;
      const neighbour = edgeIndex.findAdjacentFace(face.id, e);
      const here = netIdOf.get(face.id)!;
      const there = neighbour === null ? undefined : netIdOf.get(neighbour);
      const folded = there !== undefined && layout.foldPairs.has(
        here < there ? `${here}:${there}` : `${there}:${here}`,
      );
      folds[e] = folded;
      if (folded) continue;
      guides.push({ kind: 'line', a, b, stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash });
      if (layout.tabOwners.has(`${here}:${e}`)) {
        const height = tabMm * 0.7;
        const taper = Math.min(height, Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
        tabs.push({
          kind: 'poly', pts: glueTabQuad(a, b, height, taper, inside), fill: S.glueFill,
        });
      }
    }

    for (const cell of grid.cells()) {
      const index = request.cellIndexOf(face.id, cell);
      if (index === undefined) continue;
      const corners = cellVerts2d(flat, cell, n, grid.kind).map(place);
      if (index === request.start || index === request.goal) {
        marks.push({
          kind: 'poly', pts: corners,
          fill: index === request.start ? S.startColor : S.goalColor,
        });
        letters.push({
          kind: 'text', at: centroid2(corners), text: index === request.start ? 'S' : 'G',
          size: S.markerTextSize, color: S.markerTextColor,
        });
      }
      for (let side = 0; side < corners.length; side++) {
        if (request.isOpen(index, side)) continue;
        const a = corners[side]!;
        const b = corners[(side + 1) % corners.length]!;
        const e = faceEdgeUnder(outline, a, b, onEdgeTol);
        if (e === null) {
          walls.push({ kind: 'line', a, b, stroke: S.wallColor, width: S.wallWidth, cap: 'round' });
          continue;
        }
        // A wall on an edge of the face is the rim of the finished piece:
        // heavier, and pulled in off a cut so the knife does not take half of
        // it away. On a fold it stays put, astride the crease.
        const [p, q] = folds[e]
          ? [a, b]
          : [onInset(outline, rimLine, e, a), onInset(outline, rimLine, e, b)];
        rim.push({
          kind: 'line', a: p, b: q,
          stroke: S.boundaryColor, width: S.boundaryWidth, cap: 'round',
        });
      }
    }
  }

  return [...tabs, ...paper, ...guides, ...marks, ...walls, ...rim, ...letters];
}

/**
 * Which edge of `outline` the segment ab lies along, or null if it lies inside
 * the face.
 *
 * Asked of every closed side of every cell, because a cell does not know
 * whether it is at the edge of its face: which sides those are depends on the
 * grid, and every grid answers differently. The geometry answers for all of
 * them at once.
 */
function faceEdgeUnder(
  outline: readonly Vec2[], a: Vec2, b: Vec2, tol: number,
): number | null {
  for (let e = 0; e < outline.length; e++) {
    const p = outline[e]!;
    const q = outline[(e + 1) % outline.length]!;
    if (onEdge(p, q, a, tol) && onEdge(p, q, b, tol)) return e;
  }
  return null;
}

/** Whether x lies on the segment pq, to within `tol` millimetres. */
function onEdge(p: Vec2, q: Vec2, x: Vec2, tol: number): boolean {
  const ex = q[0] - p[0];
  const ey = q[1] - p[1];
  const len = Math.hypot(ex, ey);
  if (len < tol) return false;
  const along = ((x[0] - p[0]) * ex + (x[1] - p[1]) * ey) / len;
  const off = Math.abs((x[0] - p[0]) * ey - (x[1] - p[1]) * ex) / len;
  return off <= tol && along >= -tol && along <= len + tol;
}

/** How far along pq the point x lies, as a fraction of the whole edge. */
function fractionAlong(p: Vec2, q: Vec2, x: Vec2): number {
  const ex = q[0] - p[0];
  const ey = q[1] - p[1];
  const square = ex * ex + ey * ey;
  if (square === 0) return 0;
  return ((x[0] - p[0]) * ex + (x[1] - p[1]) * ey) / square;
}

/** The point of edge `e` at the same fraction along, on the inset outline. */
function onInset(
  outline: readonly Vec2[], inset: readonly Vec2[], e: number, x: Vec2,
): Vec2 {
  const nv = outline.length;
  const t = fractionAlong(outline[e]!, outline[(e + 1) % nv]!, x);
  const p = inset[e]!;
  const q = inset[(e + 1) % nv]!;
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}
