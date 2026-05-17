import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { diminishVertex, rawIcosahedronFaces, ICOSA_VERTEX } from './_diminish.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Metabidiminished Icosahedron (J62). Icosahedron with two non-adjacent,
 * non-antipodal vertices removed (replaced by two pentagonal cavities). The
 * para-bidiminished icosahedron is the pentagonal antiprism (not Johnson);
 * the meta variant is this Johnson solid. 12 faces: 10 △ + 2 ⬠.
 *
 * v0 = [0, 1, PHI] and v2 = [0, 1, -PHI] are non-adjacent (no shared edge in
 * the icosahedron) and non-antipodal (v0's antipode is v3, not v2).
 */
function build(): Face[] {
  let f = rawIcosahedronFaces();
  f = diminishVertex(f, ICOSA_VERTEX.v0!);
  f = diminishVertex(f, ICOSA_VERTEX.v2!);
  return f;
}

export class MetabidiminishedIcosahedron implements Polyhedron {
  private _faces = normalizeFaces(build(), 1);

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
