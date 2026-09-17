import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { compactTrapezohedron } from './_compact_trapezohedron.ts';

/**
 * Octagonal Trapezohedron (n=8) with aspect ratio H/r = 1.
 * 16 kite faces, 18 vertices, 32 edges. D_8d has no central inversion (n is
 * even).
 */
export class OctagonalTrapezohedron extends Solid {
  protected readonly _faces = normalizeFaces(compactTrapezohedron(8), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
