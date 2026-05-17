import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * Solve 8p⁴ + 4p³ − 7p² − 2p + 1 = 0 for the positive root near 0.776.
 * Derived from equating four D_2d edge-orbit distances (d₁ = d₄ = d₅ = d₇) on
 * a 2-orbit vertex parameterization (p, q=1, r, s) with q·s = q·s and rs = −p,
 * which yields s² = 2p² − 1 and the quartic above.
 */
function solveP(): number {
  let p = 0.78;
  for (let i = 0; i < 50; i++) {
    const p2 = p * p;
    const p3 = p2 * p;
    const f = 8 * p2 * p2 + 4 * p3 - 7 * p2 - 2 * p + 1;
    const fp = 32 * p3 + 12 * p2 - 14 * p - 2;
    const step = f / fp;
    p -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  return p;
}

function makeSnubDisphenoidFaces(): Face[] {
  const p = solveP();          // ≈ 0.7757
  const q = 1;
  const s = Math.sqrt(2 * p * p - 1); // ≈ 0.4510
  const r = p / s;             // ≈ 1.7199; rs = p, signs placed below

  // Orbit A (4 verts, degree 4): {(±p, ±p, ∓r) under D_2d}.
  // Orbit B (4 verts, degree 5): {(±q, ±q, ±s) under D_2d}.
  const A0: Vec3 = [p, p, -r];
  const A1: Vec3 = [-p, -p, -r];
  const A2: Vec3 = [-p, p, r];
  const A3: Vec3 = [p, -p, r];
  const B0: Vec3 = [q, q, s];
  const B1: Vec3 = [-q, -q, s];
  const B2: Vec3 = [-q, q, -s];
  const B3: Vec3 = [q, -q, -s];

  const faces: Face[] = [];
  let id = 0;

  // 4 "long-bridge" faces (D_2d orbit size 4): A-A short edge + a B vertex.
  faces.push(makeFace(id++, [A0, A1, B2]));
  faces.push(makeFace(id++, [A0, A1, B3]));
  faces.push(makeFace(id++, [A2, A3, B0]));
  faces.push(makeFace(id++, [A2, A3, B1]));

  // 8 "scalene" faces (D_2d orbit size 8): B-B size-4 edge + an A vertex.
  faces.push(makeFace(id++, [B0, B2, A0]));
  faces.push(makeFace(id++, [B0, B2, A2]));
  faces.push(makeFace(id++, [B0, B3, A0]));
  faces.push(makeFace(id++, [B0, B3, A3]));
  faces.push(makeFace(id++, [B1, B2, A1]));
  faces.push(makeFace(id++, [B1, B2, A2]));
  faces.push(makeFace(id++, [B1, B3, A1]));
  faces.push(makeFace(id++, [B1, B3, A3]));
  return faces;
}

/**
 * Snub Disphenoid (J84, deltahedron #5).
 * 12 equilateral-triangle faces, 8 vertices (4 of degree 4 + 4 of degree 5),
 * 18 edges. D_2d symmetry — no central inversion → no antipodal faces.
 *
 * Coordinates derived numerically from the quartic 8p⁴ + 4p³ − 7p² − 2p + 1 = 0;
 * its positive root governs the two-orbit vertex parameterization.
 */
export class SnubDisphenoid implements Polyhedron {
  private _faces = normalizeFaces(makeSnubDisphenoidFaces(), 1);

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
