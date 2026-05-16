import type { Face, Vec3 } from '../../types.ts';
import { allClose, mean, normalize, dot, sub, cross, norm } from '../../vec3.ts';
import { VERTEX_EPSILON } from '../../constants.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * Construct the canonical dual (Catalan) of an Archimedean polyhedron via
 * polar reciprocation w.r.t. the midsphere.
 *
 * Inputs are the faces of the Archimedean solid (which must be centered at
 * the origin and possess a midsphere, i.e. all edge midpoints share the same
 * distance from the origin).
 *
 * Construction:
 *   - For each Archimedean face F with unit outward normal n_F at distance
 *     h_F from the origin, the dual vertex is p_F = (ρ²/h_F) · n_F.
 *   - For each Archimedean vertex v, the dual face is the polygon whose
 *     vertices are the p_F for every face F that touches v, lying in the
 *     plane x·v = ρ² (so its outward normal is v/|v|).
 *
 * ρ is the midsphere radius, taken as the mean distance from the origin to
 * each edge midpoint. Small per-edge variation is tolerated (averaged out)
 * so callers don't need to pre-canonicalize their Archimedean coordinates.
 */
export function dualize(archFaces: Face[]): Face[] {
  const rho = midsphereRadius(archFaces);
  const rho2 = rho * rho;

  const dualVerts: Vec3[] = archFaces.map((f) => {
    const c = mean(f.vertices);
    const h = dot(c, f.normal);
    const s = rho2 / h;
    return [s * f.normal[0], s * f.normal[1], s * f.normal[2]];
  });

  const vertices = uniqueVertices(archFaces);

  return vertices.map((v, vi) => {
    const verts: Vec3[] = [];
    archFaces.forEach((f, fi) => {
      if (f.vertices.some((fv) => allClose(fv, v, VERTEX_EPSILON))) {
        verts.push(dualVerts[fi]!);
      }
    });

    const center = mean(verts);
    const faceNormal = normalize(v);
    const e1 = normalize(sub(verts[0]!, center));
    const e2 = cross(faceNormal, e1);
    const ordered = verts
      .map((p) => {
        const d = sub(p, center);
        return { p, angle: Math.atan2(dot(d, e2), dot(d, e1)) };
      })
      .sort((a, b) => a.angle - b.angle)
      .map((x) => x.p);

    return makeFace(vi, ordered);
  });
}

function uniqueVertices(faces: Face[]): Vec3[] {
  const out: Vec3[] = [];
  for (const f of faces) {
    for (const v of f.vertices) {
      if (!out.some((u) => allClose(u, v, VERTEX_EPSILON))) {
        out.push(v);
      }
    }
  }
  return out;
}

function midsphereRadius(faces: Face[]): number {
  let sum = 0;
  let count = 0;
  for (const f of faces) {
    const k = f.vertices.length;
    for (let i = 0; i < k; i++) {
      const a = f.vertices[i]!;
      const b = f.vertices[(i + 1) % k]!;
      const mid: Vec3 = [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2,
      ];
      sum += norm(mid);
      count++;
    }
  }
  return sum / count;
}
