import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { sub, cross, normalize, dot, mean } from '../../vec3.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { orientFacesOutward } from './_orient.ts';

/**
 * Drilled Truncated Octahedron: a truncated octahedron with a square prism
 * tunnel bored between its two z-axis squares (in the spirit of Stewart
 * toroids). The square faces sit centered on the axis, so the four tunnel
 * walls (√2 × 4 rectangles in the planes ±x ± y = 1) run strictly through
 * the interior — no face degeneracy.
 *
 * 8 hexagons + 4 side squares + 4 tunnel rectangles = 16 faces, genus 1
 * (V=24, E=40, F=16, χ=0).
 */
function drilledTruncatedOctahedronFaces(): Face[] {
  // All permutations of (0, ±1, ±2) — the 24 truncated-octahedron vertices.
  const verts: Vec3[] = [];
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const p of perms) {
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        const v: Vec3 = [0, 0, 0];
        v[p.indexOf(0)] = 0;
        v[p.indexOf(1)] = s1;
        v[p.indexOf(2)] = 2 * s2;
        if (!verts.some((w) => w[0] === v[0] && w[1] === v[1] && w[2] === v[2])) {
          verts.push(v);
        }
      }
    }
  }

  const loops: Vec3[][] = [];

  // 8 hexagons: sx·x + sy·y + sz·z = 3.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        loops.push(cyclicOrder(
          verts.filter((v) => sx * v[0] + sy * v[1] + sz * v[2] === 3),
        ));
      }
    }
  }

  // 4 side squares: x = ±2 and y = ±2 (the z = ±2 squares are drilled out).
  for (const [axis, s] of [[0, -1], [0, 1], [1, -1], [1, 1]] as const) {
    loops.push(cyclicOrder(verts.filter((v) => v[axis] === 2 * s)));
  }

  // 4 tunnel walls: sx·x + sy·y = 1 restricted to the two square rims.
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    loops.push(cyclicOrder(
      verts.filter((v) => sx * v[0] + sy * v[1] === 1 && Math.abs(v[2]) === 2),
    ));
  }

  return orientFacesOutward(loops);
}

/**
 * Order coplanar points of a convex polygon cyclically (either direction —
 * `orientFacesOutward` resolves the winding).
 */
function cyclicOrder(pts: Vec3[]): Vec3[] {
  const c = mean(pts);
  const e1 = normalize(sub(pts[0]!, c));
  let n: Vec3 = [0, 0, 0];
  for (let i = 1; i < pts.length && norm2(n) < 1e-12; i++) {
    n = cross(e1, sub(pts[i]!, c));
  }
  const e2 = cross(normalize(n), e1);
  return [...pts].sort((a, b) => angleAt(a) - angleAt(b));

  function angleAt(p: Vec3): number {
    const d = sub(p, c);
    return Math.atan2(dot(d, e2), dot(d, e1));
  }
}

function norm2(v: Vec3): number {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

export class DrilledTruncatedOctahedron implements Polyhedron {
  private _faces = normalizeFaces(drilledTruncatedOctahedronFaces(), 1);

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

export { drilledTruncatedOctahedronFaces };
