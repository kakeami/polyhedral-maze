import { describe, it, expect } from 'vitest';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import type { Algorithm } from '../maze.ts';
import { computeMetrics } from '../metrics.ts';
import { createRng } from '../prng.ts';
import { Cube } from '../polyhedra/cube.ts';
import { Octahedron } from '../polyhedra/octahedron.ts';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { Icosahedron } from '../polyhedra/icosahedron.ts';
import { Dodecahedron } from '../polyhedra/dodecahedron.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fixtures = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tests/golden_fixtures_ts.json'), 'utf-8'),
);

interface MazeFixture {
  n: number;
  seed: number;
  algorithm: Algorithm;
  start: string;
  goal: string;
  solution_length: number;
  solution_ratio: number;
  dead_end_count: number;
  dead_end_density: number;
  face_crossings: number;
  face_coverage: number;
  warp_used: boolean;
  warp_enabled?: boolean;
  warp?: { cell_a: string; cell_b: string };
}

const shapeFactories = {
  tetrahedron: () => new Tetrahedron(),
  cube: () => new Cube(),
  octahedron: () => new Octahedron(),
  icosahedron: () => new Icosahedron(),
  dodecahedron: () => new Dodecahedron(),
} as const;

describe('computeMetrics golden fixtures', () => {
  for (const [shapeName, factory] of Object.entries(shapeFactories)) {
    const shapeData = fixtures.shapes[shapeName];
    const mazes: MazeFixture[] = shapeData.mazes;

    describe(shapeName, () => {
      for (const entry of mazes) {
        const label = `n=${entry.n} seed=${entry.seed} ${entry.algorithm}${entry.warp_enabled ? ' +warp' : ''}`;

        it(label, () => {
          const mg = new MazeGraph(factory(), entry.n, 2);
          mg.build();

          const maze = generate(mg, {
            algorithm: entry.algorithm,
            warp: entry.warp_enabled ?? false,
            rng: createRng(entry.seed),
          });

          const metrics = computeMetrics(maze, mg);

          // dead_end_count is independent of start/goal placement
          expect(metrics.deadEndCount).toBe(entry.dead_end_count);
          expect(metrics.totalCells).toBe(mg.totalCells());

          // These depend on start/goal which are deterministic given same PRNG
          expect(metrics.solutionLength).toBe(entry.solution_length);
          expect(metrics.faceCrossings).toBe(entry.face_crossings);
          expect(metrics.faceCoverage).toBe(entry.face_coverage);
          expect(metrics.warpUsed).toBe(entry.warp_used);

          // Derived metrics should be consistent
          expect(metrics.solutionRatio).toBeCloseTo(
            metrics.solutionLength / metrics.totalCells,
            10,
          );
          expect(metrics.deadEndDensity).toBeCloseTo(
            metrics.deadEndCount / metrics.totalCells,
            10,
          );
        });
      }
    });
  }
});
