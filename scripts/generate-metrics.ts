/**
 * Generate experimental metrics data for the paper/report.
 * Runs all combinations of polyhedra × algorithms × k values.
 * Output: JSON file with aggregated results.
 */
import {
  MazeGraph,
  generate,
  computeMetrics,
  createRng,
  Cube,
  Octahedron,
  Tetrahedron,
  Icosahedron,
  Dodecahedron,
} from '../src/core/index.ts';
import type { Algorithm } from '../src/core/maze.ts';

const SHAPES = [
  { name: 'Tetrahedron', ctor: () => new Tetrahedron() },
  { name: 'Cube', ctor: () => new Cube() },
  { name: 'Octahedron', ctor: () => new Octahedron() },
  { name: 'Dodecahedron', ctor: () => new Dodecahedron() },
  { name: 'Icosahedron', ctor: () => new Icosahedron() },
] as const;

const ALGORITHMS: Algorithm[] = ['KRUSKAL', 'DFS', 'WILSON'];
const N = 6;
const K_VALUES = [1, 2, 3, 4];
const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 10 seeds for averaging

interface RunResult {
  shape: string;
  algorithm: string;
  n: number;
  k: number;
  seed: number;
  totalCells: number;
  solutionLength: number;
  solutionRatio: number;
  deadEndCount: number;
  deadEndDensity: number;
  faceCrossings: number;
  faceCoverage: number;
  totalFaces: number;
  warpUsed: boolean;
}

const results: RunResult[] = [];

for (const shape of SHAPES) {
  for (const algo of ALGORITHMS) {
    for (const k of K_VALUES) {
      for (const seed of SEEDS) {
        const poly = shape.ctor();
        const mg = new MazeGraph(poly, N, k);
        mg.build();

        const maze = generate(mg, {
          algorithm: algo,
          warp: false,
          rng: createRng(seed),
        });

        const metrics = computeMetrics(maze, mg);

        results.push({
          shape: shape.name,
          algorithm: algo,
          n: N,
          k,
          seed,
          ...metrics,
        });
      }
    }
  }
}

// Aggregate: average over seeds
interface AggRow {
  shape: string;
  algorithm: string;
  k: number;
  totalCells: number;
  avgSolutionLength: number;
  avgSolutionRatio: number;
  avgDeadEndCount: number;
  avgDeadEndDensity: number;
  avgFaceCrossings: number;
  avgFaceCoverage: number;
  totalFaces: number;
}

const grouped = new Map<string, RunResult[]>();
for (const r of results) {
  const key = `${r.shape}|${r.algorithm}|${r.k}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key)!.push(r);
}

const aggregated: AggRow[] = [];
for (const [, runs] of grouped) {
  const first = runs[0]!;
  const n = runs.length;
  aggregated.push({
    shape: first.shape,
    algorithm: first.algorithm,
    k: first.k,
    totalCells: first.totalCells,
    avgSolutionLength: runs.reduce((s, r) => s + r.solutionLength, 0) / n,
    avgSolutionRatio: runs.reduce((s, r) => s + r.solutionRatio, 0) / n,
    avgDeadEndCount: runs.reduce((s, r) => s + r.deadEndCount, 0) / n,
    avgDeadEndDensity: runs.reduce((s, r) => s + r.deadEndDensity, 0) / n,
    avgFaceCrossings: runs.reduce((s, r) => s + r.faceCrossings, 0) / n,
    avgFaceCoverage: runs.reduce((s, r) => s + r.faceCoverage, 0) / n,
    totalFaces: first.totalFaces,
  });
}

// Sort for nice display
aggregated.sort((a, b) => {
  const shapes = ['Tetrahedron', 'Cube', 'Octahedron', 'Dodecahedron', 'Icosahedron'];
  const si = shapes.indexOf(a.shape) - shapes.indexOf(b.shape);
  if (si !== 0) return si;
  const ai = ALGORITHMS.indexOf(a.algorithm as Algorithm) - ALGORITHMS.indexOf(b.algorithm as Algorithm);
  if (ai !== 0) return ai;
  return a.k - b.k;
});

const output = {
  metadata: {
    n: N,
    seeds: SEEDS,
    generatedAt: new Date().toISOString(),
  },
  raw: results,
  aggregated,
};

const outPath = new URL('../paper/figures/metrics-data.json', import.meta.url);
const fs = await import('node:fs');
fs.writeFileSync(new URL(outPath), JSON.stringify(output, null, 2));

// Also write to report dir
const reportPath = new URL('../public/report/figures/metrics-data.json', import.meta.url);
fs.writeFileSync(new URL(reportPath), JSON.stringify(output, null, 2));

// Print summary tables for LaTeX
console.log('\n=== Metrics by Shape × Algorithm (k=3) ===');
console.log('Shape | Algorithm | Cells | Sol.Len | Sol.Ratio | Dead-Ends | DE Density | Face Cross | Face Cov');
for (const row of aggregated.filter(r => r.k === 3)) {
  console.log(`${row.shape.padEnd(14)} | ${row.algorithm.padEnd(9)} | ${row.totalCells.toString().padStart(5)} | ${row.avgSolutionLength.toFixed(1).padStart(7)} | ${row.avgSolutionRatio.toFixed(3).padStart(9)} | ${row.avgDeadEndCount.toFixed(1).padStart(9)} | ${row.avgDeadEndDensity.toFixed(3).padStart(10)} | ${row.avgFaceCrossings.toFixed(1).padStart(10)} | ${row.avgFaceCoverage.toFixed(1).padStart(8)}`);
}

console.log('\n=== Effect of k (Icosahedron, n=6) ===');
console.log('Algorithm | k | Sol.Len | Sol.Ratio | Face Cross | Face Cov');
for (const row of aggregated.filter(r => r.shape === 'Icosahedron')) {
  console.log(`${row.algorithm.padEnd(9)} | ${row.k} | ${row.avgSolutionLength.toFixed(1).padStart(7)} | ${row.avgSolutionRatio.toFixed(3).padStart(9)} | ${row.avgFaceCrossings.toFixed(1).padStart(10)} | ${row.avgFaceCoverage.toFixed(1).padStart(8)}`);
}

console.log('\nDone! Written to paper/figures/metrics-data.json and public/report/figures/metrics-data.json');
