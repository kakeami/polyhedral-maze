import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { Icosidodecahedron } from '../archimedean/icosidodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Rhombic Triacontahedron: dual of the Icosidodecahedron.
 * 30 golden rhombic faces, 32 vertices.
 */
export class RhombicTriacontahedron implements Polyhedron {
  private _faces: Face[] = normalizeFaces(dualize(new Icosidodecahedron().faces()), 1);

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
