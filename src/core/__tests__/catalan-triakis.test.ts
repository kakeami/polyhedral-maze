import { describe, it, expect } from 'vitest';
import { TriakisTetrahedron } from '../polyhedra/catalan/triakis-tetrahedron.ts';
import { TriakisOctahedron } from '../polyhedra/catalan/triakis-octahedron.ts';
import { TetrakisHexahedron } from '../polyhedra/catalan/tetrakis-hexahedron.ts';
import { TriakisIcosahedron } from '../polyhedra/catalan/triakis-icosahedron.ts';
import { PentakisDodecahedron } from '../polyhedra/catalan/pentakis-dodecahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface CatalanCase {
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  hasAntipodes: boolean;
}

const cases: CatalanCase[] = [
  // Triakis Tetrahedron has tetrahedral symmetry — no central inversion, so no
  // face antipodes (same as the parent Tetrahedron / Truncated Tetrahedron).
  { name: 'Triakis Tetrahedron', make: () => new TriakisTetrahedron(), faceCount: 12, edgeCount: 18, hasAntipodes: false },
  { name: 'Triakis Octahedron', make: () => new TriakisOctahedron(), faceCount: 24, edgeCount: 36, hasAntipodes: true },
  { name: 'Tetrakis Hexahedron', make: () => new TetrakisHexahedron(), faceCount: 24, edgeCount: 36, hasAntipodes: true },
  { name: 'Triakis Icosahedron', make: () => new TriakisIcosahedron(), faceCount: 60, edgeCount: 90, hasAntipodes: true },
  { name: 'Pentakis Dodecahedron', make: () => new PentakisDodecahedron(), faceCount: 60, edgeCount: 90, hasAntipodes: true },
];

describe.each(cases)('$name (Catalan triangular)', ({ name, make, faceCount, edgeCount, hasAntipodes }) => {
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

  it('all face normals point outward', () => {
    for (const f of faces) {
      let cx = 0, cy = 0, cz = 0;
      for (const v of f.vertices) {
        cx += v[0]; cy += v[1]; cz += v[2];
      }
      cx /= f.vertices.length; cy /= f.vertices.length; cz /= f.vertices.length;
      expect(f.normal[0] * cx + f.normal[1] * cy + f.normal[2] * cz).toBeGreaterThan(0);
    }
  });

  it(`face antipodes: ${hasAntipodes ? 'every face has one' : 'none (no central inversion)'}`, () => {
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      if (hasAntipodes) {
        expect(opp, `${name}: face ${f.id} has no antipode`).not.toBeNull();
      } else {
        expect(opp, `${name}: face ${f.id} unexpectedly has an antipode`).toBeNull();
      }
    }
  });

  it('gridForFace returns TriGrid for every face', () => {
    for (const f of faces) {
      expect(poly.gridForFace(f, 3)).toBeInstanceOf(TriGrid);
    }
  });

  it('cell centers lie on the face plane', () => {
    const f = faces[0]!;
    const grid = poly.gridForFace(f, 4);
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

  it('generates with warp enabled', () => {
    const mg = new MazeGraph(poly, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: true, rng: createRng(7) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
