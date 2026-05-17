import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { PentGrid } from '../grids/pent-grid.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { snub } from './_snub.ts';

/**
 * Snub Dodecahedron (a.k.a. snub icosidodecahedron):
 * 12 pentagons + 80 triangles = 92 faces, 60 vertices, 150 edges.
 * Chiral; this implementation is the right-handed form.
 *
 * Constructed by applying the snub operation to a regular dodecahedron:
 *   - 12 pentagonal faces → 12 rotated pentagons
 *   - 30 dodec edges      → 60 edge-band triangles
 *   - 20 dodec vertices   → 20 vertex triangles
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

  return snub(V, F, 'right');
}

export class SnubDodecahedron implements Polyhedron {
  private _faces = normalizeFaces(makeFaces(), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return face.vertices.length === 5
      ? new PentGrid(face, n)
      : new TriGrid(face, n);
  }
}
