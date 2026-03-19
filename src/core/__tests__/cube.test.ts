import { describe, it, expect } from 'vitest';
import { Cube, RectGrid } from '../polyhedra/cube.ts';

describe('Cube', () => {
  const cube = new Cube();

  it('has 6 faces', () => {
    expect(cube.faces().length).toBe(6);
  });

  it('face adjacency has 12 edges', () => {
    const adj = cube.faceAdjacency();
    expect(adj.edgeCount()).toBe(12);
  });

  it('each face has 4 adjacent faces', () => {
    const adj = cube.faceAdjacency();
    for (let i = 0; i < 6; i++) {
      expect(adj.degree(String(i))).toBe(4);
    }
  });
});

describe('RectGrid', () => {
  const cube = new Cube();
  const face = cube.faces()[0]!;

  it('cell count = n^2', () => {
    for (const n of [2, 4, 6, 8]) {
      const grid = new RectGrid(face, n);
      expect(grid.cells().length).toBe(n * n);
    }
  });

  it('edge count = 2n(n-1)', () => {
    for (const n of [2, 4, 6, 8]) {
      const grid = new RectGrid(face, n);
      expect(grid.internalEdges().length).toBe(2 * n * (n - 1));
    }
  });

  it('boundary cells have correct length n', () => {
    const n = 4;
    const grid = new RectGrid(face, n);
    const v0 = face.vertices[0]!;
    const v1 = face.vertices[1]!;
    const boundary = grid.boundaryCells(v0, v1);
    expect(boundary.length).toBe(n);
  });

  it('cellCenter3d lies on the face', () => {
    const grid = new RectGrid(face, 4);
    const cells = grid.cells();
    for (const cell of cells) {
      const center = grid.cellCenter3d(cell);
      // y-coordinate should be 0.5 (top face)
      expect(center[1]).toBeCloseTo(0.5, 5);
    }
  });

  it('isInterior excludes boundary cells', () => {
    const grid = new RectGrid(face, 4);
    // Corner cells should not be interior
    expect(grid.isInterior('0:0:0')).toBe(false);
    expect(grid.isInterior('0:3:3')).toBe(false);
    // Center cells should be interior
    expect(grid.isInterior('0:1:1')).toBe(true);
    expect(grid.isInterior('0:2:2')).toBe(true);
  });
});
