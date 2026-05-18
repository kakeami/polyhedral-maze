import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { convexHull } from './_convex_hull.ts';
import { newtonPolyRoot } from './_poly_root.ts';

/**
 * Hebesphenomegacorona (J89). 21 faces (18 triangles + 3 squares),
 * 14 vertices, 33 edges. C_2v symmetry.
 *
 * Vertex set: 5 base points under C_2v with orbit sizes 4/4/2/2/2 = 14.
 * Geometry parameterised by the second smallest positive root
 * a ≈ 0.21684 of a degree-10 polynomial.
 */
const POLY_J89 = [
  26880, 35328, -25600, -39680, 6112, 13696,
  2128, -1808, -1119, 494, -47,
];

function hebesphenomegacoronaA(): number {
  return newtonPolyRoot(POLY_J89, 0.21684);
}

function hebesphenomegacoronaFaces(): Face[] {
  const a = hebesphenomegacoronaA();
  const s1 = Math.sqrt(1 - a * a);
  const r34 = Math.sqrt(3 - 4 * a * a);
  const sp1 = Math.sqrt(1 + a);

  const z1 = 2 * s1;
  const Y3 = 1 + Math.sqrt(2) * Math.sqrt((2 * a - 1) / (a - 1));
  const Z3 = -(2 * a * a + a - 1) / s1;
  const Z4 = -r34;

  const denom = 2 * (1 - a) * sp1;
  const numY5 = Math.sqrt(2 * (3 - 4 * a * a) * (1 - 2 * a)) + sp1;
  const Y5 = numY5 / denom;
  const Z5 =
    ((2 * a - 1) * r34) / (2 * (1 - a)) -
    Math.sqrt(2 * (1 - 2 * a)) / denom;

  const verts: Vec3[] = [];
  // P1 = (1, 1, z1): orbit (±1, ±1, z1) → 4.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx, sy, z1]);
  // P2 = (1+2a, 1, 0): orbit (±(1+2a), ±1, 0) → 4.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx * (1 + 2 * a), sy, 0]);
  // P3 = (0, Y3, Z3): orbit (0, ±Y3, Z3) → 2.
  for (const sy of [-1, 1]) verts.push([0, sy * Y3, Z3]);
  // P4 = (1, 0, Z4): orbit (±1, 0, Z4) → 2.
  for (const sx of [-1, 1]) verts.push([sx, 0, Z4]);
  // P5 = (0, Y5, Z5): orbit (0, ±Y5, Z5) → 2.
  for (const sy of [-1, 1]) verts.push([0, sy * Y5, Z5]);

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class Hebesphenomegacorona implements Polyhedron {
  private _faces = normalizeFaces(hebesphenomegacoronaFaces(), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return gridForPolygonFace(face, n);
  }
}
