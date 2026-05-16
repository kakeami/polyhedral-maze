import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { Cuboctahedron } from '../archimedean/cuboctahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Rhombic Dodecahedron: dual of the Cuboctahedron.
 * 12 rhombic faces, 14 vertices.
 */
export class RhombicDodecahedron implements Polyhedron {
  private _faces: Face[] = dualize(new Cuboctahedron().faces());

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new RectGrid(face, n);
  }
}
