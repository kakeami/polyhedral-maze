import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { makeFace } from '../archimedean/_utils.ts';

function makePentagonalBipyramidFaces(): Face[] {
  // Equator: regular pentagon of radius a (edge = 2a·sin(π/5)).
  // Apex edge = √(a² + h²). Equal edges: h² = a²·(4·sin²(π/5) − 1).
  const a = 1;
  const sinPi5 = Math.sin(Math.PI / 5);
  const h = a * Math.sqrt(4 * sinPi5 * sinPi5 - 1);

  const eq: Vec3[] = [];
  for (let i = 0; i < 5; i++) {
    const t = (2 * Math.PI * i) / 5;
    eq.push([a * Math.cos(t), a * Math.sin(t), 0]);
  }
  const top: Vec3 = [0, 0, h];
  const bot: Vec3 = [0, 0, -h];

  const faces: Face[] = [];
  let id = 0;
  for (let i = 0; i < 5; i++) {
    const a0 = eq[i]!;
    const a1 = eq[(i + 1) % 5]!;
    faces.push(makeFace(id++, [top, a0, a1]));
    faces.push(makeFace(id++, [bot, a0, a1]));
  }
  return faces;
}

/**
 * Pentagonal Bipyramid (J13, deltahedron #4).
 * 10 equilateral-triangle faces, 7 vertices, 15 edges.
 * D_5h symmetry, no central inversion → no antipodal faces.
 */
export class PentagonalBipyramid implements Polyhedron {
  private _faces = normalizeFaces(makePentagonalBipyramidFaces(), 1);

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
