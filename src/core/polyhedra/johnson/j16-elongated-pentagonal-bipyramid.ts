import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedBipyramid } from './_elongated_bipyramid.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Bipyramid (J16). J13 pentagonal bipyramid split along
 * its pentagonal equator with a pentagonal prism inserted. 15 faces: 10
 * triangles + 5 squares. 12 vertices, 25 edges.
 */
export class ElongatedPentagonalBipyramid implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedBipyramid(5), 1);

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
