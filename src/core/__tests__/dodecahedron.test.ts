import { describe, it, expect } from 'vitest';
import { Dodecahedron, PentGrid } from '../polyhedra/dodecahedron.ts';
import { oppositeFace } from '../polyhedron.ts';

describe('Dodecahedron', () => {
  const dod = new Dodecahedron();

  it('has 12 faces', () => {
    expect(dod.faces().length).toBe(12);
  });

  it('face adjacency has 30 edges', () => {
    const adj = dod.faceAdjacency();
    expect(adj.edgeCount()).toBe(30);
  });

  it('each face has 5 adjacent faces', () => {
    const adj = dod.faceAdjacency();
    for (let i = 0; i < 12; i++) {
      expect(adj.degree(String(i))).toBe(5);
    }
  });

  it('all faces have an opposite (6 pairs)', () => {
    const faces = dod.faces();
    for (const f of faces) {
      expect(oppositeFace(faces, f.id)).not.toBeNull();
    }
  });
});

describe('PentGrid', () => {
  const dod = new Dodecahedron();
  const face = dod.faces()[0]!;

  it('cell count = 5n^2', () => {
    for (const n of [2, 4, 6, 8]) {
      const grid = new PentGrid(face, n);
      expect(grid.cells().length).toBe(5 * n * n);
    }
  });

  it('edge count = 5n(3n-1)/2', () => {
    for (const n of [2, 4, 6, 8]) {
      const grid = new PentGrid(face, n);
      expect(grid.internalEdges().length).toBe((5 * n * (3 * n - 1)) / 2);
    }
  });

  it('boundary cells have correct length n per edge', () => {
    const n = 4;
    const grid = new PentGrid(face, n);
    const verts = face.vertices;
    for (let s = 0; s < 5; s++) {
      const v0 = verts[s]!;
      const v1 = verts[(s + 1) % 5]!;
      expect(grid.boundaryCells(v0, v1).length).toBe(n);
    }
  });

  it('boundary cells are reversible', () => {
    const n = 4;
    const grid = new PentGrid(face, n);
    const verts = face.vertices;
    const v0 = verts[0]!;
    const v1 = verts[1]!;
    const forward = grid.boundaryCells(v0, v1);
    const backward = grid.boundaryCells(v1, v0);
    expect(backward).toEqual([...forward].reverse());
  });

  it('isInterior: boundary = 5n, interior = 5n(n-1)', () => {
    for (const n of [2, 4, 6]) {
      const grid = new PentGrid(face, n);
      const allCells = grid.cells();
      const interiorCount = allCells.filter((c) => grid.isInterior(c)).length;
      expect(interiorCount).toBe(5 * n * (n - 1));
    }
  });

  it('cellCenter3d returns points within face region', () => {
    const grid = new PentGrid(face, 4);
    const cells = grid.cells();
    for (const cell of cells.slice(0, 10)) {
      const pos = grid.cellCenter3d(cell);
      expect(pos.length).toBe(3);
      expect(pos.every((v) => isFinite(v))).toBe(true);
    }
  });
});
