import type { Face, Vec3 } from '../../types.ts';
import { sub, cross, normalize, dot, mean, scale } from '../../vec3.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import type { FaceEdgeData } from '../../types.ts';
import { Graph } from '../../graph.ts';
import { PentGrid } from '../grids/pent-grid.ts';

function makeDodecahedronFaces(): Face[] {
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

  const faceIndices: number[][] = [
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

  return faceIndices.map((indices, id) => {
    const verts = indices.map((i) => V[i]!);
    const u = sub(verts[1]!, verts[0]!);
    const w = sub(verts[2]!, verts[0]!);
    let faceNormal = normalize(cross(u, w));
    const center = mean(verts);

    if (dot(faceNormal, center) < 0) {
      verts.reverse();
      faceNormal = scale(faceNormal, -1);
    }

    return { id, vertices: verts, normal: faceNormal };
  });
}

export class Dodecahedron implements Polyhedron {
  private _faces = normalizeFaces(makeDodecahedronFaces(), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new PentGrid(face, n);
  }
}
