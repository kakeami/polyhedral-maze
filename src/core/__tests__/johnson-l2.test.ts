import { describe, it, expect } from 'vitest';
import { SquarePyramid } from '../polyhedra/johnson/j01-square-pyramid.ts';
import { PentagonalPyramid } from '../polyhedra/johnson/j02-pentagonal-pyramid.ts';
import { ElongatedTriangularPyramid } from '../polyhedra/johnson/j07-elongated-triangular-pyramid.ts';
import { ElongatedSquarePyramid } from '../polyhedra/johnson/j08-elongated-square-pyramid.ts';
import { ElongatedPentagonalPyramid } from '../polyhedra/johnson/j09-elongated-pentagonal-pyramid.ts';
import { GyroelongatedSquarePyramid } from '../polyhedra/johnson/j10-gyroelongated-square-pyramid.ts';
import { GyroelongatedPentagonalPyramid } from '../polyhedra/johnson/j11-gyroelongated-pentagonal-pyramid.ts';
import { ElongatedTriangularBipyramid } from '../polyhedra/johnson/j14-elongated-triangular-bipyramid.ts';
import { ElongatedSquareBipyramid } from '../polyhedra/johnson/j15-elongated-square-bipyramid.ts';
import { ElongatedPentagonalBipyramid } from '../polyhedra/johnson/j16-elongated-pentagonal-bipyramid.ts';
import { ElongatedTriangularCupola } from '../polyhedra/johnson/j18-elongated-triangular-cupola.ts';
import { ElongatedSquareCupola } from '../polyhedra/johnson/j19-elongated-square-cupola.ts';
import { ElongatedPentagonalCupola } from '../polyhedra/johnson/j20-elongated-pentagonal-cupola.ts';
import { ElongatedPentagonalRotunda } from '../polyhedra/johnson/j21-elongated-pentagonal-rotunda.ts';
import { GyroelongatedTriangularCupola } from '../polyhedra/johnson/j22-gyroelongated-triangular-cupola.ts';
import { GyroelongatedSquareCupola } from '../polyhedra/johnson/j23-gyroelongated-square-cupola.ts';
import { GyroelongatedPentagonalCupola } from '../polyhedra/johnson/j24-gyroelongated-pentagonal-cupola.ts';
import { GyroelongatedPentagonalRotunda } from '../polyhedra/johnson/j25-gyroelongated-pentagonal-rotunda.ts';
import { Gyrobifastigium } from '../polyhedra/johnson/j26-gyrobifastigium.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { HexGrid } from '../polyhedra/grids/hex-grid.ts';
import { OctGrid } from '../polyhedra/grids/oct-grid.ts';
import { DecGrid } from '../polyhedra/grids/dec-grid.ts';
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
  /** Map polygon size → count of faces. */
  composition: Record<number, number>;
}

