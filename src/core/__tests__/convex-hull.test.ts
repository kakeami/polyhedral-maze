import { describe, it, expect } from 'vitest';
import { convexHull } from '../polyhedra/johnson/_convex_hull.ts';
import { Cube } from '../polyhedra/platonic/cube.ts';
import { Tetrahedron } from '../polyhedra/platonic/tetrahedron.ts';
import { Octahedron } from '../polyhedra/platonic/octahedron.ts';
import { Icosahedron } from '../polyhedra/platonic/icosahedron.ts';
import { Dodecahedron } from '../polyhedra/platonic/dodecahedron.ts';
import { Rhombicosidodecahedron } from '../polyhedra/archimedean/rhombicosidodecahedron.ts';
import { SnubCube } from '../polyhedra/archimedean/snub-cube.ts';
import { TruncatedIcosahedron } from '../polyhedra/archimedean/truncated-icosahedron.ts';
import type { Face, Vec3 } from '../types.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { dot, sub, norm } from '../vec3.ts';

function uniqueVertices(faces: Face[], tol = 1e-8): Vec3[] {
  const out: Vec3[] = [];
  for (const f of faces) {
    for (const v of f.vertices) {
      const seen = out.some(
        (u) =>
          Math.abs(u[0] - v[0]) < tol &&
          Math.abs(u[1] - v[1]) < tol &&
          Math.abs(u[2] - v[2]) < tol,
      );
      if (!seen) out.push(v);
    }
  }
  return out;
}

function composition(faces: { vertices: Vec3[] }[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const f of faces) {
    const k = f.vertices.length;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

interface HullCase {
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  composition: Record<number, number>;
}

const cases: HullCase[] = [
  { name: 'Tetrahedron',           make: () => new Tetrahedron(),           faceCount: 4,  composition: { 3: 4 } },
  { name: 'Cube',                  make: () => new Cube(),                  faceCount: 6,  composition: { 4: 6 } },
  { name: 'Octahedron',            make: () => new Octahedron(),            faceCount: 8,  composition: { 3: 8 } },
  { name: 'Icosahedron',           make: () => new Icosahedron(),           faceCount: 20, composition: { 3: 20 } },
  { name: 'Dodecahedron',          make: () => new Dodecahedron(),          faceCount: 12, composition: { 5: 12 } },
  { name: 'Snub Cube',             make: () => new SnubCube(),              faceCount: 38, composition: { 3: 32, 4: 6 } },
  { name: 'Truncated Icosahedron', make: () => new TruncatedIcosahedron(),  faceCount: 32, composition: { 5: 12, 6: 20 } },
  { name: 'Rhombicosidodecahedron',make: () => new Rhombicosidodecahedron(),faceCount: 62, composition: { 3: 20, 4: 30, 5: 12 } },
];

describe.each(cases)('convexHull: $name', ({ make, faceCount, composition: expected }) => {
  const poly = make();
  const verts = uniqueVertices(poly.faces());
  const hullFaces = convexHull(verts);

  it(`recovers ${faceCount} faces`, () => {
    expect(hullFaces.length).toBe(faceCount);
  });

  it('face composition matches', () => {
    expect(composition(hullFaces)).toEqual(expected);
  });

  it('each face is planar', () => {
    for (const f of hullFaces) {
      const v0 = f.vertices[0]!;
      for (const v of f.vertices) {
        const dist = Math.abs(dot(f.normal, sub(v, v0)));
        expect(dist).toBeLessThan(1e-9);
      }
    }
  });

  it('each face has CCW order around outward normal', () => {
    // Outward = away from origin (polyhedra are centered).
    for (const f of hullFaces) {
      const v0 = f.vertices[0]!;
      // f.normal should point away from origin.
      expect(dot(f.normal, v0)).toBeGreaterThan(0);
      // Cross of consecutive edges around the polygon should align with normal.
      for (let i = 0; i < f.vertices.length; i++) {
        const a = f.vertices[i]!;
        const b = f.vertices[(i + 1) % f.vertices.length]!;
        const c = f.vertices[(i + 2) % f.vertices.length]!;
        const e1 = sub(b, a);
        const e2 = sub(c, b);
        const x = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ] as Vec3;
        expect(dot(x, f.normal)).toBeGreaterThan(0);
      }
    }
  });

  it('edges are uniform length within each face', () => {
    for (const f of hullFaces) {
      const k = f.vertices.length;
      const lens = [];
      for (let i = 0; i < k; i++) {
        lens.push(norm(sub(f.vertices[(i + 1) % k]!, f.vertices[i]!)));
      }
      const min = Math.min(...lens);
      const max = Math.max(...lens);
      expect(max - min).toBeLessThan(1e-9);
    }
  });
});
