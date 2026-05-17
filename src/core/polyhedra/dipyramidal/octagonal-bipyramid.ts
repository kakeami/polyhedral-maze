import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { uniformBipyramid } from './_uniform_bipyramid.ts';

/**
 * Octagonal Bipyramid (n=8, dual of the octagonal prism).
 * 16 isosceles-triangle faces, 10 vertices, 24 edges. D_8h has central
 * inversion → every face has an antipode.
 */
export class OctagonalBipyramid implements Polyhedron {
  private _faces = normalizeFaces(uniformBipyramid(8), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new TriGrid(face, n);
  }
}
