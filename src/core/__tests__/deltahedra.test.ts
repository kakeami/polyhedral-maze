import { describe, it, expect } from 'vitest';
import { TriangularBipyramid } from '../polyhedra/deltahedra/triangular-bipyramid.ts';
import { PentagonalBipyramid } from '../polyhedra/deltahedra/pentagonal-bipyramid.ts';
import { SnubDisphenoid } from '../polyhedra/deltahedra/snub-disphenoid.ts';
import { TriaugmentedTriangularPrism } from '../polyhedra/deltahedra/triaugmented-triangular-prism.ts';
import { GyroelongatedSquareBipyramid } from '../polyhedra/deltahedra/gyroelongated-square-bipyramid.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedra/../polyhedron.ts';
import { dot, sub, norm } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface DeltaCase {
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  /**
   * Number of faces that have an antipodal face (by opposite normal).
   * Most non-Platonic convex deltahedra lack central inversion entirely, but
   * J51 has D_3h symmetry whose horizontal mirror gives the top/bottom
   * equilateral triangles antipodal normals.
   */
  antipodalFaceCount: number;
}

const cases: DeltaCase[] = [
  // F=6, V=5, E=9
  { name: 'Triangular Bipyramid', make: () => new TriangularBipyramid(), faceCount: 6, edgeCount: 9, vertexCount: 5, antipodalFaceCount: 0 },
  // F=10, V=7, E=15
  { name: 'Pentagonal Bipyramid', make: () => new PentagonalBipyramid(), faceCount: 10, edgeCount: 15, vertexCount: 7, antipodalFaceCount: 0 },
  // F=12, V=8, E=18 (Johnson J84)
  { name: 'Snub Disphenoid', make: () => new SnubDisphenoid(), faceCount: 12, edgeCount: 18, vertexCount: 8, antipodalFaceCount: 0 },
  // F=14, V=9, E=21 (Johnson J51) — top/bottom triangles share an inversion axis
  { name: 'Triaugmented Triangular Prism', make: () => new TriaugmentedTriangularPrism(), faceCount: 14, edgeCount: 21, vertexCount: 9, antipodalFaceCount: 2 },
  // F=16, V=10, E=24 (Johnson J17) — D_4d has no σ_h, no antipodes
  { name: 'Gyroelongated Square Bipyramid', make: () => new GyroelongatedSquareBipyramid(), faceCount: 16, edgeCount: 24, vertexCount: 10, antipodalFaceCount: 0 },
];

describe.each(cases)('$name (convex deltahedron)', ({ make, faceCount, edgeCount, vertexCount, antipodalFaceCount }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${faceCount} triangular faces`, () => {
    expect(faces.length).toBe(faceCount);
    for (const f of faces) {
      expect(f.vertices.length).toBe(3);
    }
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it('Euler formula V - E + F = 2 holds', () => {
    // Count unique vertices via spatial dedup (vertices are shared between faces).
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

  it('all edges of all faces have (approximately) the same length', () => {
    const edgeLens: number[] = [];
    for (const f of faces) {
      for (let i = 0; i < f.vertices.length; i++) {
        edgeLens.push(norm(sub(f.vertices[(i + 1) % f.vertices.length]!, f.vertices[i]!)));
      }
    }
    const mean = edgeLens.reduce((s, x) => s + x, 0) / edgeLens.length;
    for (const e of edgeLens) {
      expect(e).toBeCloseTo(mean, 4);
    }
  });

  it('all face normals point outward', () => {
    for (const f of faces) {
      const c: [number, number, number] = [
        (f.vertices[0]![0] + f.vertices[1]![0] + f.vertices[2]![0]) / 3,
        (f.vertices[0]![1] + f.vertices[1]![1] + f.vertices[2]![1]) / 3,
        (f.vertices[0]![2] + f.vertices[1]![2] + f.vertices[2]![2]) / 3,
      ];
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

  it('cell centers lie on the face plane', () => {
    const f = faces[0]!;
    const grid = poly.gridForFace(f, 3);
    expect(grid).toBeInstanceOf(TriGrid);
    const planeD = dot(f.vertices[0]!, f.normal);
    for (const cell of grid.cells()) {
      expect(dot(grid.cellCenter3d(cell), f.normal)).toBeCloseTo(planeD, 5);
    }
  });

  it('builds a maze graph and generates a spanning tree', () => {
    const mg = new MazeGraph(poly, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(42) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
