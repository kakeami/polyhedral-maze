import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { OctGrid } from '../grids/oct-grid.ts';
import { truncate } from './_truncation.ts';

/**
 * Truncated Cube: 8 triangular + 6 octagonal = 14 faces.
 * Obtained by truncating each vertex of a unit cube at depth t = (2-√2)/2,
 * which yields regular octagons.
 */
function makeFaces(): Face[] {
  const V: Vec3[] = [
    [1, 1, 1],     // 0
    [1, 1, -1],    // 1
    [1, -1, 1],    // 2
    [1, -1, -1],   // 3
    [-1, 1, 1],    // 4
    [-1, 1, -1],   // 5
    [-1, -1, 1],   // 6
    [-1, -1, -1],  // 7
  ];
  const F: number[][] = [
    [0, 1, 3, 2], // +x
    [4, 6, 7, 5], // -x
    [0, 4, 5, 1], // +y
    [2, 3, 7, 6], // -y
    [0, 2, 6, 4], // +z
    [1, 5, 7, 3], // -z
  ];
  const t = (2 - Math.sqrt(2)) / 2;
  return truncate(V, F, t);
}

export class TruncatedCube implements Polyhedron {
  private _faces = makeFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return face.vertices.length === 3
      ? new TriGrid(face, n)
      : new OctGrid(face, n);
  }
}
