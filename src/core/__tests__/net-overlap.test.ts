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

describe('net pieces', () => {
  it('convex solids unfold as a single piece', () => {
    for (const id of ['cube', 'icosahedron', 'j37']) {
      const layout = computeNetLayout(getShape(id)!.factory());
      expect(layout.pieces.length, id).toBe(1);
    }
  });

  it.each(['square-torus', 'hexagonal-torus', 'drilled-truncated-octahedron'])(
    '%s unfolds as two pieces (outer shell + tunnel liner)',
    (id) => {
      const shape = getShape(id)!;
      const layout = computeNetLayout(shape.factory());
      expect(layout.pieces.length).toBe(2);
      // Every face belongs to exactly one piece
      const all = layout.pieces.flat().sort((a, b) => a - b);
      expect(all).toEqual(Array.from({ length: shape.faceCount }, (_, i) => i));
      // Fold edges never span pieces
      const pieceOf = new Map<number, number>();
      layout.pieces.forEach((ids, p) => ids.forEach((f) => pieceOf.set(f, p)));
      for (const fp of layout.foldPairs) {
        const [a, b] = fp.split(':').map(Number);
        expect(pieceOf.get(a!)).toBe(pieceOf.get(b!));
      }
    },
  );
});
