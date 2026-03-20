/**
 * Generate golden test fixtures from the TypeScript implementation.
 * Run: npx tsx scripts/gen-ts-fixtures.ts
 */
import { MazeGraph } from '../src/core/maze-graph.ts';
import { generate, type Algorithm } from '../src/core/maze.ts';
import { computeMetrics } from '../src/core/metrics.ts';
import { createRng } from '../src/core/prng.ts';
import { Cube } from '../src/core/polyhedra/cube.ts';
import { Octahedron } from '../src/core/polyhedra/octahedron.ts';
import { Tetrahedron } from '../src/core/polyhedra/tetrahedron.ts';
import { Icosahedron } from '../src/core/polyhedra/icosahedron.ts';
import { Dodecahedron } from '../src/core/polyhedra/dodecahedron.ts';
import { oppositeFace } from '../src/core/polyhedron.ts';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nValues = [4, 6, 8];
const seeds = [0, 42];
const algorithms: Algorithm[] = ['KRUSKAL', 'DFS', 'WILSON'];

const shapeFactories = {
  tetrahedron: () => new Tetrahedron(),
  cube: () => new Cube(),
  octahedron: () => new Octahedron(),
  icosahedron: () => new Icosahedron(),
  dodecahedron: () => new Dodecahedron(),
};

interface MazeEntry {
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

const result: Record<string, unknown> = {
  _meta: {
    description: 'Golden test fixtures generated from TypeScript implementation',
    n_values: nValues,
    seeds,
    algorithms,
  },
  shapes: {} as Record<string, unknown>,
};

for (const [shapeName, factory] of Object.entries(shapeFactories)) {
  const poly = factory();
  const faces = poly.faces();
  const adj = poly.faceAdjacency();
  const hasOpposite = faces.some((f) => oppositeFace(faces, f.id) !== null);

  const graphs: Record<string, unknown> = {};
  for (const n of nValues) {
    const mg = new MazeGraph(factory(), n, 2);
    mg.build();
    graphs[String(n)] = {
      n,
      total_cells: mg.totalCells(),
      total_edges: mg.totalEdges(),
      inter_face_edges: mg.interFaceEdgeCount(),
    };
  }

  const mazes: MazeEntry[] = [];
  for (const n of nValues) {
    for (const seed of seeds) {
      for (const algo of algorithms) {
        const mg = new MazeGraph(factory(), n, 2);
        mg.build();
        const maze = generate(mg, { algorithm: algo, rng: createRng(seed) });
        const metrics = computeMetrics(maze, mg);

        mazes.push({
          n,
          seed,
          algorithm: algo,
          start: maze.start,
          goal: maze.goal,
          solution_length: metrics.solutionLength,
          solution_ratio: Number(metrics.solutionRatio.toFixed(6)),
          dead_end_count: metrics.deadEndCount,
          dead_end_density: Number(metrics.deadEndDensity.toFixed(6)),
          face_crossings: metrics.faceCrossings,
          face_coverage: metrics.faceCoverage,
          warp_used: metrics.warpUsed,
        });
      }

      // Warp entries (n=6 only)
      if (hasOpposite && n === 6) {
        for (const algo of ['KRUSKAL', 'WILSON'] as Algorithm[]) {
          const mg = new MazeGraph(factory(), n, 2);
          mg.build();
          const maze = generate(mg, { algorithm: algo, warp: true, rng: createRng(seed) });
          const metrics = computeMetrics(maze, mg);

          const entry: MazeEntry = {
            n,
            seed,
            algorithm: algo,
            start: maze.start,
            goal: maze.goal,
            solution_length: metrics.solutionLength,
            solution_ratio: Number(metrics.solutionRatio.toFixed(6)),
            dead_end_count: metrics.deadEndCount,
            dead_end_density: Number(metrics.deadEndDensity.toFixed(6)),
            face_crossings: metrics.faceCrossings,
            face_coverage: metrics.faceCoverage,
            warp_used: metrics.warpUsed,
            warp_enabled: true,
          };
          if (maze.warp) {
            entry.warp = { cell_a: maze.warp.cellA, cell_b: maze.warp.cellB };
          }
          mazes.push(entry);
        }
      }
    }
  }

  (result.shapes as Record<string, unknown>)[shapeName] = {
    num_faces: faces.length,
    num_edges: adj.edgeCount(),
    num_vertices: new Set(faces.flatMap((f) => f.vertices.map((v) => v.join(',')))).size,
    has_opposite_faces: hasOpposite,
    graphs,
    mazes,
  };
}

const outPath = resolve(__dirname, '../tests/golden_fixtures_ts.json');
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`Written to ${outPath}`);
console.log(
  `Total mazes: ${Object.values(result.shapes as Record<string, { mazes: unknown[] }>).reduce((sum, s) => sum + s.mazes.length, 0)}`,
);
