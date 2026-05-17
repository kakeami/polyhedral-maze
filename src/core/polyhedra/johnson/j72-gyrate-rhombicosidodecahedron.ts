import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyrate Rhombicosidodecahedron (J72). One pentagonal cupola cap is rotated
 * by 36° (π/5). 62 faces: 20 △ + 30 □ + 12 ⬠.
 */
export class GyrateRhombicosidodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    buildRhombicosiMod([{ kind: 'gyrate', pentagonIndex: 0 }]),
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
