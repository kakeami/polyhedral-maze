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
 * Disphenocingulum (J90). 24 faces (20 triangles + 4 squares),
 * 16 vertices, 38 edges. D_2d symmetry.
 *
 * Vertices from 3 D_2d orbits with sizes 8/4/4 = 16. Geometry parameterised
 * by the second smallest positive root a ≈ 0.76713 of a degree-12 polynomial,
 * together with c = √(1 − a²) and h = √(2 + 8a − 8a²).
 *
 * Orbit generators (edge length 2):
 *   A: (1, 2a, h/2)                              — 8 pts (general position)
 *   B: (1, 0, 2c + h/2)                          — 4 pts (xz-plane stabiliser)
 *   C: (1 + √(3 − 4a²)/c, 0, 2c − 1/c + h/2)     — 4 pts (xz-plane stabiliser)
 *
 * D_2d here uses S_4 axis along z and σ_d coordinate planes (xz, yz).
 */
const POLY_J90 = [
  256, -512, -1664, 3712, 1552, -6592, 1248,
  4352, -2024, -944, 672, -24, -23,
];

function disphenocingulumA(): number {
  return newtonPolyRoot(POLY_J90, 0.76713);
}

function disphenocingulumFaces(): Face[] {
  const a = disphenocingulumA();
  const c = Math.sqrt(1 - a * a);
  const h = Math.sqrt(2 + 8 * a - 8 * a * a);
  const r34 = Math.sqrt(3 - 4 * a * a);

  const hHalf = h / 2;
  const h2 = 2 * c + hHalf;
  const h3 = 2 * c - 1 / c + hHalf;
  const r3 = 1 + r34 / c;

  const verts: Vec3[] = [];
  // Orbit A — z = +h/2: (±1, ±2a, h/2); z = -h/2: (±2a, ±1, -h/2).
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx, sy * 2 * a, hHalf]);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx * 2 * a, sy, -hHalf]);
  // Orbit B — (±1, 0, h2) ∪ (0, ±1, -h2).
  for (const s of [-1, 1]) {
    verts.push([s, 0, h2]);
    verts.push([0, s, -h2]);
  }
  // Orbit C — (±r3, 0, h3) ∪ (0, ±r3, -h3).
  for (const s of [-1, 1]) {
    verts.push([s * r3, 0, h3]);
    verts.push([0, s * r3, -h3]);
  }

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class Disphenocingulum implements Polyhedron {
  private _faces = normalizeFaces(disphenocingulumFaces(), 1);

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