const cases: JohnsonCase[] = [
  { id: 'j1', name: 'Square Pyramid',                make: () => new SquarePyramid(),                faceCount: 5,  edgeCount: 8,  vertexCount: 5,  composition: { 3: 4, 4: 1 } },
  { id: 'j2', name: 'Pentagonal Pyramid',            make: () => new PentagonalPyramid(),            faceCount: 6,  edgeCount: 10, vertexCount: 6,  composition: { 3: 5, 5: 1 } },
  { id: 'j7', name: 'Elongated Triangular Pyramid',  make: () => new ElongatedTriangularPyramid(),   faceCount: 7,  edgeCount: 12, vertexCount: 7,  composition: { 3: 4, 4: 3 } },
  { id: 'j8', name: 'Elongated Square Pyramid',      make: () => new ElongatedSquarePyramid(),       faceCount: 9,  edgeCount: 16, vertexCount: 9,  composition: { 3: 4, 4: 5 } },
  { id: 'j9',  name: 'Elongated Pentagonal Pyramid',     make: () => new ElongatedPentagonalPyramid(),      faceCount: 11, edgeCount: 20, vertexCount: 11, composition: { 3: 5, 4: 5, 5: 1 } },
  { id: 'j10', name: 'Gyroelongated Square Pyramid',     make: () => new GyroelongatedSquarePyramid(),      faceCount: 13, edgeCount: 20, vertexCount: 9,  composition: { 3: 12, 4: 1 } },
  { id: 'j11', name: 'Gyroelongated Pentagonal Pyramid', make: () => new GyroelongatedPentagonalPyramid(),  faceCount: 16, edgeCount: 25, vertexCount: 11, composition: { 3: 15, 5: 1 } },
  { id: 'j14', name: 'Elongated Triangular Bipyramid',   make: () => new ElongatedTriangularBipyramid(),    faceCount: 9,  edgeCount: 15, vertexCount: 8,  composition: { 3: 6,  4: 3 } },
  { id: 'j15', name: 'Elongated Square Bipyramid',       make: () => new ElongatedSquareBipyramid(),        faceCount: 12, edgeCount: 20, vertexCount: 10, composition: { 3: 8,  4: 4 } },
  { id: 'j16', name: 'Elongated Pentagonal Bipyramid',   make: () => new ElongatedPentagonalBipyramid(),    faceCount: 15, edgeCount: 25, vertexCount: 12, composition: { 3: 10, 4: 5 } },
  { id: 'j18', name: 'Elongated Triangular Cupola',      make: () => new ElongatedTriangularCupola(),       faceCount: 14, edgeCount: 27, vertexCount: 15, composition: { 3: 4,  4: 9,  6: 1 } },
  { id: 'j19', name: 'Elongated Square Cupola',          make: () => new ElongatedSquareCupola(),           faceCount: 18, edgeCount: 36, vertexCount: 20, composition: { 3: 4,  4: 13, 8: 1 } },
  { id: 'j20', name: 'Elongated Pentagonal Cupola',      make: () => new ElongatedPentagonalCupola(),       faceCount: 22, edgeCount: 45, vertexCount: 25, composition: { 3: 5,  4: 15, 5: 1, 10: 1 } },
  { id: 'j21', name: 'Elongated Pentagonal Rotunda',     make: () => new ElongatedPentagonalRotunda(),      faceCount: 27, edgeCount: 55, vertexCount: 30, composition: { 3: 10, 4: 10, 5: 6, 10: 1 } },
  { id: 'j22', name: 'Gyroelongated Triangular Cupola',  make: () => new GyroelongatedTriangularCupola(),   faceCount: 20, edgeCount: 33, vertexCount: 15, composition: { 3: 16, 4: 3,  6: 1 } },
  { id: 'j23', name: 'Gyroelongated Square Cupola',      make: () => new GyroelongatedSquareCupola(),       faceCount: 26, edgeCount: 44, vertexCount: 20, composition: { 3: 20, 4: 5,  8: 1 } },
  { id: 'j24', name: 'Gyroelongated Pentagonal Cupola',  make: () => new GyroelongatedPentagonalCupola(),   faceCount: 32, edgeCount: 55, vertexCount: 25, composition: { 3: 25, 4: 5,  5: 1, 10: 1 } },
  { id: 'j25', name: 'Gyroelongated Pentagonal Rotunda', make: () => new GyroelongatedPentagonalRotunda(),  faceCount: 37, edgeCount: 65, vertexCount: 30, composition: { 3: 30, 5: 6,  10: 1 } },
  { id: 'j26', name: 'Gyrobifastigium',                  make: () => new Gyrobifastigium(),                 faceCount: 8,  edgeCount: 14, vertexCount: 8,  composition: { 3: 4,  4: 4 } },
];

describe.each(cases)('Johnson L2: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition }) => {
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
        case 4: expect(grid).toBeInstanceOf(RectGrid); break;
        case 5: expect(grid).toBeInstanceOf(PentGrid); break;
        case 6: expect(grid).toBeInstanceOf(HexGrid); break;
        case 8: expect(grid).toBeInstanceOf(OctGrid); break;
        case 10: expect(grid).toBeInstanceOf(DecGrid); break;
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
