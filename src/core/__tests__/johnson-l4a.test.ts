import { describe, it, expect } from 'vitest';
import { ElongatedTriangularOrthobicupola } from '../polyhedra/johnson/j35-elongated-triangular-orthobicupola.ts';
import { ElongatedTriangularGyrobicupola } from '../polyhedra/johnson/j36-elongated-triangular-gyrobicupola.ts';
import { ElongatedSquareGyrobicupola } from '../polyhedra/johnson/j37-elongated-square-gyrobicupola.ts';
import { ElongatedPentagonalOrthobicupola } from '../polyhedra/johnson/j38-elongated-pentagonal-orthobicupola.ts';
import { ElongatedPentagonalGyrobicupola } from '../polyhedra/johnson/j39-elongated-pentagonal-gyrobicupola.ts';
import { ElongatedPentagonalOrthocupolarotunda } from '../polyhedra/johnson/j40-elongated-pentagonal-orthocupolarotunda.ts';
import { ElongatedPentagonalGyrocupolarotunda } from '../polyhedra/johnson/j41-elongated-pentagonal-gyrocupolarotunda.ts';
import { ElongatedPentagonalOrthobirotunda } from '../polyhedra/johnson/j42-elongated-pentagonal-orthobirotunda.ts';
import { ElongatedPentagonalGyrobirotunda } from '../polyhedra/johnson/j43-elongated-pentagonal-gyrobirotunda.ts';
import { GyroelongatedTriangularBicupola } from '../polyhedra/johnson/j44-gyroelongated-triangular-bicupola.ts';
import { GyroelongatedSquareBicupola } from '../polyhedra/johnson/j45-gyroelongated-square-bicupola.ts';
import { GyroelongatedPentagonalBicupola } from '../polyhedra/johnson/j46-gyroelongated-pentagonal-bicupola.ts';
import { GyroelongatedPentagonalCupolarotunda } from '../polyhedra/johnson/j47-gyroelongated-pentagonal-cupolarotunda.ts';
import { GyroelongatedPentagonalBirotunda } from '../polyhedra/johnson/j48-gyroelongated-pentagonal-birotunda.ts';
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
  composition: Record<number, number>;
}

const cases: JohnsonCase[] = [
  { id: 'j35', name: 'Elongated Triangular Orthobicupola',         make: () => new ElongatedTriangularOrthobicupola(),         faceCount: 20, edgeCount: 36, vertexCount: 18, composition: { 3: 8,  4: 12 } },
  { id: 'j36', name: 'Elongated Triangular Gyrobicupola',          make: () => new ElongatedTriangularGyrobicupola(),          faceCount: 20, edgeCount: 36, vertexCount: 18, composition: { 3: 8,  4: 12 } },
  { id: 'j37', name: 'Elongated Square Gyrobicupola',              make: () => new ElongatedSquareGyrobicupola(),              faceCount: 26, edgeCount: 48, vertexCount: 24, composition: { 3: 8,  4: 18 } },
  { id: 'j38', name: 'Elongated Pentagonal Orthobicupola',         make: () => new ElongatedPentagonalOrthobicupola(),         faceCount: 32, edgeCount: 60, vertexCount: 30, composition: { 3: 10, 4: 20, 5: 2 } },
  { id: 'j39', name: 'Elongated Pentagonal Gyrobicupola',          make: () => new ElongatedPentagonalGyrobicupola(),          faceCount: 32, edgeCount: 60, vertexCount: 30, composition: { 3: 10, 4: 20, 5: 2 } },
  { id: 'j40', name: 'Elongated Pentagonal Orthocupolarotunda',    make: () => new ElongatedPentagonalOrthocupolarotunda(),    faceCount: 37, edgeCount: 70, vertexCount: 35, composition: { 3: 15, 4: 15, 5: 7 } },
  { id: 'j41', name: 'Elongated Pentagonal Gyrocupolarotunda',     make: () => new ElongatedPentagonalGyrocupolarotunda(),     faceCount: 37, edgeCount: 70, vertexCount: 35, composition: { 3: 15, 4: 15, 5: 7 } },
  { id: 'j42', name: 'Elongated Pentagonal Orthobirotunda',        make: () => new ElongatedPentagonalOrthobirotunda(),        faceCount: 42, edgeCount: 80, vertexCount: 40, composition: { 3: 20, 4: 10, 5: 12 } },
  { id: 'j43', name: 'Elongated Pentagonal Gyrobirotunda',         make: () => new ElongatedPentagonalGyrobirotunda(),         faceCount: 42, edgeCount: 80, vertexCount: 40, composition: { 3: 20, 4: 10, 5: 12 } },
  { id: 'j44', name: 'Gyroelongated Triangular Bicupola',          make: () => new GyroelongatedTriangularBicupola(),          faceCount: 26, edgeCount: 42, vertexCount: 18, composition: { 3: 20, 4: 6 } },
  { id: 'j45', name: 'Gyroelongated Square Bicupola',              make: () => new GyroelongatedSquareBicupola(),              faceCount: 34, edgeCount: 56, vertexCount: 24, composition: { 3: 24, 4: 10 } },
  { id: 'j46', name: 'Gyroelongated Pentagonal Bicupola',          make: () => new GyroelongatedPentagonalBicupola(),          faceCount: 42, edgeCount: 70, vertexCount: 30, composition: { 3: 30, 4: 10, 5: 2 } },
  { id: 'j47', name: 'Gyroelongated Pentagonal Cupolarotunda',     make: () => new GyroelongatedPentagonalCupolarotunda(),     faceCount: 47, edgeCount: 80, vertexCount: 35, composition: { 3: 35, 4: 5,  5: 7 } },
  { id: 'j48', name: 'Gyroelongated Pentagonal Birotunda',         make: () => new GyroelongatedPentagonalBirotunda(),         faceCount: 52, edgeCount: 90, vertexCount: 40, composition: { 3: 40, 5: 12 } },
];

describe.each(cases)('Johnson L4a: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition }) => {
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
