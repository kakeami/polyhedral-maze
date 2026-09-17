import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { Rhombicosidodecahedron } from '../archimedean/rhombicosidodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Deltoidal Hexecontahedron: dual of the Rhombicosidodecahedron.
 * 60 kite faces, 62 vertices.
 */
export class DeltoidalHexecontahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new Rhombicosidodecahedron().faces()), 1);

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
