import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import type { FaceEdgeData } from '../../types.ts';
import { Graph } from '../../graph.ts';
import { RectGrid } from '../grids/rect-grid.ts';

function makeCubeFaces(): Face[] {
  const h = 0.5;
  return [
    {
      id: 0,
      vertices: [
        [-h, h, h],
        [h, h, h],
        [h, h, -h],
        [-h, h, -h],
      ],
      normal: [0, 1, 0],
    },
    {
      id: 1,
      vertices: [
        [-h, -h, -h],
        [h, -h, -h],
        [h, -h, h],
        [-h, -h, h],
      ],
      normal: [0, -1, 0],
    },
    {
      id: 2,
      vertices: [
        [-h, h, h],
        [-h, -h, h],
        [h, -h, h],
        [h, h, h],
      ],
      normal: [0, 0, 1],
    },
    {
      id: 3,
      vertices: [
        [h, h, -h],
        [h, -h, -h],
        [-h, -h, -h],
        [-h, h, -h],
      ],
      normal: [0, 0, -1],
    },
    {
      id: 4,
      vertices: [
        [h, h, h],
        [h, -h, h],
        [h, -h, -h],
        [h, h, -h],
      ],
      normal: [1, 0, 0],
    },
    {
      id: 5,
      vertices: [
        [-h, h, -h],
        [-h, -h, -h],
        [-h, -h, h],
        [-h, h, h],
      ],
      normal: [-1, 0, 0],
    },
  ];
}

export class Cube implements Polyhedron {
  private _faces = makeCubeFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new RectGrid(face, n);
  }
}
