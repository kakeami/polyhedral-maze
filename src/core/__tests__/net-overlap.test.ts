/**
 * Every shape's unfolded net must be printable: no two faces may overlap.
 * Faces touching along fold edges or at vertices are fine.
 */
import { describe, it, expect } from 'vitest';
import { SHAPES, getShape } from '../polyhedra/registry.ts';
import { computeNetLayout, polygonsOverlap } from '../../render/net-layout.ts';

describe('net layout has no overlapping faces', () => {
  it.each(SHAPES.map((s) => ({ id: s.id, shape: s })))('$id', ({ shape }) => {
    const layout = computeNetLayout(shape.factory());
    const eps = Math.max(layout.width, layout.height) * 1e-6;

    const overlaps: string[] = [];
    for (let i = 0; i < layout.faces.length; i++) {
      for (let j = i + 1; j < layout.faces.length; j++) {
        const a = layout.faces[i]!;
        const b = layout.faces[j]!;
        if (polygonsOverlap(a.vertices2d, b.vertices2d, eps)) {
          overlaps.push(`${a.faceId}-${b.faceId}`);
        }
      }
    }
    expect(overlaps, `overlapping face pairs: ${overlaps.join(', ')}`).toEqual([]);
  });
});

describe('net cut/fold integrity', () => {
  it('convex solids: spanning-tree folds only, nothing flush', () => {
    for (const id of ['cube', 'icosahedron', 'j37']) {
      const shape = getShape(id)!;
      const layout = computeNetLayout(shape.factory());
      expect(layout.flushEdges.size, id).toBe(0);
      expect(layout.foldPairs.size, id).toBe(shape.faceCount - 1);
    }
  });

  it.each(['square-torus', 'hexagonal-torus', 'drilled-truncated-octahedron'])(
    '%s: every coincident edge pair is a (virtual) fold or tracked as flush',
    (id) => {
      const layout = computeNetLayout(getShape(id)!.factory());
      const tol = Math.max(layout.width, layout.height) * 1e-6;
      const close = (p: number[], q: number[]) =>
        Math.abs(p[0]! - q[0]!) <= tol && Math.abs(p[1]! - q[1]!) <= tol;

      for (let x = 0; x < layout.faces.length; x++) {
        for (let y = x + 1; y < layout.faces.length; y++) {
          const A = layout.faces[x]!;
          const B = layout.faces[y]!;
          for (let i = 0; i < A.vertices2d.length; i++) {
            const a1 = A.vertices2d[i]!;
            const a2 = A.vertices2d[(i + 1) % A.vertices2d.length]!;
            for (let j = 0; j < B.vertices2d.length; j++) {
              const b1 = B.vertices2d[j]!;
              const b2 = B.vertices2d[(j + 1) % B.vertices2d.length]!;
              const coincident =
                (close(a1, b1) && close(a2, b2)) || (close(a1, b2) && close(a2, b1));
              if (!coincident) continue;
              const pairKey = `${A.faceId}:${B.faceId}`;
              const ok =
                layout.foldPairs.has(pairKey) ||
                (layout.flushEdges.has(`${A.faceId}:${i}`) &&
                  layout.flushEdges.has(`${B.faceId}:${j}`));
              expect(ok, `edge ${A.faceId}:${i} vs ${B.faceId}:${j}`).toBe(true);
            }
          }
        }
      }
    },
  );
});
