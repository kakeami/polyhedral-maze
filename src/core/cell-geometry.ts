/**
 * 3D outline of one maze cell on a face.
 *
 * Pure geometry over a face and a grid kind, with no notion of a maze or a
 * renderer: the same subdivision rule the 2D net uses (`net-cell-geometry.ts`)
 * and the one a kinetic mechanism needs to turn a catalogued solid into cells.
 * It lives in core because both of those call it, and one of them must not
 * depend on the other.
 */

import type { Vec3, CellKey, Face } from './types.ts';
import { parseCell } from './types.ts';
import { add, sub, scale, mean } from './vec3.ts';
import type { GridKind } from './face-grid.ts';

const RADIAL_SECTORS: Partial<Record<GridKind, number>> = {
  kite: 4, pent: 5, hex: 6, oct: 8, dec: 10,
};

/**
 * Vertices of a cell polygon, in the face's own 3D coordinates.
 *
 * Points on a face edge come out as an exact interpolation between two of the
 * face's vertices, which is what lets two faces that share an edge — on the
 * same solid or on two solids glued together — agree on where the cells meet.
 */
export function cellVertices3d(
  face: Face, cell: CellKey, n: number, kind: GridKind,
): Vec3[] {
  const { row, col } = parseCell(cell);

  if (kind === 'rect') {
    const o = face.vertices[0]!;
    const u = sub(face.vertices[1]!, o);
    const v = sub(face.vertices[3]!, o);
    const r = row, c = col;
    return [
      add(o, add(scale(u, c / n), scale(v, r / n))),
      add(o, add(scale(u, (c + 1) / n), scale(v, r / n))),
      add(o, add(scale(u, (c + 1) / n), scale(v, (r + 1) / n))),
      add(o, add(scale(u, c / n), scale(v, (r + 1) / n))),
    ];
  }

  if (kind === 'tri') {
    const o = face.vertices[0]!;
    const u = sub(face.vertices[1]!, o);
    const v = sub(face.vertices[2]!, o);
    return triCellVerts(o, u, v, row, col, n);
  }

  const sectors = RADIAL_SECTORS[kind];
  if (sectors !== undefined) {
    const center = mean(face.vertices);
    const sector = Math.floor(row / n);
    const localRow = row - sector * n;
    const su = sub(face.vertices[sector]!, center);
    const sv = sub(face.vertices[(sector + 1) % sectors]!, center);
    return triCellVerts(center, su, sv, localRow, col, n);
  }

  throw new Error(`Unsupported grid kind: ${kind}`);
}

function triCellVerts(
  origin: Vec3, u: Vec3, v: Vec3,
  r: number, c: number, n: number,
): Vec3[] {
  const k = Math.floor(c / 2);
  const vtx = (a: number, b: number): Vec3 =>
    add(origin, add(scale(u, a / n), scale(v, b / n)));

  if (c % 2 === 0) {
    return [vtx(r - k, k), vtx(r - k + 1, k), vtx(r - k, k + 1)];
  } else {
    return [vtx(r - k, k), vtx(r - k, k + 1), vtx(r - k - 1, k + 1)];
  }
}
