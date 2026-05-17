import { describe, it, expect } from 'vitest';
import { TetragonalTrapezohedron } from '../polyhedra/dipyramidal/tetragonal-trapezohedron.ts';
import { PentagonalTrapezohedron } from '../polyhedra/dipyramidal/pentagonal-trapezohedron.ts';
import { HexagonalTrapezohedron } from '../polyhedra/dipyramidal/hexagonal-trapezohedron.ts';
import { OctagonalTrapezohedron } from '../polyhedra/dipyramidal/octagonal-trapezohedron.ts';
import { DecagonalTrapezohedron } from '../polyhedra/dipyramidal/decagonal-trapezohedron.ts';
import { KiteGrid } from '../polyhedra/grids/kite-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot, mean } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface TrapezohedronCase {
  name: string;
  n: number;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  /**
   * D_nd has central inversion iff n is odd; only then every face pairs up.
   * Even n: empirically no axis-aligned face pairs satisfy the antipode
   * threshold either, since normals tilt away from the axis.
   */
  antipodalFaceCount: number;
}

const cases: TrapezohedronCase[] = [
  { name: 'Tetragonal Trapezohedron', n: 4, make: () => new TetragonalTrapezohedron(), faceCount: 8, edgeCount: 16, vertexCount: 10, antipodalFaceCount: 0 },
  { name: 'Pentagonal Trapezohedron', n: 5, make: () => new PentagonalTrapezohedron(), faceCount: 10, edgeCount: 20, vertexCount: 12, antipodalFaceCount: 10 },
  { name: 'Hexagonal Trapezohedron', n: 6, make: () => new HexagonalTrapezohedron(), faceCount: 12, edgeCount: 24, vertexCount: 14, antipodalFaceCount: 0 },
  { name: 'Octagonal Trapezohedron', n: 8, make: () => new OctagonalTrapezohedron(), faceCount: 16, edgeCount: 32, vertexCount: 18, antipodalFaceCount: 0 },
  { name: 'Decagonal Trapezohedron', n: 10, make: () => new DecagonalTrapezohedron(), faceCount: 20, edgeCount: 40, vertexCount: 22, antipodalFaceCount: 0 },
];

describe.each(cases)('$name (uniform trapezohedron)', ({ make, n, faceCount, edgeCount, vertexCount, antipodalFaceCount }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${2 * n} kite faces`, () => {
    expect(faces.length).toBe(faceCount);
    expect(faces.every(f => f.vertices.length === 4)).toBe(true);
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

  it('every face is dispatched to a KiteGrid', () => {
    for (const f of faces) {
      expect(poly.gridForFace(f, 2)).toBeInstanceOf(KiteGrid);
    }
  });

  it('builds a maze graph and generates a spanning tree', () => {
    const mg = new MazeGraph(poly, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(42) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
