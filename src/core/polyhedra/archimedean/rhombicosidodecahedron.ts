import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { PentGrid } from '../grids/pent-grid.ts';
import { cantellate } from './_cantellate.ts';

/**
 * Rhombicosidodecahedron: cantellated dodecahedron.
 * 20 triangular + 30 square + 12 pentagonal = 62 faces.
 *
 * Built from canonical dodecahedron vertices. The cantellation depth
 * d = √((5 − √5)/2) makes every new edge equal to the dodecahedron edge length.
 */
function makeFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const ip = 1 / phi;

  const V: Vec3[] = [
    [1, 1, 1],      // 0
    [1, 1, -1],     // 1
    [1, -1, 1],     // 2
    [1, -1, -1],    // 3
    [-1, 1, 1],     // 4
    [-1, 1, -1],    // 5
    [-1, -1, 1],    // 6
    [-1, -1, -1],   // 7
    [0, ip, phi],   // 8
    [0, -ip, phi],  // 9
    [0, ip, -phi],  // 10
    [0, -ip, -phi], // 11
    [ip, phi, 0],   // 12
    [-ip, phi, 0],  // 13
    [ip, -phi, 0],  // 14
    [-ip, -phi, 0], // 15
    [phi, 0, ip],   // 16
    [-phi, 0, ip],  // 17
    [phi, 0, -ip],  // 18
    [-phi, 0, -ip], // 19
  ];

  // 12 dodecahedron faces (vertices in cyclic order; orientCCW inside cantellate
  // will normalize as needed).
  const F: number[][] = [
    [0, 8, 4, 13, 12],
    [0, 12, 1, 18, 16],
    [0, 16, 2, 9, 8],
    [16, 18, 3, 14, 2],
    [9, 2, 14, 15, 6],
    [14, 3, 11, 7, 15],
    [18, 1, 10, 11, 3],
    [8, 9, 6, 17, 4],
    [4, 17, 19, 5, 13],
    [13, 5, 10, 1, 12],
    [10, 5, 19, 7, 11],
    [17, 6, 15, 7, 19],
  ];

  // d = √((5 − √5) / 2) ≈ 1.1756
  const d = Math.sqrt((5 - Math.sqrt(5)) / 2);
  return cantellate(V, F, d);
}

export class Rhombicosidodecahedron implements Polyhedron {
  private _faces = makeFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    if (face.vertices.length === 3) return new TriGrid(face, n);
    if (face.vertices.length === 4) return new RectGrid(face, n);
    return new PentGrid(face, n);
  }
}
