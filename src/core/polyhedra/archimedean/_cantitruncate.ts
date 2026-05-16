import type { Face, Vec3 } from '../../types.ts';
import { mean, norm, sub } from '../../vec3.ts';
import { makeFace, orientCCW } from './_utils.ts';

/**
 * Apply cantitruncation (a.k.a. omnitruncation) to a regular polyhedron.
 *
 * For each original (face F, vertex v in F, neighbor u of v in F), creates a
 * new vertex at:
 *
 *   p = v + α·(u − v) + β·(c_F − v)
 *
 * where c_F is the centroid of F. This produces:
 *   - one 2n-gon per original n-gon face,
 *   - one 4-gon (rectangle/square) per original edge,
 *   - one 2m-gon per original vertex of valence m.
 *
 * Examples:
 * - cantitruncate(cube)        ≡ truncated cuboctahedron (6 octagons + 8 hexagons + 12 squares)
 * - cantitruncate(icosahedron) ≡ truncated icosidodecahedron (12 decagons + 20 hexagons + 30 squares)
 *
 * α and β are derived from the input geometry (assumed Platonic, with uniform
 * face degree n, edge length L, and inter-centroid distance D) so that ALL
 * edges of the resulting polyhedron are equal:
 *
 *   α = 1 / (2[(1 + cos(π/n)) + cos(π/n)·L/D])
 *   β = 2α·cos(π/n)·L/D
 *
 * The result is geometrically similar to the canonical Archimedean shape but
 * embedded inside the original polyhedron (vertices are convex combinations of
 * original vertices and face centroids). Topology is identical.
 *
 * Faces are coplanar by construction:
 *   - 2n-gon: all vertices lie in F's plane (convex combos of points in F).
 *   - 4-gon:  parallelogram (proved via vertex pair differences).
 *   - 2m-gon: planar by the m-fold rotational symmetry at each vertex of a
 *             Platonic solid.
 */
export function cantitruncate(V: Vec3[], F: number[][]): Face[] {
  if (F.length === 0) return [];

  const Fn = F.map((face) => orientCCW(V, face));

  // Assume uniform face degree (Platonic input).
  const n = Fn[0]!.length;

  // L = edge length (take from any face).
  const L = norm(sub(V[Fn[0]![0]!]!, V[Fn[0]![1]!]!));

  // Per-face centroids.
  const centroids: Vec3[] = Fn.map((face) =>
    mean(face.map((i) => V[i]!)),
  );

  // Edge → adjacent face indices.
  const edgeKey = (a: number, b: number): string =>
    a < b ? `${a}:${b}` : `${b}:${a}`;
  const edgeToFaces = new Map<string, number[]>();
  for (let f = 0; f < Fn.length; f++) {
    const face = Fn[f]!;
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      const key = edgeKey(a, b);
      if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
      edgeToFaces.get(key)!.push(f);
    }
  }

  // D = distance between centroids of two faces sharing an edge.
  let D = 0;
  for (const faces of edgeToFaces.values()) {
    if (faces.length === 2) {
      D = norm(sub(centroids[faces[0]!]!, centroids[faces[1]!]!));
      break;
    }
  }

  const cosA = Math.cos(Math.PI / n);
  const ratio = L / D;
  const alpha = 1 / (2 * ((1 + cosA) + cosA * ratio));
  const beta = 2 * alpha * cosA * ratio;

  // New vertex per (face f, vertex v in f, direction toward neighbor u in f).
  const cornerKey = (f: number, v: number, toward: number): string =>
    `${f}:${v}:${toward}`;
  const cornerIdx = new Map<string, number>();
  const newVerts: Vec3[] = [];

  const addCorner = (f: number, v: number, toward: number): void => {
    const key = cornerKey(f, v, toward);
    if (cornerIdx.has(key)) return;
    cornerIdx.set(key, newVerts.length);
    const vp = V[v]!;
    const tp = V[toward]!;
    const cp = centroids[f]!;
    newVerts.push([
      vp[0] + alpha * (tp[0] - vp[0]) + beta * (cp[0] - vp[0]),
      vp[1] + alpha * (tp[1] - vp[1]) + beta * (cp[1] - vp[1]),
      vp[2] + alpha * (tp[2] - vp[2]) + beta * (cp[2] - vp[2]),
    ]);
  };

  for (let f = 0; f < Fn.length; f++) {
    const face = Fn[f]!;
    const k = face.length;
    for (let i = 0; i < k; i++) {
      const v = face[i]!;
      const prev = face[(i - 1 + k) % k]!;
      const next = face[(i + 1) % k]!;
      addCorner(f, v, prev);
      addCorner(f, v, next);
    }
  }

  const faces: Face[] = [];
  let nextId = 0;

  // 1. One 2n-gon per original face (CCW: alternate prev/next at each corner).
  for (let f = 0; f < Fn.length; f++) {
    const face = Fn[f]!;
    const k = face.length;
    const ring: Vec3[] = [];
    for (let i = 0; i < k; i++) {
      const v = face[i]!;
      const prev = face[(i - 1 + k) % k]!;
      const next = face[(i + 1) % k]!;
      ring.push(newVerts[cornerIdx.get(cornerKey(f, v, prev))!]!);
      ring.push(newVerts[cornerIdx.get(cornerKey(f, v, next))!]!);
    }
    faces.push(makeFace(nextId++, ring));
  }

  // 2. One 4-gon per original edge.
  for (const [key, faceList] of edgeToFaces) {
    if (faceList.length !== 2) continue;
    const [f1, f2] = faceList as [number, number];
    const [a, b] = key.split(':').map(Number) as [number, number];
    const ring: Vec3[] = [
      newVerts[cornerIdx.get(cornerKey(f1, a, b))!]!,
      newVerts[cornerIdx.get(cornerKey(f1, b, a))!]!,
      newVerts[cornerIdx.get(cornerKey(f2, b, a))!]!,
      newVerts[cornerIdx.get(cornerKey(f2, a, b))!]!,
    ];
    faces.push(makeFace(nextId++, ring));
  }

  // 3. One 2m-gon per original vertex.
  // Walk faces around v: starting at any incident face F_i, append corners
  // (toward prev, toward next), then move to the face sharing edge {v, next}.
  for (let v = 0; v < V.length; v++) {
    const incident: number[] = [];
    for (let f = 0; f < Fn.length; f++) {
      if (Fn[f]!.includes(v)) incident.push(f);
    }
    if (incident.length === 0) continue;

    const ring: Vec3[] = [];
    const visited = new Set<number>();
    let curF = incident[0]!;
    while (!visited.has(curF)) {
      visited.add(curF);
      const face = Fn[curF]!;
      const k = face.length;
      const idx = face.indexOf(v);
      const prev = face[(idx - 1 + k) % k]!;
      const next = face[(idx + 1) % k]!;
      ring.push(newVerts[cornerIdx.get(cornerKey(curF, v, prev))!]!);
      ring.push(newVerts[cornerIdx.get(cornerKey(curF, v, next))!]!);

      const sharing = edgeToFaces.get(edgeKey(v, next))!;
      curF = sharing[0] === curF ? sharing[1]! : sharing[0]!;
    }
    faces.push(makeFace(nextId++, ring));
  }

  return faces;
}
