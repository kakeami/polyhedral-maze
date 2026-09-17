import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { Rhombicuboctahedron } from '../archimedean/rhombicuboctahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Deltoidal Icositetrahedron: dual of the Rhombicuboctahedron.
 * 24 kite faces, 26 vertices.
 */
export class DeltoidalIcositetrahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new Rhombicuboctahedron().faces()), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
