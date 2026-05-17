import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Square Cupola (J4). 10 faces: 1 octagon (bottom) + 1 square (top) +
 * 4 lateral triangles + 4 lateral squares. 12 vertices, 20 edges.
 */
export class SquareCupola implements Polyhedron {
  private _faces = normalizeFaces(uniformCupola(4), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return gridForPolygonFace(face, n);
  }
}
