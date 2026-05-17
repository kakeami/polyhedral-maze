import { describe, it, expect } from 'vitest';
import { TriangularCupola } from '../polyhedra/johnson/j03-triangular-cupola.ts';
import { SquareCupola } from '../polyhedra/johnson/j04-square-cupola.ts';
import { PentagonalCupola } from '../polyhedra/johnson/j05-pentagonal-cupola.ts';
import { PentagonalRotunda } from '../polyhedra/johnson/j06-pentagonal-rotunda.ts';
import { TriangularOrthobicupola } from '../polyhedra/johnson/j27-triangular-orthobicupola.ts';
import { SquareOrthobicupola } from '../polyhedra/johnson/j28-square-orthobicupola.ts';
import { SquareGyrobicupola } from '../polyhedra/johnson/j29-square-gyrobicupola.ts';
import { PentagonalOrthobicupola } from '../polyhedra/johnson/j30-pentagonal-orthobicupola.ts';
import { PentagonalGyrobicupola } from '../polyhedra/johnson/j31-pentagonal-gyrobicupola.ts';
import { PentagonalOrthocupolarotunda } from '../polyhedra/johnson/j32-pentagonal-orthocupolarotunda.ts';
import { PentagonalGyrocupolarotunda } from '../polyhedra/johnson/j33-pentagonal-gyrocupolarotunda.ts';
import { PentagonalOrthobirotunda } from '../polyhedra/johnson/j34-pentagonal-orthobirotunda.ts';
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
  { id: 'j3',  name: 'Triangular Cupola',              make: () => new TriangularCupola(),              faceCount: 8,  edgeCount: 15, vertexCount: 9,  composition: { 3: 4,  4: 3,  6: 1 } },
  { id: 'j4',  name: 'Square Cupola',                  make: () => new SquareCupola(),                  faceCount: 10, edgeCount: 20, vertexCount: 12, composition: { 3: 4,  4: 5,  8: 1 } },
  { id: 'j5',  name: 'Pentagonal Cupola',              make: () => new PentagonalCupola(),              faceCount: 12, edgeCount: 25, vertexCount: 15, composition: { 3: 5,  4: 5,  5: 1,  10: 1 } },
  { id: 'j6',  name: 'Pentagonal Rotunda',             make: () => new PentagonalRotunda(),             faceCount: 17, edgeCount: 35, vertexCount: 20, composition: { 3: 10, 5: 6,  10: 1 } },
  { id: 'j27', name: 'Triangular Orthobicupola',       make: () => new TriangularOrthobicupola(),       faceCount: 14, edgeCount: 24, vertexCount: 12, composition: { 3: 8,  4: 6 } },
  { id: 'j28', name: 'Square Orthobicupola',           make: () => new SquareOrthobicupola(),           faceCount: 18, edgeCount: 32, vertexCount: 16, composition: { 3: 8,  4: 10 } },
  { id: 'j29', name: 'Square Gyrobicupola',            make: () => new SquareGyrobicupola(),            faceCount: 18, edgeCount: 32, vertexCount: 16, composition: { 3: 8,  4: 10 } },
  { id: 'j30', name: 'Pentagonal Orthobicupola',       make: () => new PentagonalOrthobicupola(),       faceCount: 22, edgeCount: 40, vertexCount: 20, composition: { 3: 10, 4: 10, 5: 2 } },
  { id: 'j31', name: 'Pentagonal Gyrobicupola',        make: () => new PentagonalGyrobicupola(),        faceCount: 22, edgeCount: 40, vertexCount: 20, composition: { 3: 10, 4: 10, 5: 2 } },
  { id: 'j32', name: 'Pentagonal Orthocupolarotunda',  make: () => new PentagonalOrthocupolarotunda(),  faceCount: 27, edgeCount: 50, vertexCount: 25, composition: { 3: 15, 4: 5,  5: 7 } },
  { id: 'j33', name: 'Pentagonal Gyrocupolarotunda',   make: () => new PentagonalGyrocupolarotunda(),   faceCount: 27, edgeCount: 50, vertexCount: 25, composition: { 3: 15, 4: 5,  5: 7 } },
  { id: 'j34', name: 'Pentagonal Orthobirotunda',      make: () => new PentagonalOrthobirotunda(),      faceCount: 32, edgeCount: 60, vertexCount: 30, composition: { 3: 20, 5: 12 } },
];

describe.each(cases)('Johnson L1: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition }) => {
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
