import type { Face, Vec3 } from '../../types.ts';
import { makeFace, orientCCW, chainNeighbors } from './_utils.ts';

/**
 * Apply uniform truncation to a Platonic-like polyhedron.
 *
 * Given the original vertices and face vertex indices (each face listed in
 * cyclic order around the face), produces the truncated polyhedron's faces.
 *
 * - For each original edge {i, j}, two new vertices are created at
 *   (1-t)·V_i + t·V_j and (1-t)·V_j + t·V_i.
 * - For each original face, a 2k-gon is produced by walking along its edges.
 * - For each original vertex, a small face (degree-d polygon) is produced by
 *   chaining its neighbors around the vertex (using the face cycle structure).
 *
 * The truncation depth t must satisfy 0 < t < 0.5. For Archimedean truncation
 * of polyhedra with triangular faces, t = 1/3 gives a regular hexagonal face.
 *
 * Vertex order of each output face is in some cyclic order around the face.
 * Normal direction is corrected by `makeFace()`.
 */
export function truncate(
  V: Vec3[],
  F: number[][],
  t: number,
): Face[] {
  const Fn = F.map((face) => orientCCW(V, face));

  const tvIdx = new Map<string, number>();
  const newVerts: Vec3[] = [];
  const addTV = (i: number, j: number) => {
    const key = `${i},${j}`;
    if (tvIdx.has(key)) return;
    tvIdx.set(key, newVerts.length);
    newVerts.push([
      (1 - t) * V[i]![0] + t * V[j]![0],
      (1 - t) * V[i]![1] + t * V[j]![1],
      (1 - t) * V[i]![2] + t * V[j]![2],
    ]);
  };

  for (const face of Fn) {
    for (let k = 0; k < face.length; k++) {
      const a = face[k]!;
      const b = face[(k + 1) % face.length]!;
      addTV(a, b);
      addTV(b, a);
    }
  }

  const faces: Face[] = [];
  let nextId = 0;

  for (const face of Fn) {
    const k = face.length;
    const ring: Vec3[] = [];
    for (let i = 0; i < k; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % k]!;
      ring.push(newVerts[tvIdx.get(`${a},${b}`)!]!);
      ring.push(newVerts[tvIdx.get(`${b},${a}`)!]!);
    }
    faces.push(makeFace(nextId++, ring));
  }

  for (let v = 0; v < V.length; v++) {
    const neighbors = chainNeighbors(Fn, v);
    if (neighbors.length === 0) continue;
    const ring = neighbors.map((n) => newVerts[tvIdx.get(`${v},${n}`)!]!);
    faces.push(makeFace(nextId++, ring));
  }

  return faces;
}
