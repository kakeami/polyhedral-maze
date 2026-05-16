import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { makeFace } from './_utils.ts';

/**
 * Cuboctahedron: 8 triangular faces + 6 square faces = 14 faces.
 *
 * Vertices are the 12 permutations of (±1, ±1, 0).
 * Triangle faces are centered on the 8 cube-vertex directions;
 * square faces are centered on the 6 cube-face directions.
 *
 * Antipodal pairs: tri↔tri (opposite octants), sq↔sq (opposite axes).
 */
function makeCuboctahedronFaces(): Face[] {
  // 12 vertices: permutations of (±1, ±1, 0)
  const V: Vec3[] = [
    [1, 1, 0],   // 0
    [1, -1, 0],  // 1
    [-1, 1, 0],  // 2
    [-1, -1, 0], // 3
    [1, 0, 1],   // 4
    [1, 0, -1],  // 5
    [-1, 0, 1],  // 6
    [-1, 0, -1], // 7
    [0, 1, 1],   // 8
    [0, 1, -1],  // 9
    [0, -1, 1],  // 10
    [0, -1, -1], // 11
  ];

  // 8 triangle faces, one per cube-vertex octant
  const triIndices: [number, number, number][] = [
    [0, 4, 8],    // (+,+,+)
    [1, 10, 4],   // (+,-,+)
    [2, 8, 6],    // (-,+,+)
    [3, 6, 10],   // (-,-,+)
    [0, 9, 5],    // (+,+,-)
    [1, 5, 11],   // (+,-,-)
    [2, 7, 9],    // (-,+,-)
    [3, 11, 7],   // (-,-,-)
  ];

  // 6 square faces, one per cube-face axis direction
  const sqIndices: [number, number, number, number][] = [
    [0, 4, 1, 5],    // +x
    [2, 7, 3, 6],    // -x
    [0, 9, 2, 8],    // +y
    [1, 10, 3, 11],  // -y
    [4, 10, 6, 8],   // +z
    [5, 9, 7, 11],   // -z
  ];

  const faces: Face[] = [];

  triIndices.forEach((idx, k) => {
    const verts = idx.map((i) => V[i]!);
    faces.push(makeFace(k, verts));
  });

  sqIndices.forEach((idx, k) => {
    const verts = idx.map((i) => V[i]!);
    faces.push(makeFace(triIndices.length + k, verts));
  });

  return faces;
}

export class Cuboctahedron implements Polyhedron {
  private _faces = makeCuboctahedronFaces();

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
