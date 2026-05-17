import { describe, it, expect } from 'vitest';
import { TriangularPrism } from '../polyhedra/prismatic/triangular-prism.ts';
import { PentagonalPrism } from '../polyhedra/prismatic/pentagonal-prism.ts';
import { HexagonalPrism } from '../polyhedra/prismatic/hexagonal-prism.ts';
import { OctagonalPrism } from '../polyhedra/prismatic/octagonal-prism.ts';
import { DecagonalPrism } from '../polyhedra/prismatic/decagonal-prism.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { HexGrid } from '../polyhedra/grids/hex-grid.ts';
import { OctGrid } from '../polyhedra/grids/oct-grid.ts';
import { DecGrid } from '../polyhedra/grids/dec-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot, sub, norm, mean } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface PrismCase {
  name: string;
  n: number;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  /** All faces are antipodal when n is even (D_nh has σ_h plus a horizontal C_2). */
  antipodalFaceCount: number;
  baseGridCtor: new (...args: never[]) => unknown;
}

const cases: PrismCase[] = [
  // Top/bot n-gons are always antipodal (normals ±z). Lateral squares pair up
  // only when n is even (their normals are radial, antipodes need n/2 rotation).
  { name: 'Triangular Prism', n: 3, make: () => new TriangularPrism(), faceCount: 5, edgeCount: 9, vertexCount: 6, antipodalFaceCount: 2, baseGridCtor: TriGrid },
  { name: 'Pentagonal Prism', n: 5, make: () => new PentagonalPrism(), faceCount: 7, edgeCount: 15, vertexCount: 10, antipodalFaceCount: 2, baseGridCtor: PentGrid },
  { name: 'Hexagonal Prism', n: 6, make: () => new HexagonalPrism(), faceCount: 8, edgeCount: 18, vertexCount: 12, antipodalFaceCount: 8, baseGridCtor: HexGrid },
  { name: 'Octagonal Prism', n: 8, make: () => new OctagonalPrism(), faceCount: 10, edgeCount: 24, vertexCount: 16, antipodalFaceCount: 10, baseGridCtor: OctGrid },
  { name: 'Decagonal Prism', n: 10, make: () => new DecagonalPrism(), faceCount: 12, edgeCount: 30, vertexCount: 20, antipodalFaceCount: 12, baseGridCtor: DecGrid },
];

describe.each(cases)('$name (uniform prism)', ({ make, n, faceCount, edgeCount, vertexCount, antipodalFaceCount, baseGridCtor }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has 2 n-gons + ${n} squares (${faceCount} total)`, () => {
    expect(faces.length).toBe(faceCount);
    const ngons = faces.filter(f => f.vertices.length === n).length;
    const rects = faces.filter(f => f.vertices.length === 4).length;
    expect(ngons).toBe(2);
    expect(rects).toBe(n);
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it('Euler V - E + F = 2', () => {
    const uniq: number[][] = [];
    for (const f of faces) {
      for (const v of f.vertices) {
        if (!uniq.some(u => Math.hypot(u[0]! - v[0], u[1]! - v[1], u[2]! - v[2]) < 1e-6)) {
          uniq.push([...v]);
        }
      }
    }
    expect(uniq.length).toBe(vertexCount);
    expect(vertexCount - edgeCount + faceCount).toBe(2);
  });

  it('all edges have the same length (unit-edge construction)', () => {
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

  it(`exactly ${antipodalFaceCount} faces have an antipode`, () => {
    let count = 0;
    for (const f of faces) {
      if (oppositeFace(faces, f.id) !== null) count++;
    }
    expect(count).toBe(antipodalFaceCount);
  });

  it('grid dispatch picks the right grid type for each face', () => {
    for (const f of faces) {
      const grid = poly.gridForFace(f, 2);
      if (f.vertices.length === 4) {
        expect(grid).toBeInstanceOf(RectGrid);
      } else {
        expect(grid).toBeInstanceOf(baseGridCtor);
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
