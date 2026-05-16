import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { HexGrid } from '../grids/hex-grid.ts';
import { truncate } from './_truncation.ts';

/**
 * Truncated Octahedron: 6 square faces + 8 hexagonal faces = 14 faces.
 * Obtained by truncating each vertex of a regular octahedron at t = 1/3.
 */
function makeFaces(): Face[] {
  const V: Vec3[] = [
    [1, 0, 0],   // 0: +x
    [-1, 0, 0],  // 1: -x
    [0, 1, 0],   // 2: +y
    [0, -1, 0],  // 3: -y
    [0, 0, 1],   // 4: +z
    [0, 0, -1],  // 5: -z
  ];
  // 8 triangular faces of the octahedron (each cyclic from outside).
  const F: number[][] = [
    [0, 2, 4],
    [0, 4, 3],
    [0, 3, 5],
    [0, 5, 2],
    [1, 4, 2],
    [1, 3, 4],
    [1, 5, 3],
    [1, 2, 5],
  ];
  return truncate(V, F, 1 / 3);
}

export class TruncatedOctahedron implements Polyhedron {
  private _faces = makeFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return face.vertices.length === 4
      ? new RectGrid(face, n)
      : new HexGrid(face, n);
  }
}
