import { describe, it, expect } from 'vitest';
import { MetabidiminishedIcosahedron } from '../polyhedra/johnson/j62-metabidiminished-icosahedron.ts';
import { TridiminishedIcosahedron } from '../polyhedra/johnson/j63-tridiminished-icosahedron.ts';
import { AugmentedTridiminishedIcosahedron } from '../polyhedra/johnson/j64-augmented-tridiminished-icosahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { dot, sub, norm, mean } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface JohnsonCase {
  id: string;
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  composition: Record<number, number>;
}

const cases: JohnsonCase[] = [
  { id: 'j62', name: 'Metabidiminished Icosahedron',           make: () => new MetabidiminishedIcosahedron(),           faceCount: 12, edgeCount: 20, vertexCount: 10, composition: { 3: 10, 5: 2 } },
  { id: 'j63', name: 'Tridiminished Icosahedron',              make: () => new TridiminishedIcosahedron(),              faceCount: 8,  edgeCount: 15, vertexCount: 9,  composition: { 3: 5,  5: 3 } },
  { id: 'j64', name: 'Augmented Tridiminished Icosahedron',    make: () => new AugmentedTridiminishedIcosahedron(),     faceCount: 10, edgeCount: 18, vertexCount: 10, composition: { 3: 7,  5: 3 } },
];

describe.each(cases)('Johnson L4b: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${faceCount} faces`, () => {
    expect(faces.length).toBe(faceCount);
  });

  it('face composition matches', () => {
    const actual: Record<number, number> = {};
    for (const f of faces) {
      const k = f.vertices.length;
      actual[k] = (actual[k] ?? 0) + 1;
    }
    expect(actual).toEqual(composition);
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it(`has ${vertexCount} unique vertices, Euler V − E + F = 2`, () => {
    const uniq: number[][] = [];
    for (const f of faces) {
      for (const v of f.vertices) {
        if (!uniq.some((u) => Math.hypot(u[0]! - v[0], u[1]! - v[1], u[2]! - v[2]) < 1e-6)) {
          uniq.push([...v]);
        }
      }
    }
    expect(uniq.length).toBe(vertexCount);
    expect(vertexCount - edgeCount + faceCount).toBe(2);
  });

  it('all edges have the same length (uniform-edge construction)', () => {
    const edgeLens: number[] = [];
    for (const f of faces) {
      const k = f.vertices.length;
      for (let i = 0; i < k; i++) {
        edgeLens.push(norm(sub(f.vertices[(i + 1) % k]!, f.vertices[i]!)));
      }
    }
    const m = edgeLens.reduce((s, x) => s + x, 0) / edgeLens.length;
    for (const e of edgeLens) {
      expect(e).toBeCloseTo(m, 4);
    }
  });

  it('all face normals point outward from origin', () => {
    for (const f of faces) {
      const c = mean(f.vertices);
      expect(dot(f.normal, c)).toBeGreaterThan(0);
    }
  });

  it('max vertex distance from origin equals 1 (normalizeFaces)', () => {
    let maxR = 0;
    for (const f of faces) {
      for (const v of f.vertices) {
        const r = norm(v);
        if (r > maxR) maxR = r;
      }
    }
    expect(maxR).toBeCloseTo(1, 6);
  });

  it('grid dispatch picks the right grid type per face polygon', () => {
    for (const f of faces) {
      const grid = poly.gridForFace(f, 2);
      switch (f.vertices.length) {
        case 3: expect(grid).toBeInstanceOf(TriGrid); break;
        case 5: expect(grid).toBeInstanceOf(PentGrid); break;
        default: throw new Error(`unexpected polygon size ${f.vertices.length}`);
      }
    }
  });

  it('builds a maze graph and generates a spanning tree', () => {
    const mg = new MazeGraph(poly, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(42) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
