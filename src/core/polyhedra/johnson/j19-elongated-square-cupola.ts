import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Square Cupola (J19). J4 stacked on an octagonal prism.
 * 18 faces: 4 triangles + 13 squares + 1 octagon. 20 vertices, 36 edges.
 */
export class ElongatedSquareCupola implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformCupola(4), 1), 1);

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
