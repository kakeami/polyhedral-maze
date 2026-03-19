import { describe, it, expect } from 'vitest';
import { Octahedron, TriGrid } from '../polyhedra/octahedron.ts';

describe('Octahedron', () => {
  const oct = new Octahedron();

  it('has 8 faces', () => {
    expect(oct.faces().length).toBe(8);
  });

  it('face adjacency has 12 edges', () => {
    const adj = oct.faceAdjacency();
    expect(adj.edgeCount()).toBe(12);
  });

  it('each face has 3 adjacent faces', () => {
    const adj = oct.faceAdjacency();
    for (let i = 0; i < 8; i++) {
      expect(adj.degree(String(i))).toBe(3);
    }
  });
});

describe('TriGrid', () => {
  const oct = new Octahedron();
  const face = oct.faces()[0]!;

  it('cell count = n^2', () => {
    for (const n of [2, 4, 6, 8]) {
      const grid = new TriGrid(face, n);
      expect(grid.cells().length).toBe(n * n);
    }
  });

  it('edge count = 3n(n-1)/2', () => {
    for (const n of [2, 4, 6, 8]) {
      const grid = new TriGrid(face, n);
      expect(grid.internalEdges().length).toBe((3 * n * (n - 1)) / 2);
    }
  });

  it('boundary cells have correct length n', () => {
    const n = 4;
    const grid = new TriGrid(face, n);
    const v0 = face.vertices[0]!;
    const v1 = face.vertices[1]!;
    const v2 = face.vertices[2]!;

    // v0-v1 edge (b ≈ 0)
    expect(grid.boundaryCells(v0, v1).length).toBe(n);
    // v0-v2 edge (a ≈ 0)
    expect(grid.boundaryCells(v0, v2).length).toBe(n);
    // v1-v2 edge (a+b ≈ 1)
    expect(grid.boundaryCells(v1, v2).length).toBe(n);
  });

  it('isInterior works correctly', () => {
    const grid = new TriGrid(face, 4);
    // (0,0) is at row 0, col 0 — boundary (left edge)
    expect(grid.isInterior('0:0:0')).toBe(false);
    // (1,1) is a downward triangle in row 1 — should be interior
    expect(grid.isInterior('0:1:1')).toBe(true);
    // (3,0) is boundary (left edge)
    expect(grid.isInterior('0:3:0')).toBe(false);
    // (3,6) is boundary (right edge, 2*3=6)
    expect(grid.isInterior('0:3:6')).toBe(false);
    // (3,2) is boundary (bottom edge, even col at last row)
    expect(grid.isInterior('0:3:2')).toBe(false);
    // (3,1) is bottom row odd col — should be interior
    expect(grid.isInterior('0:3:1')).toBe(true);
  });
});
