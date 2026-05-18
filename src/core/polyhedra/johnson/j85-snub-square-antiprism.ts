import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { convexHull } from './_convex_hull.ts';

/**
 * Snub Square Antiprism (J85). 26 faces (24 triangles + 2 squares),
 * 16 vertices, 40 edges. D_4d symmetry.
 *
 * Two D_4d orbits of size 8 each (edge length 2 convention):
 *   Orbit A: seed (1, 1, h)            — top + bottom square corners.
 *   Orbit B: seed (1 + √3 k, 0, h − √(3 − 3k²))  — middle rings.
 *
 * Geometry depends on the positive root of
 *   9k³ + 3√3(5 − √2)k² − 3(5 − 2√2)k + 7√6 − 17√3 = 0   (k ≈ 0.82354)
 * and corresponding height
 *   h = (√2 + 8 + 2√3 k − 3(2 + √2)k²) / (4 √(3 − 3k²))   (h ≈ 1.35374)
 * Solve via Newton's method seeded near 0.823.
 */
function snubK(): number {
  const sqrt2 = Math.sqrt(2);
  const sqrt3 = Math.sqrt(3);
  const sqrt6 = Math.sqrt(6);
  const A = 9;
  const B = 3 * sqrt3 * (5 - sqrt2);
  const C = -3 * (5 - 2 * sqrt2);
  const D = 7 * sqrt6 - 17 * sqrt3;
  const f = (k: number) => ((A * k + B) * k + C) * k + D;
  const fp = (k: number) => (3 * A * k + 2 * B) * k + C;
  let k = 0.823;
  for (let i = 0; i < 100; i++) {
    const step = f(k) / fp(k);
    k -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return k;
}

function snubSquareAntiprismFaces(): Face[] {
  const sqrt2 = Math.sqrt(2);
  const sqrt3 = Math.sqrt(3);
  const k = snubK();
  const dz = Math.sqrt(3 - 3 * k * k);
  const h = (sqrt2 + 8 + 2 * sqrt3 * k - 3 * (2 + sqrt2) * k * k) / (4 * dz);
  const z2 = h - dz;
  const r = 1 + sqrt3 * k;

  const verts: Vec3[] = [];
  // Orbit A — top square at z = +h, corners (±1, ±1, h); radius √2.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx, sy, h]);
  // Orbit A — bottom square at z = -h, axis-aligned (±√2, 0, -h) / (0, ±√2, -h).
  for (const s of [-1, 1]) {
    verts.push([s * sqrt2, 0, -h]);
    verts.push([0, s * sqrt2, -h]);
  }
  // Orbit B — middle ring at z = +z2, axis-aligned (±r, 0, z2) / (0, ±r, z2).
  for (const s of [-1, 1]) {
    verts.push([s * r, 0, z2]);
    verts.push([0, s * r, z2]);
  }
  // Orbit B — middle ring at z = -z2, diagonal (±r/√2, ±r/√2, -z2).
  const rd = r / sqrt2;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx * rd, sy * rd, -z2]);

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class SnubSquareAntiprism implements Polyhedron {
  private _faces = normalizeFaces(snubSquareAntiprismFaces(), 1);

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
