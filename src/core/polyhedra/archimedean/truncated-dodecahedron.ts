import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { DecGrid } from '../grids/dec-grid.ts';
import { truncate } from './_truncation.ts';

/**
 * Truncated Dodecahedron: 20 triangular + 12 decagonal = 32 faces.
 * Obtained by truncating each vertex of a regular dodecahedron at
 * depth t = 1 / (φ + 2), which yields regular decagons.
 *
 * Derivation: for a pentagon with vertex angle 108°, a uniform truncation at
 * depth t turns the pentagon into a decagon with short edges of length
 * t·L·2sin(54°) = t·L·φ (corner cuts) and long edges of (1−2t)·L (along
 * original edges). Setting these equal gives t·φ = 1 − 2t, i.e. t = 1/(φ+2).
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

  const t = 1 / (phi + 2);
  return truncate(V, F, t);
}

export class TruncatedDodecahedron implements Polyhedron {
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
      : new DecGrid(face, n);
  }
}
