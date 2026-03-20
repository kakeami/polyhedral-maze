import { describe, it, expect } from 'vitest';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { Cube, RectGrid } from '../polyhedra/cube.ts';
import { Octahedron, TriGrid } from '../polyhedra/octahedron.ts';
import { Dodecahedron, PentGrid } from '../polyhedra/dodecahedron.ts';

describe('n=1 grids', () => {
  it('RectGrid n=1: 1 cell, 0 internal edges', () => {
    const cube = new Cube();
    const face = cube.faces()[0]!;
    const grid = new RectGrid(face, 1);
    expect(grid.cells().length).toBe(1);
    expect(grid.internalEdges().length).toBe(0);
  });

  it('TriGrid n=1: 1 cell, 0 internal edges', () => {
    const oct = new Octahedron();
    const face = oct.faces()[0]!;
    const grid = new TriGrid(face, 1);
    expect(grid.cells().length).toBe(1);
    expect(grid.internalEdges().length).toBe(0);
  });

  it('PentGrid n=1: 5 cells, 5 cross-sector edges', () => {
    const dod = new Dodecahedron();
    const face = dod.faces()[0]!;
    const grid = new PentGrid(face, 1);
    expect(grid.cells().length).toBe(5);
    // 5 sectors × 0 internal edges each + 5 cross-sector edges
    // But internalEdges() includes cross-sector edges
    // For n=1: each sector has 1 cell, 0 intra-sector edges
    // Cross-sector: 5 edges (sector s to s+1)
    expect(grid.internalEdges().length).toBe(5);
  });
});

describe('n=2 grids (smallest non-trivial)', () => {
  it('RectGrid n=2: 4 cells, 4 edges', () => {
    const cube = new Cube();
    const face = cube.faces()[0]!;
    const grid = new RectGrid(face, 2);
    expect(grid.cells().length).toBe(4);
    expect(grid.internalEdges().length).toBe(2 * 2 * (2 - 1));
  });

  it('TriGrid n=2: 4 cells, 3 edges', () => {
    const oct = new Octahedron();
    const face = oct.faces()[0]!;
    const grid = new TriGrid(face, 2);
    expect(grid.cells().length).toBe(4);
    expect(grid.internalEdges().length).toBe((3 * 2 * 1) / 2);
  });
});

describe('k=0: no inter-face edges', () => {
  it('MazeGraph with k=0 has zero inter-face edges', () => {
    const mg = new MazeGraph(new Cube(), 4, 0);
    mg.build();
    expect(mg.interFaceEdgeCount()).toBe(0);
  });
});

describe('empty MazeGraph', () => {
  it('generate() throws on empty MazeGraph', () => {
    const mg = new MazeGraph(new Cube(), 4, 2);
    // Don't call build()
    expect(() => generate(mg, { rng: createRng(0) })).toThrow('MazeGraph is empty');
  });
});
