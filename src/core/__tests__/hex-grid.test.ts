import { describe, it, expect } from 'vitest';
import { HexGrid } from '../polyhedra/grids/hex-grid.ts';
import { TruncatedTetrahedron } from '../polyhedra/archimedean/truncated-tetrahedron.ts';
import { dot } from '../vec3.ts';

describe('HexGrid', () => {
  const tt = new TruncatedTetrahedron();
  const hexFace = tt.faces().find((f) => f.vertices.length === 6)!;

  it('cell count = 6 * n^2', () => {
    for (const n of [1, 2, 4, 6]) {
      const grid = new HexGrid(hexFace, n);
      expect(grid.cells().length).toBe(6 * n * n);
    }
  });

  it('internal edges = 6 * (3n(n-1)/2 + n) = 9n^2 - 3n', () => {
    // Each of 6 sectors contributes 3n(n-1)/2 within-sector edges (TriGrid pattern).
    // Plus 6n cross-sector edges (one per row of each shared inter-sector boundary).
    for (const n of [1, 2, 3, 4]) {
      const grid = new HexGrid(hexFace, n);
      const expected = 6 * (3 * n * (n - 1)) / 2 + 6 * n;
      expect(grid.internalEdges().length).toBe(expected);
    }
  });

  it('boundary cells have correct length n for each hex edge', () => {
    const n = 3;
    const grid = new HexGrid(hexFace, n);
    const verts = hexFace.vertices;
    for (let i = 0; i < 6; i++) {
      const v0 = verts[i]!;
      const v1 = verts[(i + 1) % 6]!;
      expect(grid.boundaryCells(v0, v1).length).toBe(n);
    }
  });

  it('boundary cells are reversed when edge direction is reversed', () => {
    const n = 4;
    const grid = new HexGrid(hexFace, n);
    const verts = hexFace.vertices;
    const forward = grid.boundaryCells(verts[0]!, verts[1]!);
    const backward = grid.boundaryCells(verts[1]!, verts[0]!);
    expect([...backward].reverse()).toEqual(forward);
  });

  it('cell centers lie on the face plane', () => {
    const grid = new HexGrid(hexFace, 3);
    const planeD = dot(hexFace.vertices[0]!, hexFace.normal);
    for (const cell of grid.cells()) {
      const pos = grid.cellCenter3d(cell);
      expect(dot(pos, hexFace.normal)).toBeCloseTo(planeD, 5);
    }
  });

  it('interior cells exclude bottom-edge cells of each sector', () => {
    const n = 3;
    const grid = new HexGrid(hexFace, n);
    let interior = 0;
    let boundary = 0;
    for (const cell of grid.cells()) {
      if (grid.isInterior(cell)) interior++;
      else boundary++;
    }
    // Each sector boundary has n cells; 6 sectors × n = 6n boundary cells.
    expect(boundary).toBe(6 * n);
    expect(interior).toBe(6 * n * n - 6 * n);
  });
});
