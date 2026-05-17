import { describe, it, expect } from 'vitest';
import { AugmentedTriangularPrism } from '../polyhedra/johnson/j49-augmented-triangular-prism.ts';
import { BiaugmentedTriangularPrism } from '../polyhedra/johnson/j50-biaugmented-triangular-prism.ts';
import { AugmentedPentagonalPrism } from '../polyhedra/johnson/j52-augmented-pentagonal-prism.ts';
import { BiaugmentedPentagonalPrism } from '../polyhedra/johnson/j53-biaugmented-pentagonal-prism.ts';
import { AugmentedHexagonalPrism } from '../polyhedra/johnson/j54-augmented-hexagonal-prism.ts';
import { ParabiaugmentedHexagonalPrism } from '../polyhedra/johnson/j55-parabiaugmented-hexagonal-prism.ts';
import { MetabiaugmentedHexagonalPrism } from '../polyhedra/johnson/j56-metabiaugmented-hexagonal-prism.ts';
import { TriaugmentedHexagonalPrism } from '../polyhedra/johnson/j57-triaugmented-hexagonal-prism.ts';
import { AugmentedDodecahedron } from '../polyhedra/johnson/j58-augmented-dodecahedron.ts';
import { ParabiaugmentedDodecahedron } from '../polyhedra/johnson/j59-parabiaugmented-dodecahedron.ts';
import { MetabiaugmentedDodecahedron } from '../polyhedra/johnson/j60-metabiaugmented-dodecahedron.ts';
import { TriaugmentedDodecahedron } from '../polyhedra/johnson/j61-triaugmented-dodecahedron.ts';
import { AugmentedTruncatedTetrahedron } from '../polyhedra/johnson/j65-augmented-truncated-tetrahedron.ts';
import { AugmentedTruncatedCube } from '../polyhedra/johnson/j66-augmented-truncated-cube.ts';
import { BiaugmentedTruncatedCube } from '../polyhedra/johnson/j67-biaugmented-truncated-cube.ts';
import { AugmentedTruncatedDodecahedron } from '../polyhedra/johnson/j68-augmented-truncated-dodecahedron.ts';
import { ParabiaugmentedTruncatedDodecahedron } from '../polyhedra/johnson/j69-parabiaugmented-truncated-dodecahedron.ts';
import { MetabiaugmentedTruncatedDodecahedron } from '../polyhedra/johnson/j70-metabiaugmented-truncated-dodecahedron.ts';
import { TriaugmentedTruncatedDodecahedron } from '../polyhedra/johnson/j71-triaugmented-truncated-dodecahedron.ts';
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
  { id: 'j49', name: 'Augmented Triangular Prism',         make: () => new AugmentedTriangularPrism(),       faceCount: 8,  edgeCount: 13, vertexCount: 7,  composition: { 3: 6,  4: 2 } },
  { id: 'j50', name: 'Biaugmented Triangular Prism',       make: () => new BiaugmentedTriangularPrism(),     faceCount: 11, edgeCount: 17, vertexCount: 8,  composition: { 3: 10, 4: 1 } },
  { id: 'j52', name: 'Augmented Pentagonal Prism',         make: () => new AugmentedPentagonalPrism(),       faceCount: 10, edgeCount: 19, vertexCount: 11, composition: { 3: 4,  4: 4, 5: 2 } },
  { id: 'j53', name: 'Biaugmented Pentagonal Prism',       make: () => new BiaugmentedPentagonalPrism(),     faceCount: 13, edgeCount: 23, vertexCount: 12, composition: { 3: 8,  4: 3, 5: 2 } },
  { id: 'j54', name: 'Augmented Hexagonal Prism',          make: () => new AugmentedHexagonalPrism(),        faceCount: 11, edgeCount: 22, vertexCount: 13, composition: { 3: 4,  4: 5, 6: 2 } },
  { id: 'j55', name: 'Parabiaugmented Hexagonal Prism',    make: () => new ParabiaugmentedHexagonalPrism(),  faceCount: 14, edgeCount: 26, vertexCount: 14, composition: { 3: 8,  4: 4, 6: 2 } },
  { id: 'j56', name: 'Metabiaugmented Hexagonal Prism',    make: () => new MetabiaugmentedHexagonalPrism(),  faceCount: 14, edgeCount: 26, vertexCount: 14, composition: { 3: 8,  4: 4, 6: 2 } },
  { id: 'j57', name: 'Triaugmented Hexagonal Prism',       make: () => new TriaugmentedHexagonalPrism(),     faceCount: 17, edgeCount: 30, vertexCount: 15, composition: { 3: 12, 4: 3, 6: 2 } },
  { id: 'j58', name: 'Augmented Dodecahedron',             make: () => new AugmentedDodecahedron(),          faceCount: 16, edgeCount: 35, vertexCount: 21, composition: { 3: 5,  5: 11 } },
  { id: 'j59', name: 'Parabiaugmented Dodecahedron',       make: () => new ParabiaugmentedDodecahedron(),    faceCount: 20, edgeCount: 40, vertexCount: 22, composition: { 3: 10, 5: 10 } },
  { id: 'j60', name: 'Metabiaugmented Dodecahedron',       make: () => new MetabiaugmentedDodecahedron(),    faceCount: 20, edgeCount: 40, vertexCount: 22, composition: { 3: 10, 5: 10 } },
  { id: 'j61', name: 'Triaugmented Dodecahedron',          make: () => new TriaugmentedDodecahedron(),       faceCount: 24, edgeCount: 45, vertexCount: 23, composition: { 3: 15, 5: 9  } },
  { id: 'j65', name: 'Augmented Truncated Tetrahedron',           make: () => new AugmentedTruncatedTetrahedron(),           faceCount: 14, edgeCount: 27,  vertexCount: 15, composition: { 3: 8,  4: 3,  6: 3 } },
  { id: 'j66', name: 'Augmented Truncated Cube',                  make: () => new AugmentedTruncatedCube(),                  faceCount: 22, edgeCount: 48,  vertexCount: 28, composition: { 3: 12, 4: 5,  8: 5 } },
  { id: 'j67', name: 'Biaugmented Truncated Cube',                make: () => new BiaugmentedTruncatedCube(),                faceCount: 30, edgeCount: 60,  vertexCount: 32, composition: { 3: 16, 4: 10, 8: 4 } },
  { id: 'j68', name: 'Augmented Truncated Dodecahedron',          make: () => new AugmentedTruncatedDodecahedron(),          faceCount: 42, edgeCount: 105, vertexCount: 65, composition: { 3: 25, 4: 5,  5: 1, 10: 11 } },
  { id: 'j69', name: 'Parabiaugmented Truncated Dodecahedron',    make: () => new ParabiaugmentedTruncatedDodecahedron(),    faceCount: 52, edgeCount: 120, vertexCount: 70, composition: { 3: 30, 4: 10, 5: 2, 10: 10 } },
  { id: 'j70', name: 'Metabiaugmented Truncated Dodecahedron',    make: () => new MetabiaugmentedTruncatedDodecahedron(),    faceCount: 52, edgeCount: 120, vertexCount: 70, composition: { 3: 30, 4: 10, 5: 2, 10: 10 } },
  { id: 'j71', name: 'Triaugmented Truncated Dodecahedron',       make: () => new TriaugmentedTruncatedDodecahedron(),       faceCount: 62, edgeCount: 135, vertexCount: 75, composition: { 3: 35, 4: 15, 5: 3, 10: 9 } },
];

describe.each(cases)('Johnson L3: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition }) => {
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
