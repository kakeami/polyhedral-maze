import type { Face, Vec3 } from '../../types.ts';
import { sub, cross, normalize, dot, mean, scale } from '../../vec3.ts';
import { VERTEX_EPSILON } from '../../constants.ts';

/**
 * Construct a Face with outward-pointing normal. If the cross-product-derived
 * normal points toward the origin, the vertex order is reversed.
 *
 * Assumes the polyhedron is centered at the origin.
 */
export function makeFace(id: number, verts: Vec3[]): Face {
  const u = sub(verts[1]!, verts[0]!);
  const w = sub(verts[2]!, verts[0]!);
  let faceNormal = normalize(cross(u, w));
  const center = mean(verts);

  if (dot(faceNormal, center) < 0) {
    verts.reverse();
    faceNormal = scale(faceNormal, -1);
  }

  return { id, vertices: verts, normal: faceNormal };
}

/**
 * Returns the face's vertex indices in CCW order around its outward normal.
 * Assumes the polyhedron is centered at the origin.
 */
export function orientCCW(V: Vec3[], face: number[]): number[] {
  const v0 = V[face[0]!]!;
  const v1 = V[face[1]!]!;
  const v2 = V[face[2]!]!;
  const u = sub(v1, v0);
  const w = sub(v2, v0);
  const n = cross(u, w);
  let cx = 0, cy = 0, cz = 0;
  for (const i of face) {
    cx += V[i]![0];
    cy += V[i]![1];
    cz += V[i]![2];
  }
  cx /= face.length;
  cy /= face.length;
  cz /= face.length;
  if (n[0] * cx + n[1] * cy + n[2] * cz < 0) {
    return [...face].reverse();
  }
  return face;
}

/**
 * Build a face from a set of vertex indices, ordering them cyclically by
 * their angle around the face's centroid in the face plane.
 *
 * Assumes the polyhedron is convex and centered at the origin (so the
 * outward normal of the face is the unit vector from origin to centroid).
 *
 * Useful when face membership is known but vertex order is not — e.g., when
 * constructing a polyhedron from canonical vertex coordinates and a face
 * classification scheme.
 */
export function buildOrderedFace(V: Vec3[], indices: number[], id: number): Face {
  const verts = indices.map((i) => V[i]!);
  const center = mean(verts);

  // Outward normal: from origin to face center (since polyhedron is centered).
  const len = Math.hypot(center[0], center[1], center[2]);
  if (len < VERTEX_EPSILON) {
    throw new Error('buildOrderedFace: face center coincides with origin');
  }
  const faceNormal: Vec3 = [center[0] / len, center[1] / len, center[2] / len];

  // 2D basis in face plane.
  const e1 = normalize(sub(verts[0]!, center));
  const e2 = cross(faceNormal, e1);

  const ordered = verts
    .map((v) => {
      const delta = sub(v, center);
      return { v, angle: Math.atan2(dot(delta, e2), dot(delta, e1)) };
    })
    .sort((a, b) => a.angle - b.angle)
    .map((x) => x.v);

  return makeFace(id, ordered);
}

/**
 * Walk neighbors of vertex v in cyclic order using a CCW-oriented face list.
 * Returns the neighbor cycle. Each face containing v contributes a (prev, next)
 * pair; chaining these gives a cycle. Order may be CW or CCW around v from
 * outside — both are valid for cyclic-order downstream consumers.
 */
export function chainNeighbors(Fccw: number[][], v: number): number[] {
  const succ = new Map<number, number>();
  for (const face of Fccw) {
    const k = face.length;
    const idx = face.indexOf(v);
    if (idx === -1) continue;
    const prev = face[(idx - 1 + k) % k]!;
    const next = face[(idx + 1) % k]!;
    succ.set(prev, next);
  }
  if (succ.size === 0) return [];
  const out: number[] = [];
  const first = succ.keys().next().value!;
  let current = first;
  do {
    out.push(current);
    current = succ.get(current)!;
  } while (current !== first);
  return out;
}
