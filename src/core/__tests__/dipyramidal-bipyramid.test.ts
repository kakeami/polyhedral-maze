import { describe, it, expect } from 'vitest';
import { HexagonalBipyramid } from '../polyhedra/dipyramidal/hexagonal-bipyramid.ts';
import { OctagonalBipyramid } from '../polyhedra/dipyramidal/octagonal-bipyramid.ts';
import { DecagonalBipyramid } from '../polyhedra/dipyramidal/decagonal-bipyramid.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot, mean } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface BipyramidCase {
  name: string;
  n: number;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  /** Every face has an antipode: D_nh with even n has central inversion. */
  antipodalFaceCount: number;
}

const cases: BipyramidCase[] = [
  { name: 'Hexagonal Bipyramid', n: 6, make: () => new HexagonalBipyramid(), faceCount: 12, edgeCount: 18, vertexCount: 8, antipodalFaceCount: 12 },
  { name: 'Octagonal Bipyramid', n: 8, make: () => new OctagonalBipyramid(), faceCount: 16, edgeCount: 24, vertexCount: 10, antipodalFaceCount: 16 },
  { name: 'Decagonal Bipyramid', n: 10, make: () => new DecagonalBipyramid(), faceCount: 20, edgeCount: 30, vertexCount: 12, antipodalFaceCount: 20 },
];

describe.each(cases)('$name (uniform bipyramid)', ({ make, n, faceCount, edgeCount, vertexCount, antipodalFaceCount }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${2 * n} isosceles triangle faces`, () => {
    expect(faces.length).toBe(faceCount);
    expect(faces.every(f => f.vertices.length === 3)).toBe(true);
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

  it('every face is dispatched to a TriGrid', () => {
    for (const f of faces) {
      expect(poly.gridForFace(f, 2)).toBeInstanceOf(TriGrid);
    }
  });

  it('builds a maze graph and generates a spanning tree', () => {
    const mg = new MazeGraph(poly, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(42) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
