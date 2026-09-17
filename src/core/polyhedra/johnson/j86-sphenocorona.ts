import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { convexHull } from './_convex_hull.ts';

/**
 * Sphenocorona (J86). 14 faces (12 triangles + 2 squares), 10 vertices,
 * 22 edges. C_2v symmetry.
 *
 * Vertex set generated from 4 base points (edge length 2 convention) under
 * the C_2v group with C_2 along z and mirrors in the xz / yz planes. The
 * geometry depends on the smallest positive root of
 *   60k⁴ − 48k³ − 100k² + 56k + 23 = 0   (k ≈ 0.85273)
 * solved here by Newton's method seeded near 0.85.
 *
 * Face structure recovered via convex hull.
 */
function sphenocoronaK(): number {
  const f = (k: number) =>
    ((((60 * k - 48) * k - 100) * k + 56) * k + 23);
  const fp = (k: number) =>
    (((240 * k - 144) * k - 200) * k + 56);
  let k = 0.85;
  for (let i = 0; i < 100; i++) {
    const step = f(k) / fp(k);
    k -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return k;
}

function sphenocoronaFaces(): Face[] {
  const k = sphenocoronaK();
  const s1 = Math.sqrt(1 - k * k);
  const z1 = 2 * s1;
  const Y3 = 1 + Math.sqrt(3 - 4 * k * k) / s1;
  const Z3 = (1 - 2 * k * k) / s1;
  const Z4 = -Math.sqrt(2 + 4 * k - 4 * k * k);

  const verts: Vec3[] = [];
  // Orbit of P1 = (0, 1, z1) under C_2v: (0, ±1, z1) — 2 points.
  for (const sy of [-1, 1]) verts.push([0, sy, z1]);
  // Orbit of P2 = (2k, 1, 0): (±2k, ±1, 0) — 4 points.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx * 2 * k, sy, 0]);
  // Orbit of P3 = (0, Y3, Z3): (0, ±Y3, Z3) — 2 points.
  for (const sy of [-1, 1]) verts.push([0, sy * Y3, Z3]);
  // Orbit of P4 = (1, 0, Z4): (±1, 0, Z4) — 2 points.
  for (const sx of [-1, 1]) verts.push([sx, 0, Z4]);

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class Sphenocorona extends Solid {
  protected readonly _faces = normalizeFaces(sphenocoronaFaces(), 1);
}

export { sphenocoronaFaces, sphenocoronaK };
