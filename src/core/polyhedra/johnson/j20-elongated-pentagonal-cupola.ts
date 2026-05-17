import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Cupola (J20). J5 stacked on a decagonal prism.
 * 22 faces: 5 triangles + 15 squares + 1 pentagon + 1 decagon. 25 vertices,
 * 45 edges.
 */
export class ElongatedPentagonalCupola implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformCupola(5), 1), 1);

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
