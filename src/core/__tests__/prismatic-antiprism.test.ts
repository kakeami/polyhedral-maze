import { describe, it, expect } from 'vitest';
import { SquareAntiprism } from '../polyhedra/prismatic/square-antiprism.ts';
import { PentagonalAntiprism } from '../polyhedra/prismatic/pentagonal-antiprism.ts';
import { HexagonalAntiprism } from '../polyhedra/prismatic/hexagonal-antiprism.ts';
import { OctagonalAntiprism } from '../polyhedra/prismatic/octagonal-antiprism.ts';
import { DecagonalAntiprism } from '../polyhedra/prismatic/decagonal-antiprism.ts';
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

interface AntiprismCase {
  name: string;
  n: number;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  /**
   * D_nd has central inversion iff n is odd. Even n: only the top/bot n-gons
   * pair as antipodes. Odd n: every face has an antipode.
   */
  antipodalFaceCount: number;
  baseGridCtor: new (...args: never[]) => unknown;
}

const cases: AntiprismCase[] = [
  { name: 'Square Antiprism', n: 4, make: () => new SquareAntiprism(), faceCount: 10, edgeCount: 16, vertexCount: 8, antipodalFaceCount: 2, baseGridCtor: RectGrid },
  { name: 'Pentagonal Antiprism', n: 5, make: () => new PentagonalAntiprism(), faceCount: 12, edgeCount: 20, vertexCount: 10, antipodalFaceCount: 12, baseGridCtor: PentGrid },
  { name: 'Hexagonal Antiprism', n: 6, make: () => new HexagonalAntiprism(), faceCount: 14, edgeCount: 24, vertexCount: 12, antipodalFaceCount: 2, baseGridCtor: HexGrid },
  { name: 'Octagonal Antiprism', n: 8, make: () => new OctagonalAntiprism(), faceCount: 18, edgeCount: 32, vertexCount: 16, antipodalFaceCount: 2, baseGridCtor: OctGrid },
  { name: 'Decagonal Antiprism', n: 10, make: () => new DecagonalAntiprism(), faceCount: 22, edgeCount: 40, vertexCount: 20, antipodalFaceCount: 2, baseGridCtor: DecGrid },
];

describe.each(cases)('$name (uniform antiprism)', ({ make, n, faceCount, edgeCount, vertexCount, antipodalFaceCount, baseGridCtor }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has 2 n-gons + ${2 * n} triangles (${faceCount} total)`, () => {
    expect(faces.length).toBe(faceCount);
    const ngons = faces.filter(f => f.vertices.length === n).length;
    const tris = faces.filter(f => f.vertices.length === 3).length;
    expect(ngons).toBe(2);
    expect(tris).toBe(2 * n);
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

  it('all edges have unit length (after normalization to circumradius 1)', () => {
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

  it('grid dispatch matches face polygon type', () => {
    for (const f of faces) {
      const grid = poly.gridForFace(f, 2);
      if (f.vertices.length === 3) {
        expect(grid).toBeInstanceOf(TriGrid);
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
