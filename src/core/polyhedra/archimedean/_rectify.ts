import type { Face, Vec3 } from '../../types.ts';
import { makeFace, orientCCW, chainNeighbors } from './_utils.ts';

/**
 * Apply rectification to a polyhedron.
 *
 * Each edge midpoint becomes a new vertex. Each original face becomes a
 * smaller face whose vertices are the midpoints of its edges. Each original
 * vertex becomes a new face whose vertices are the midpoints of its incident
 * edges (in cyclic order around the vertex).
 *
 * Examples:
 * - rectify(cube) = cuboctahedron
 * - rectify(icosahedron) = icosidodecahedron
 */
export function rectify(V: Vec3[], F: number[][]): Face[] {
  const Fn = F.map((face) => orientCCW(V, face));

  // Edge midpoint registry: key "a:b" with a<b → vertex index.
  const midIdx = new Map<string, number>();
  const newVerts: Vec3[] = [];
  const edgeKey = (a: number, b: number): string => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return `${lo}:${hi}`;
  };

  for (const face of Fn) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      const key = edgeKey(a, b);
      if (midIdx.has(key)) continue;
      midIdx.set(key, newVerts.length);
      newVerts.push([
        (V[a]![0] + V[b]![0]) / 2,
        (V[a]![1] + V[b]![1]) / 2,
        (V[a]![2] + V[b]![2]) / 2,
      ]);
    }
  }

  const faces: Face[] = [];
  let nextId = 0;

  // For each original face: ring of edge midpoints.
  for (const face of Fn) {
    const ring: Vec3[] = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      ring.push(newVerts[midIdx.get(edgeKey(a, b))!]!);
    }
    faces.push(makeFace(nextId++, ring));
  }

  // For each original vertex: ring of midpoints of incident edges.
  for (let v = 0; v < V.length; v++) {
    const neighbors = chainNeighbors(Fn, v);
    if (neighbors.length === 0) continue;
    const ring = neighbors.map((n) => newVerts[midIdx.get(edgeKey(v, n))!]!);
    faces.push(makeFace(nextId++, ring));
  }

  return faces;
}
