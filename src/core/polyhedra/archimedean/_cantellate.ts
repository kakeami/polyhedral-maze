import type { Face, Vec3 } from '../../types.ts';
import { sub, cross, normalize } from '../../vec3.ts';
import { makeFace, orientCCW } from './_utils.ts';

/**
 * Apply cantellation (expansion) to a polyhedron.
 *
 * Each original face is offset outward by distance `d` along its normal.
 * The gap between adjacent offset faces (along an original edge) is filled
 * by a new square. Each original vertex becomes a new polygon whose
 * vertices are the offset positions of that vertex relative to each of its
 * incident faces.
 *
 * For the resulting polyhedron to have all-equal edge lengths (Archimedean),
 * `d` must be chosen as L / |n_F - n_G| where L is the original edge length
 * and (F, G) is any pair of adjacent faces. Concretely:
 *
 *   d = L / √(2 - 2·cos(angle between adjacent face normals))
 *
 * Examples (uniform results):
 * - cantellate(cube, √2) = rhombicuboctahedron
 * - cantellate(dodecahedron, √((5 - √5)/2)) = rhombicosidodecahedron
 *
 * Note: `d` is multiplied by `face.normal` (which is unit length after
 * normalization), so its units are absolute distance in the same scale as
 * the input vertices.
 */
export function cantellate(V: Vec3[], F: number[][], d: number): Face[] {
  const Fn = F.map((face) => orientCCW(V, face));

  // Compute unit outward normals for each face.
  const faceNormals: Vec3[] = Fn.map((face) => {
    const v0 = V[face[0]!]!;
    const v1 = V[face[1]!]!;
    const v2 = V[face[2]!]!;
    return normalize(cross(sub(v1, v0), sub(v2, v0)));
  });

  // For each (face index, vertex index) pair, compute the offset vertex.
  // Index map: "f,v" -> index in newVerts.
  const nvIdx = new Map<string, number>();
  const newVerts: Vec3[] = [];
  for (let f = 0; f < Fn.length; f++) {
    const n = faceNormals[f]!;
    for (const v of Fn[f]!) {
      const key = `${f},${v}`;
      if (nvIdx.has(key)) continue;
      nvIdx.set(key, newVerts.length);
      newVerts.push([
        V[v]![0] + d * n[0],
        V[v]![1] + d * n[1],
        V[v]![2] + d * n[2],
      ]);
    }
  }

  const faces: Face[] = [];
  let nextId = 0;

  // 1. One offset face per original face.
  for (let f = 0; f < Fn.length; f++) {
    const ring: Vec3[] = Fn[f]!.map((v) => newVerts[nvIdx.get(`${f},${v}`)!]!);
    faces.push(makeFace(nextId++, ring));
  }

  // 2. One square per original edge (filling the gap between two offset faces).
  const edgeOccurrences = new Map<string, number[]>(); // key "lo:hi" -> faceIndices
  for (let f = 0; f < Fn.length; f++) {
    const face = Fn[f]!;
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}:${hi}`;
      if (!edgeOccurrences.has(key)) edgeOccurrences.set(key, []);
      edgeOccurrences.get(key)!.push(f);
    }
  }

  for (const [key, occs] of edgeOccurrences) {
    if (occs.length !== 2) continue; // skip non-manifold edges (shouldn't occur)
    const [f1, f2] = occs as [number, number];
    const [a, b] = key.split(':').map(Number) as [number, number];
    const ring: Vec3[] = [
      newVerts[nvIdx.get(`${f1},${a}`)!]!,
      newVerts[nvIdx.get(`${f1},${b}`)!]!,
      newVerts[nvIdx.get(`${f2},${b}`)!]!,
      newVerts[nvIdx.get(`${f2},${a}`)!]!,
    ];
    faces.push(makeFace(nextId++, ring));
  }

  // 3. One polygon per original vertex (with one corner per incident face).
  //    Cyclic order of incident faces around v is derived from the face cycle
  //    structure: face F_i has v sandwiched between two neighbors (prev, next);
  //    chaining these (prev → next) over all incident faces gives the cycle.
  for (let v = 0; v < V.length; v++) {
    const succ = new Map<number, number>();
    const faceOfPair = new Map<string, number>();
    for (let f = 0; f < Fn.length; f++) {
      const face = Fn[f]!;
      const k = face.length;
      const idx = face.indexOf(v);
      if (idx === -1) continue;
      const prev = face[(idx - 1 + k) % k]!;
      const next = face[(idx + 1) % k]!;
      succ.set(prev, next);
      faceOfPair.set(`${prev},${next}`, f);
    }
    if (succ.size === 0) continue;

    const facesAroundV: number[] = [];
    const first = succ.keys().next().value!;
    let current = first;
    do {
      const nxt = succ.get(current)!;
      facesAroundV.push(faceOfPair.get(`${current},${nxt}`)!);
      current = nxt;
    } while (current !== first);

    const ring: Vec3[] = facesAroundV.map((f) => newVerts[nvIdx.get(`${f},${v}`)!]!);
    faces.push(makeFace(nextId++, ring));
  }

  return faces;
}
