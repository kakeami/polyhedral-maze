import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Bigyrate Diminished Rhombicosidodecahedron (J79). Two pentagonal caps are
 * gyrated (0, 3) and a third mutually-meta pentagon (11) is diminished.
 * 52 faces: 15 △ + 25 □ + 11 ⬠ + 1 10gon.
 */
export class BigyrateDiminishedRhombicosidodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'gyrate', pentagonIndex: 3 },
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
