import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';

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

export class Tetrahedron extends Solid {
  protected readonly _faces = normalizeFaces(makeTetrahedronFaces(), 1);
}
