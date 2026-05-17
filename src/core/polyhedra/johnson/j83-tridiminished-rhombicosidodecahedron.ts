import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Tridiminished Rhombicosidodecahedron (J83). Three mutually-meta pentagonal
 * cupola caps (0, 3, 11) are removed. 32 faces: 5 △ + 15 □ + 9 ⬠ + 3 10gon.
 */
export class TridiminishedRhombicosidodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'diminish', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 3 },
      { kind: 'diminish', pentagonIndex: 11 },
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
