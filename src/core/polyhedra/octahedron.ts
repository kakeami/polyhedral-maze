import type { Face, Vec3 } from '../types.ts';
import type { FaceGrid } from '../face-grid.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../polyhedron.ts';
import type { FaceEdgeData } from '../types.ts';
import { Graph } from '../graph.ts';
import { TriGrid } from './tri-grid.ts';

export { TriGrid } from './tri-grid.ts';

function makeOctahedronFaces(): Face[] {
  const px: Vec3 = [1, 0, 0];
  const mx: Vec3 = [-1, 0, 0];
  const py: Vec3 = [0, 1, 0];
  const my: Vec3 = [0, -1, 0];
  const pz: Vec3 = [0, 0, 1];
  const mz: Vec3 = [0, 0, -1];

  const s = 1 / Math.sqrt(3);

  return [
    { id: 0, vertices: [px, py, pz], normal: [s, s, s] },
    { id: 1, vertices: [px, pz, my], normal: [s, -s, s] },
    { id: 2, vertices: [px, my, mz], normal: [s, -s, -s] },
    { id: 3, vertices: [px, mz, py], normal: [s, s, -s] },
    { id: 4, vertices: [mx, pz, py], normal: [-s, s, s] },
    { id: 5, vertices: [mx, my, pz], normal: [-s, -s, s] },
    { id: 6, vertices: [mx, mz, my], normal: [-s, -s, -s] },
    { id: 7, vertices: [mx, py, mz], normal: [-s, s, -s] },
  ];
}

export class Octahedron implements Polyhedron {
  private _faces = makeOctahedronFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new TriGrid(face, n);
  }
}
