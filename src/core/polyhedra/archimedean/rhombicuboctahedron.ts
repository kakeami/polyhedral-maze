import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { cantellate } from './_cantellate.ts';

/**
 * Rhombicuboctahedron: cantellated cube.
 * 8 triangular faces + 18 square faces = 26 faces.
 *
 * Built from unit cube vertices (±1, ±1, ±1) with edge length 2.
 * Cantellation offset d = √2 yields canonical edge length 2 throughout.
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
  // 6 cube faces (vertices in cyclic order).
  const F: number[][] = [
    [0, 1, 3, 2], // +x
    [4, 6, 7, 5], // -x
    [0, 4, 5, 1], // +y
    [2, 3, 7, 6], // -y
    [0, 2, 6, 4], // +z
    [1, 5, 7, 3], // -z
  ];
  return cantellate(V, F, Math.SQRT2);
}

export class Rhombicuboctahedron implements Polyhedron {
  private _faces = normalizeFaces(makeFaces(), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return face.vertices.length === 3
      ? new TriGrid(face, n)
      : new RectGrid(face, n);
  }
}
