import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Triangular Cupola (J18). J3 stacked on a hexagonal prism.
 * 14 faces: 4 triangles + 9 squares + 1 hexagon. 15 vertices, 27 edges.
 *
 * `uniformCupola(3)` places the hexagon at face id 1.
 */
export class ElongatedTriangularCupola implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformCupola(3), 1), 1);

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
