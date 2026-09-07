/**
 * 2D cell geometry on an unfolded face (mirrors `cellVertices3d`).
 *
 * Shared by the SVG net renderer and the per-face page model so both derive
 * cell outlines from exactly the same subdivision rules.
 */

import type { Vec2 } from '../core/vec2.ts';
import { add2, sub2, scale2, centroid2 } from '../core/vec2.ts';
import type { CellKey } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import type { GridKind } from '../core/face-grid.ts';
import { VERTEX_EPSILON } from '../core/constants.ts';

const RADIAL_SECTORS_2D: Partial<Record<GridKind, number>> = {
  kite: 4, pent: 5, hex: 6, oct: 8, dec: 10,
};

/** Outline of one maze cell, in the same 2D frame as `faceVerts`. */
export function cellVerts2d(
  faceVerts: Vec2[], cell: CellKey, n: number, kind: GridKind,
): Vec2[] {
  const { row, col } = parseCell(cell);

  if (kind === 'rect') {
    const o = faceVerts[0]!;
    const u = sub2(faceVerts[1]!, o);
    const v = sub2(faceVerts[3]!, o);
    return [
      add2(o, add2(scale2(u, col / n), scale2(v, row / n))),
      add2(o, add2(scale2(u, (col + 1) / n), scale2(v, row / n))),
      add2(o, add2(scale2(u, (col + 1) / n), scale2(v, (row + 1) / n))),
      add2(o, add2(scale2(u, col / n), scale2(v, (row + 1) / n))),
    ];
  }

  if (kind === 'tri') {
    const o = faceVerts[0]!;
    const u = sub2(faceVerts[1]!, o);
    const v = sub2(faceVerts[2]!, o);
    return triCellVerts(o, u, v, row, col, n);
  }

  const sectors = RADIAL_SECTORS_2D[kind];
  if (sectors !== undefined) {
    const center = centroid2(faceVerts);
    const sector = Math.floor(row / n);
    const localRow = row - sector * n;
    const su = sub2(faceVerts[sector]!, center);
    const sv = sub2(faceVerts[(sector + 1) % sectors]!, center);
    return triCellVerts(center, su, sv, localRow, col, n);
  }

  throw new Error(`Unsupported grid kind: ${kind}`);
}

function triCellVerts(o: Vec2, u: Vec2, v: Vec2, r: number, c: number, n: number): Vec2[] {
  const k = Math.floor(c / 2);
  const vtx = (a: number, b: number): Vec2 =>
    add2(o, add2(scale2(u, a / n), scale2(v, b / n)));
  if (c % 2 === 0) {
    return [vtx(r - k, k), vtx(r - k + 1, k), vtx(r - k, k + 1)];
  } else {
    return [vtx(r - k, k), vtx(r - k, k + 1), vtx(r - k - 1, k + 1)];
  }
}

/** Centre of one maze cell, in the same 2D frame as `faceVerts`. */
export function cellCenter2dNet(
  faceVerts: Vec2[], cell: CellKey, n: number, kind: GridKind,
): Vec2 {
  return centroid2(cellVerts2d(faceVerts, cell, n, kind));
}

/** The edge two neighbouring cell outlines have in common, if any. */
export function sharedEdge2d(v1: Vec2[], v2: Vec2[]): [Vec2, Vec2] | null {
  const eps = VERTEX_EPSILON;
  const shared: Vec2[] = [];
  for (const a of v1) {
    for (const b of v2) {
      if (Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps) {
        shared.push(a);
        break;
      }
    }
  }
  return shared.length >= 2 ? [shared[0]!, shared[1]!] : null;
}
