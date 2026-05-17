import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { makeFace } from '../archimedean/_utils.ts';

function makeTriangularBipyramidFaces(): Face[] {
  // Equator radius a; apex height h. Equal edges require h = a·√2
  // (equator edge = a√3, apex-equator edge = √(a²+h²)).
  const a = 1;
  const h = Math.SQRT2;

  const eq: Vec3[] = [
    [a, 0, 0],
    [-a / 2, (a * Math.sqrt(3)) / 2, 0],
    [-a / 2, -(a * Math.sqrt(3)) / 2, 0],
  ];
  const top: Vec3 = [0, 0, h];
  const bot: Vec3 = [0, 0, -h];

  const faces: Face[] = [];
  let id = 0;
  for (let i = 0; i < 3; i++) {
    const a0 = eq[i]!;
    const a1 = eq[(i + 1) % 3]!;
    faces.push(makeFace(id++, [top, a0, a1]));
    faces.push(makeFace(id++, [bot, a0, a1]));
  }
  return faces;
}

/**
 * Triangular Bipyramid (J12, deltahedron #2).
 * 6 equilateral-triangle faces, 5 vertices, 9 edges.
 * D_3h symmetry, no central inversion → no antipodal faces (warp disabled).
 */
export class TriangularBipyramid implements Polyhedron {
  private _faces = normalizeFaces(makeTriangularBipyramidFaces(), 1);

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
