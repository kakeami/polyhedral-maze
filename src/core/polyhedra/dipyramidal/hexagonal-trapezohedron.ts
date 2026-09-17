import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { compactTrapezohedron } from './_compact_trapezohedron.ts';

/**
 * Hexagonal Trapezohedron (n=6) with aspect ratio H/r = 1.
 * 12 kite faces, 14 vertices, 24 edges. D_6d has no central inversion (n is
 * even) — only the two apex faces pair up as antipodes? Actually no: the
 * 2n equator kites are arranged radially, antipodes determined empirically.
 */
export class HexagonalTrapezohedron extends Solid {
  protected readonly _faces = normalizeFaces(compactTrapezohedron(6), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
