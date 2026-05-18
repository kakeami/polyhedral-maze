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
 * Sphenomegacorona (J88). 18 faces (16 triangles + 2 squares),
 * 12 vertices, 28 edges. C_2v symmetry.
 *
 * Vertex set: 5 base points under C_2v (reflections about xz and yz planes),
 * yielding orbits of sizes 2/4/2/2/2 = 12. Geometry parameterised by the
 * smallest positive root k ≈ 0.59463 of a degree-16 polynomial.
 */
const POLY_J88 = [
  1680, -4800, -3712, 17216, 1568, -24576, 2464, 17248,
  -3384, -5584, 2000, 240, -776, 304, 200, -56, -23,
];

function sphenomegacoronaK(): number {
  return newtonPolyRoot(POLY_J88, 0.59463);
}

function sphenomegacoronaFaces(): Face[] {
  const k = sphenomegacoronaK();
  const s1 = Math.sqrt(1 - k * k);
  const s1Cubed = s1 * s1 * s1;
  const r34 = Math.sqrt(3 - 4 * k * k);
  const z1 = 2 * s1;
  const Y3 = r34 / s1 + 1;
  const Z3 = (1 - 2 * k * k) / s1;
  const Z4 = -Math.sqrt(2 + 4 * k - 4 * k * k);
  const Y5 = r34 * (1 - 2 * k * k) / s1Cubed + 1;
  const Z5 = (2 * k * k * k * k - 1) / s1Cubed;

  const verts: Vec3[] = [];
  // P1 = (0, 1, z1): orbit (0, ±1, z1) → 2.
  for (const sy of [-1, 1]) verts.push([0, sy, z1]);
  // P2 = (2k, 1, 0): orbit (±2k, ±1, 0) → 4.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx * 2 * k, sy, 0]);
  // P3 = (0, Y3, Z3): orbit (0, ±Y3, Z3) → 2.
  for (const sy of [-1, 1]) verts.push([0, sy * Y3, Z3]);
  // P4 = (1, 0, Z4): orbit (±1, 0, Z4) → 2.
  for (const sx of [-1, 1]) verts.push([sx, 0, Z4]);
  // P5 = (0, Y5, Z5): orbit (0, ±Y5, Z5) → 2.
  for (const sy of [-1, 1]) verts.push([0, sy * Y5, Z5]);

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class Sphenomegacorona implements Polyhedron {
  private _faces = normalizeFaces(sphenomegacoronaFaces(), 1);

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
