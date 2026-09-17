import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { compactTrapezohedron } from './_compact_trapezohedron.ts';

/**
 * Pentagonal Trapezohedron (n=5) with aspect ratio H/r = 1.
 * 10 kite faces, 12 vertices, 20 edges. D_5d has central inversion (n is
 * odd) → every face has an antipode.
 */
export class PentagonalTrapezohedron extends Solid {
  protected readonly _faces = normalizeFaces(compactTrapezohedron(5), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
