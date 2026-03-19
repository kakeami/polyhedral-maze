import { describe, it, expect } from 'vitest';
import { generate } from '../maze.ts';
import type { Algorithm } from '../maze.ts';
import { MazeGraph } from '../maze-graph.ts';
import { Cube } from '../polyhedra/cube.ts';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { Octahedron } from '../polyhedra/octahedron.ts';
import { Icosahedron } from '../polyhedra/icosahedron.ts';
import { Dodecahedron } from '../polyhedra/dodecahedron.ts';
import { createRng } from '../prng.ts';
import { parseCell } from '../types.ts';
import { bfsShortestPath } from '../graph.ts';

describe('maze algorithms (structural)', () => {
  const algorithms: Algorithm[] = ['KRUSKAL', 'DFS', 'WILSON'];
  const shapes = [
    { name: 'cube', factory: () => new Cube() },
    { name: 'octahedron', factory: () => new Octahedron() },
    { name: 'tetrahedron', factory: () => new Tetrahedron() },
    { name: 'icosahedron', factory: () => new Icosahedron() },
    { name: 'dodecahedron', factory: () => new Dodecahedron() },
  ];

  for (const shape of shapes) {
    for (const algo of algorithms) {
      describe(`${shape.name} + ${algo}`, () => {
        const mg = new MazeGraph(shape.factory(), 4, 2);
        mg.build();
        const maze = generate(mg, { algorithm: algo, rng: createRng(42) });

        it('spanning tree: |E| = |V| - 1', () => {
          expect(maze.tree.edgeCount()).toBe(maze.tree.nodeCount() - 1);
        });

        it('tree is connected (solution exists)', () => {
          const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
          expect(path.length).toBeGreaterThan(0);
        });

        it('start and goal are on different faces', () => {
          expect(parseCell(maze.start).faceId).not.toBe(parseCell(maze.goal).faceId);
        });
      });
    }
  }
});

describe('warp', () => {
  it('warp endpoints are on opposite faces (cube)', () => {
    const mg = new MazeGraph(new Cube(), 4, 2);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: true, rng: createRng(42) });
    expect(maze.warp).not.toBeNull();
    const aFace = parseCell(maze.warp!.cellA).faceId;
    const bFace = parseCell(maze.warp!.cellB).faceId;
    expect(aFace).not.toBe(bFace);
  });

  it('tree is still a spanning tree after warp splice', () => {
    const mg = new MazeGraph(new Cube(), 4, 2);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: true, rng: createRng(42) });
    expect(maze.tree.edgeCount()).toBe(maze.tree.nodeCount() - 1);
    // Should still be connected
    const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
    expect(path.length).toBeGreaterThan(0);
  });

  it('tetrahedron has no warp (no opposite faces)', () => {
    const mg = new MazeGraph(new Tetrahedron(), 4, 2);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: true, rng: createRng(42) });
    expect(maze.warp).toBeNull();
  });
});
