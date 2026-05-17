import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { PentGrid } from '../grids/pent-grid.ts';
import { rectify } from './_rectify.ts';

/**
 * Icosidodecahedron: rectified icosahedron.
 * 20 triangular faces + 12 pentagonal faces = 32 faces.
 */
function makeFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const V: Vec3[] = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];
  const F: number[][] = [
    [0, 1, 8], [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1],
    [3, 6, 10], [3, 10, 2], [3, 2, 11], [3, 11, 7], [3, 7, 6],
    [1, 6, 8], [8, 6, 10], [8, 10, 4], [4, 10, 2], [4, 2, 5],
    [5, 2, 11], [5, 11, 9], [9, 11, 7], [9, 7, 1], [1, 7, 6],
  ];
  return rectify(V, F);
}

export class Icosidodecahedron implements Polyhedron {
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
      : new PentGrid(face, n);
  }
}
