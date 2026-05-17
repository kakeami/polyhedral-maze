import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyrate Bidiminished Rhombicosidodecahedron (J82). One pentagonal cap (0)
 * is gyrated; two mutually-meta caps (3, 11) are diminished.
 * 42 faces: 10 △ + 20 □ + 10 ⬠ + 2 10gon.
 */
export class GyrateBidiminishedRhombicosidodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
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
