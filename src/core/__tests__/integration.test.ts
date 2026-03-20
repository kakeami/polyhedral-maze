import { describe, it, expect } from 'vitest';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import type { Algorithm } from '../maze.ts';
import { computeMetrics } from '../metrics.ts';
import { createRng } from '../prng.ts';
import { bfsShortestPath } from '../graph.ts';
import { parseCell } from '../types.ts';
import { Cube } from '../polyhedra/cube.ts';
import { Octahedron } from '../polyhedra/octahedron.ts';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { Icosahedron } from '../polyhedra/icosahedron.ts';
import { Dodecahedron } from '../polyhedra/dodecahedron.ts';

const shapes = [
  { name: 'tetrahedron', factory: () => new Tetrahedron(), hasOpposite: false },
  { name: 'cube', factory: () => new Cube(), hasOpposite: true },
  { name: 'octahedron', factory: () => new Octahedron(), hasOpposite: true },
  { name: 'icosahedron', factory: () => new Icosahedron(), hasOpposite: true },
  { name: 'dodecahedron', factory: () => new Dodecahedron(), hasOpposite: true },
];

const algorithms: Algorithm[] = ['KRUSKAL', 'DFS', 'WILSON'];

describe('end-to-end pipeline', () => {
  for (const shape of shapes) {
    for (const n of [4, 6]) {
      for (const algo of algorithms) {
        const label = `${shape.name} n=${n} ${algo}`;

        it(`${label}: spanning tree + metrics invariants`, () => {
          const mg = new MazeGraph(shape.factory(), n, 2);
          mg.build();
          const maze = generate(mg, { algorithm: algo, rng: createRng(42) });
          const metrics = computeMetrics(maze, mg);

          // Spanning tree: |E| = |V| - 1
          expect(maze.tree.edgeCount()).toBe(maze.tree.nodeCount() - 1);

          // Connected: solution path exists
          const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
          expect(path.length).toBeGreaterThan(0);

          // Metrics consistency
          expect(metrics.solutionLength).toBe(path.length);
          expect(metrics.totalCells).toBe(maze.tree.nodeCount());
          expect(metrics.solutionRatio).toBeCloseTo(
            metrics.solutionLength / metrics.totalCells,
            10,
          );
          expect(metrics.deadEndDensity).toBeCloseTo(
            metrics.deadEndCount / metrics.totalCells,
            10,
          );

          // Dead ends = degree-1 nodes
          let deadEnds = 0;
          for (const node of maze.tree.nodes()) {
            if (maze.tree.degree(node) === 1) deadEnds++;
          }
          expect(metrics.deadEndCount).toBe(deadEnds);

          // Face coverage <= total faces
          expect(metrics.faceCoverage).toBeLessThanOrEqual(metrics.totalFaces);
          expect(metrics.faceCoverage).toBeGreaterThan(0);

          // Start and goal should be on different faces (for multi-face shapes)
          if (mg.totalCells() > 1) {
            expect(parseCell(maze.start).faceId).not.toBe(parseCell(maze.goal).faceId);
          }
        });
      }
    }
  }
});

describe('end-to-end with warp', () => {
  for (const shape of shapes) {
    const label = `${shape.name} warp`;
    it(label, () => {
      const mg = new MazeGraph(shape.factory(), 6, 2);
      mg.build();
      const maze = generate(mg, {
        algorithm: 'KRUSKAL',
        warp: true,
        rng: createRng(42),
      });

      // Spanning tree invariant still holds after warp splice
      expect(maze.tree.edgeCount()).toBe(maze.tree.nodeCount() - 1);
      const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
      expect(path.length).toBeGreaterThan(0);

      if (shape.hasOpposite) {
        expect(maze.warp).not.toBeNull();
        // Warp endpoints should be on different faces
        const aFace = parseCell(maze.warp!.cellA).faceId;
        const bFace = parseCell(maze.warp!.cellB).faceId;
        expect(aFace).not.toBe(bFace);
      } else {
        expect(maze.warp).toBeNull();
      }

      const metrics = computeMetrics(maze, mg);
      expect(metrics.solutionLength).toBe(path.length);
    });
  }
});
