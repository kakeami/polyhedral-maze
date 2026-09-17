import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { compactTrapezohedron } from './_compact_trapezohedron.ts';

/**
 * Decagonal Trapezohedron (n=10) with aspect ratio H/r = 1.
 * 20 kite faces, 22 vertices, 40 edges. D_10d has no central inversion
 * (n is even).
 */
export class DecagonalTrapezohedron extends Solid {
  protected readonly _faces = normalizeFaces(compactTrapezohedron(10), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
