import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { Rhombicuboctahedron } from '../archimedean/rhombicuboctahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Deltoidal Icositetrahedron: dual of the Rhombicuboctahedron.
 * 24 kite faces, 26 vertices.
 */
export class DeltoidalIcositetrahedron implements Polyhedron {
  private _faces: Face[] = dualize(new Rhombicuboctahedron().faces());

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
