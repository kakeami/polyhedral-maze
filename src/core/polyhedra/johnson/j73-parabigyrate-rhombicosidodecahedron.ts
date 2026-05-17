import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Parabigyrate Rhombicosidodecahedron (J73). Two antipodal pentagonal cupola
 * caps are gyrated. 62 faces: 20 △ + 30 □ + 12 ⬠.
 *
 * Pentagons 0 and 5 of the underlying dodecahedron are antipodal (face
 * BFS distance 3 in the dodecahedron face graph).
 */
export class ParabigyrateRhombicosidodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'gyrate', pentagonIndex: 5 },
    ]),
    1,
  );

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
