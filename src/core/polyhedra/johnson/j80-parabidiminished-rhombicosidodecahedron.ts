import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Parabidiminished Rhombicosidodecahedron (J80). Two antipodal pentagonal
 * cupola caps (0, 5) are removed. 42 faces: 10 △ + 20 □ + 10 ⬠ + 2 10gon.
 */
export class ParabidiminishedRhombicosidodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'diminish', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 5 },
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
