import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';

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

export class Cube extends Solid {
  protected readonly _faces = normalizeFaces(makeCubeFaces(), 1);
}
