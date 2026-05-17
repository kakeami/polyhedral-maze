/**
 * Verifies that the PDF net layout is scale-invariant. The polyhedron
 * normalization (circumradius = 1) added for the 3D viewer must not change
 * downstream PDF output because `net-layout.ts` bbox-normalizes the unfolded
 * faces and `svg-constants.ts` expresses every visual width as a ratio of
 * `layout.width`.
 */
import { describe, it, expect } from 'vitest';
import { computeNetLayout } from '../../render/net-layout.ts';
import { Cube } from '../polyhedra/platonic/cube.ts';
import { TetrakisHexahedron } from '../polyhedra/catalan/tetrakis-hexahedron.ts';
import type { Face, Vec3 } from '../types.ts';
import type { Polyhedron } from '../polyhedron.ts';

function scalePolyhedron(p: Polyhedron, s: number): Polyhedron {
  const faces: Face[] = p.faces().map((f) => ({
    id: f.id,
    vertices: f.vertices.map((v) => [v[0] * s, v[1] * s, v[2] * s] as Vec3),
    normal: f.normal,
  }));
  return {
    faces: () => faces,
    faceAdjacency: () => p.faceAdjacency(),
    gridForFace: (face, n) => p.gridForFace(face, n),
  };
}

describe('net-layout is scale-invariant', () => {
  it.each([
    { name: 'Cube', make: () => new Cube() },
    { name: 'Tetrakis Hexahedron', make: () => new TetrakisHexahedron() },
  ])('$name: aspect ratio is preserved across input scales', ({ make }) => {
    const base = make();
    const layoutA = computeNetLayout(base);
    for (const s of [0.1, 1, 10, 100]) {
      const layoutS = computeNetLayout(scalePolyhedron(base, s));
      // bbox dimensions scale exactly with input — aspect ratio is preserved
      expect(layoutS.width / layoutS.height).toBeCloseTo(
        layoutA.width / layoutA.height, 6,
      );
      // Face vertex 2D positions, when re-normalized by layout.width, match
      for (let i = 0; i < layoutA.faces.length; i++) {
        const fa = layoutA.faces[i]!;
        const fs = layoutS.faces[i]!;
        for (let j = 0; j < fa.vertices2d.length; j++) {
          const [xa, ya] = fa.vertices2d[j]!;
          const [xs, ys] = fs.vertices2d[j]!;
          expect(xs / layoutS.width).toBeCloseTo(xa / layoutA.width, 6);
          expect(ys / layoutS.width).toBeCloseTo(ya / layoutA.width, 6);
        }
      }
    }
  });
});
