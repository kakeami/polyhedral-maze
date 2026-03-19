import type { Face, Vec3 } from '../types.ts';
import type { FaceGrid } from '../face-grid.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../polyhedron.ts';
import { Graph } from '../graph.ts';
import { TriGrid } from './octahedron.ts';

function makeTetrahedronFaces(): Face[] {
  const v0: Vec3 = [1, 1, 1];
  const v1: Vec3 = [1, -1, -1];
  const v2: Vec3 = [-1, 1, -1];
  const v3: Vec3 = [-1, -1, 1];

  const s = 1 / Math.sqrt(3);

  return [
    { id: 0, vertices: [v0, v1, v2], normal: [s, s, -s] },
    { id: 1, vertices: [v0, v2, v3], normal: [-s, s, s] },
    { id: 2, vertices: [v0, v3, v1], normal: [s, -s, s] },
    { id: 3, vertices: [v1, v3, v2], normal: [-s, -s, -s] },
  ];
}

export class Tetrahedron implements Polyhedron {
  private _faces = makeTetrahedronFaces();

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
