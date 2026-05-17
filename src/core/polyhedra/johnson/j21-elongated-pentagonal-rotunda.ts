import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformRotunda } from './_rotunda.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Rotunda (J21). J6 stacked on a decagonal prism.
 * 27 faces: 10 triangles + 10 squares + 6 pentagons + 1 decagon. 30 vertices,
 * 55 edges.
 *
 * `uniformRotunda()` places the decagon at face id 1.
 */
export class ElongatedPentagonalRotunda implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformRotunda(), 1), 1);

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
