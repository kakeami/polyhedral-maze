/**
 * Every shape's unfolded net must be printable: no two faces may overlap.
 * Faces touching along fold edges or at vertices are fine.
 */
import { describe, it, expect } from 'vitest';
import { SHAPES } from '../polyhedra/registry.ts';
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
