import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { compactTrapezohedron } from './_compact_trapezohedron.ts';

/**
 * Tetragonal Trapezohedron (n=4) with aspect ratio H/r = 1.
 * 8 kite faces, 10 vertices, 16 edges. D_4d has no central inversion (only
 * the top/bottom apex pair as antipodes).
 */
export class TetragonalTrapezohedron extends Solid {
  protected readonly _faces = normalizeFaces(compactTrapezohedron(4), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
