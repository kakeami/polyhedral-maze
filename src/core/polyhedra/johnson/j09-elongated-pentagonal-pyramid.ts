import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPyramid } from './_pyramid.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Pyramid (J9). Pentagonal pyramid (J2) stacked on a
 * pentagonal prism. 11 faces: 5 triangles + 5 squares + 1 pentagon
 * (prism bottom). 11 vertices, 20 edges.
 */
export class ElongatedPentagonalPyramid implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformPyramid(5), 0), 1);

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
