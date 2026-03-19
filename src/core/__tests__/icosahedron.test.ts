import { describe, it, expect } from 'vitest';
import { Icosahedron } from '../polyhedra/icosahedron.ts';
import { TriGrid } from '../polyhedra/octahedron.ts';
import { oppositeFace } from '../polyhedron.ts';

describe('Icosahedron', () => {
  const ico = new Icosahedron();

  it('has 20 faces', () => {
    expect(ico.faces().length).toBe(20);
  });

  it('face adjacency has 30 edges', () => {
    const adj = ico.faceAdjacency();
    expect(adj.edgeCount()).toBe(30);
  });

  it('each face has 3 adjacent faces', () => {
    const adj = ico.faceAdjacency();
    for (let i = 0; i < 20; i++) {
      expect(adj.degree(String(i))).toBe(3);
    }
  });

  it('all faces have an opposite (10 pairs)', () => {
    const faces = ico.faces();
    for (const f of faces) {
      expect(oppositeFace(faces, f.id)).not.toBeNull();
    }
  });

  it('uses TriGrid with correct cell counts', () => {
    const face = ico.faces()[0]!;
    for (const n of [2, 4, 6, 8]) {
      const grid = new TriGrid(face, n);
      expect(grid.cells().length).toBe(n * n);
    }
  });
});
