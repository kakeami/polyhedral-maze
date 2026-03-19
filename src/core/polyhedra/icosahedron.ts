import type { Face, Vec3 } from '../types.ts';
import type { FaceGrid } from '../face-grid.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../polyhedron.ts';
import { Graph } from '../graph.ts';
import { TriGrid } from './octahedron.ts';
import { sub, cross, normalize, dot, mean, scale } from '../vec3.ts';

function makeIcosahedronFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;

  const V: Vec3[] = [
    [0, 1, phi],     // 0
    [0, -1, phi],    // 1
    [0, 1, -phi],    // 2
    [0, -1, -phi],   // 3
    [1, phi, 0],     // 4
    [-1, phi, 0],    // 5
    [1, -phi, 0],    // 6
    [-1, -phi, 0],   // 7
    [phi, 0, 1],     // 8
    [-phi, 0, 1],    // 9
    [phi, 0, -1],    // 10
    [-phi, 0, -1],   // 11
  ];

  const faceIndices: [number, number, number][] = [
    // Top cap (around v0)
    [0, 1, 8], [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1],
    // Bottom cap (around v3)
    [3, 6, 10], [3, 10, 2], [3, 2, 11], [3, 11, 7], [3, 7, 6],
    // Equatorial band
    [1, 6, 8], [8, 6, 10], [8, 10, 4], [4, 10, 2], [4, 2, 5],
    [5, 2, 11], [5, 11, 9], [9, 11, 7], [9, 7, 1], [1, 7, 6],
  ];

  return faceIndices.map(([a, b, c], id) => {
    const v0 = V[a]!, v1 = V[b]!, v2 = V[c]!;
    const u = sub(v1, v0);
    const w = sub(v2, v0);
    let faceNormal = normalize(cross(u, w));
    const center = mean([v0, v1, v2]);

    // Ensure normal points outward (away from origin)
    if (dot(faceNormal, center) < 0) {
      return { id, vertices: [v0, v2, v1], normal: scale(faceNormal, -1) };
    }
    return { id, vertices: [v0, v1, v2], normal: faceNormal };
  });
}

export class Icosahedron implements Polyhedron {
  private _faces = makeIcosahedronFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new TriGrid(face, n);
  }
}
