import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { diminishVertex, rawIcosahedronFaces, ICOSA_VERTEX } from './_diminish.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Tridiminished Icosahedron (J63). Icosahedron with three mutually
 * non-adjacent, non-antipodal vertices removed. 8 faces: 5 △ + 3 ⬠.
 *
 * v0, v2, v7 are pairwise equidistant on the icosahedron and form the
 * canonical mutually-meta triple used for J63 / J64.
 */
export function tridiminishedFaces(): Face[] {
  let f = rawIcosahedronFaces();
  f = diminishVertex(f, ICOSA_VERTEX.v0!);
  f = diminishVertex(f, ICOSA_VERTEX.v2!);
  f = diminishVertex(f, ICOSA_VERTEX.v7!);
  return f;
}

export class TridiminishedIcosahedron implements Polyhedron {
  private _faces = normalizeFaces(tridiminishedFaces(), 1);

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
