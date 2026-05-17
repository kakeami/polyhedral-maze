import { describe, it, expect } from 'vitest';
import { GyrateRhombicosidodecahedron } from '../polyhedra/johnson/j72-gyrate-rhombicosidodecahedron.ts';
import { ParabigyrateRhombicosidodecahedron } from '../polyhedra/johnson/j73-parabigyrate-rhombicosidodecahedron.ts';
import { MetabigyrateRhombicosidodecahedron } from '../polyhedra/johnson/j74-metabigyrate-rhombicosidodecahedron.ts';
import { TrigyrateRhombicosidodecahedron } from '../polyhedra/johnson/j75-trigyrate-rhombicosidodecahedron.ts';
import { DiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j76-diminished-rhombicosidodecahedron.ts';
import { ParagyrateDiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j77-paragyrate-diminished-rhombicosidodecahedron.ts';
import { MetagyrateDiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j78-metagyrate-diminished-rhombicosidodecahedron.ts';
import { BigyrateDiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j79-bigyrate-diminished-rhombicosidodecahedron.ts';
import { ParabidiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j80-parabidiminished-rhombicosidodecahedron.ts';
import { MetabidiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j81-metabidiminished-rhombicosidodecahedron.ts';
import { GyrateBidiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j82-gyrate-bidiminished-rhombicosidodecahedron.ts';
import { TridiminishedRhombicosidodecahedron } from '../polyhedra/johnson/j83-tridiminished-rhombicosidodecahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
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
  { id: 'j72', name: 'Gyrate Rhombicosidodecahedron',                           make: () => new GyrateRhombicosidodecahedron(),                           faceCount: 62, edgeCount: 120, vertexCount: 60, composition: { 3: 20, 4: 30, 5: 12 } },
  { id: 'j73', name: 'Parabigyrate Rhombicosidodecahedron',                     make: () => new ParabigyrateRhombicosidodecahedron(),                     faceCount: 62, edgeCount: 120, vertexCount: 60, composition: { 3: 20, 4: 30, 5: 12 } },
  { id: 'j74', name: 'Metabigyrate Rhombicosidodecahedron',                     make: () => new MetabigyrateRhombicosidodecahedron(),                     faceCount: 62, edgeCount: 120, vertexCount: 60, composition: { 3: 20, 4: 30, 5: 12 } },
  { id: 'j75', name: 'Trigyrate Rhombicosidodecahedron',                        make: () => new TrigyrateRhombicosidodecahedron(),                        faceCount: 62, edgeCount: 120, vertexCount: 60, composition: { 3: 20, 4: 30, 5: 12 } },
  { id: 'j76', name: 'Diminished Rhombicosidodecahedron',                       make: () => new DiminishedRhombicosidodecahedron(),                       faceCount: 52, edgeCount: 105, vertexCount: 55, composition: { 3: 15, 4: 25, 5: 11, 10: 1 } },
  { id: 'j77', name: 'Paragyrate Diminished Rhombicosidodecahedron',            make: () => new ParagyrateDiminishedRhombicosidodecahedron(),            faceCount: 52, edgeCount: 105, vertexCount: 55, composition: { 3: 15, 4: 25, 5: 11, 10: 1 } },
  { id: 'j78', name: 'Metagyrate Diminished Rhombicosidodecahedron',            make: () => new MetagyrateDiminishedRhombicosidodecahedron(),            faceCount: 52, edgeCount: 105, vertexCount: 55, composition: { 3: 15, 4: 25, 5: 11, 10: 1 } },
  { id: 'j79', name: 'Bigyrate Diminished Rhombicosidodecahedron',              make: () => new BigyrateDiminishedRhombicosidodecahedron(),              faceCount: 52, edgeCount: 105, vertexCount: 55, composition: { 3: 15, 4: 25, 5: 11, 10: 1 } },
  { id: 'j80', name: 'Parabidiminished Rhombicosidodecahedron',                 make: () => new ParabidiminishedRhombicosidodecahedron(),                 faceCount: 42, edgeCount: 90,  vertexCount: 50, composition: { 3: 10, 4: 20, 5: 10, 10: 2 } },
  { id: 'j81', name: 'Metabidiminished Rhombicosidodecahedron',                 make: () => new MetabidiminishedRhombicosidodecahedron(),                 faceCount: 42, edgeCount: 90,  vertexCount: 50, composition: { 3: 10, 4: 20, 5: 10, 10: 2 } },
  { id: 'j82', name: 'Gyrate Bidiminished Rhombicosidodecahedron',              make: () => new GyrateBidiminishedRhombicosidodecahedron(),              faceCount: 42, edgeCount: 90,  vertexCount: 50, composition: { 3: 10, 4: 20, 5: 10, 10: 2 } },
  { id: 'j83', name: 'Tridiminished Rhombicosidodecahedron',                    make: () => new TridiminishedRhombicosidodecahedron(),                    faceCount: 32, edgeCount: 75,  vertexCount: 45, composition: { 3: 5,  4: 15, 5: 9,  10: 3 } },
];

describe.each(cases)('Johnson L4c: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition }) => {
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
        if (!uniq.some((u) => Math.hypot(u[0]! - v[0], u[1]! - v[1], u[2]! - v[2]) < 1e-5)) {
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
