import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { Rhombicosidodecahedron } from '../archimedean/rhombicosidodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Deltoidal Hexecontahedron: dual of the Rhombicosidodecahedron.
 * 60 kite faces, 62 vertices.
 */
export class DeltoidalHexecontahedron implements Polyhedron {
  private _faces: Face[] = normalizeFaces(dualize(new Rhombicosidodecahedron().faces()), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
