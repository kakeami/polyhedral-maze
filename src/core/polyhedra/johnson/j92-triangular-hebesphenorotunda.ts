import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { convexHull } from './_convex_hull.ts';

/**
 * Triangular Hebesphenorotunda (J92). 20 faces (13 triangles + 3 squares +
 * 3 pentagons + 1 hexagon), 18 vertices, 36 edges. C_3v symmetry.
 *
 * Vertices from 4 C_3v orbits with sizes 3/6/3/6 = 18 (edge length √5 − 1).
 * No polynomial root needed — closed-form in terms of the golden ratio τ.
 * Orbit generators (Wikipedia):
 *   A: (0, −2/(τ√3), 2τ/√3)          — yz-plane stabiliser (orbit 3)
 *   B: (τ, 1/(√3·τ²), 2/√3)           — general position (orbit 6)
 *   C: (τ, −τ/√3, 2/(√3·τ))          — diagonal-plane stabiliser (orbit 3)
 *   D: (2/τ, 0, 0)                    — z=0 hexagon ring (orbit 6)
 *
 * C_3v acts by C_3 rotation about z and reflection in the yz-plane.
 */
function c3vOrbit(seed: Vec3): Vec3[] {
  const sqrt3 = Math.sqrt(3);
  const c3 = (v: Vec3): Vec3 => [
    -v[0] / 2 - v[1] * sqrt3 / 2,
    v[0] * sqrt3 / 2 - v[1] / 2,
    v[2],
  ];
  const reflect = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];

  const raw: Vec3[] = [];
  let cur = seed;
  for (let i = 0; i < 3; i++) {
    raw.push(cur);
    raw.push(reflect(cur));
    cur = c3(cur);
  }
  const tol = 1e-8;
  const out: Vec3[] = [];
  for (const v of raw) {
    if (!out.some((u) => Math.abs(u[0] - v[0]) < tol && Math.abs(u[1] - v[1]) < tol && Math.abs(u[2] - v[2]) < tol)) {
      out.push(v);
    }
  }
  return out;
}

function triangularHebesphenorotundaFaces(): Face[] {
  const tau = (1 + Math.sqrt(5)) / 2;
  const sqrt3 = Math.sqrt(3);

  const seeds: Vec3[] = [
    [0, -2 / (tau * sqrt3), 2 * tau / sqrt3],
    [tau, 1 / (sqrt3 * tau * tau), 2 / sqrt3],
    [tau, -tau / sqrt3, 2 / (sqrt3 * tau)],
    [2 / tau, 0, 0],
  ];

  const verts: Vec3[] = [];
  for (const s of seeds) verts.push(...c3vOrbit(s));

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class TriangularHebesphenorotunda implements Polyhedron {
  private _faces = normalizeFaces(triangularHebesphenorotundaFaces(), 1);

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
