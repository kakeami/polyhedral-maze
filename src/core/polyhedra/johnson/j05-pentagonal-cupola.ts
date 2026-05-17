import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Pentagonal Cupola (J5). 12 faces: 1 decagon (bottom) + 1 pentagon (top) +
 * 5 lateral triangles + 5 lateral squares. 15 vertices, 25 edges.
 */
export class PentagonalCupola implements Polyhedron {
  private _faces = normalizeFaces(uniformCupola(5), 1);

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
