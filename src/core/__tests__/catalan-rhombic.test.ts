import { describe, it, expect } from 'vitest';
import { RhombicDodecahedron } from '../polyhedra/catalan/rhombic-dodecahedron.ts';
import { RhombicTriacontahedron } from '../polyhedra/catalan/rhombic-triacontahedron.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot, sub, norm } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface RhombicCase {
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
}

const cases: RhombicCase[] = [
  // F=12, V=14, E=24
  { name: 'Rhombic Dodecahedron', make: () => new RhombicDodecahedron(), faceCount: 12, edgeCount: 24 },
  // F=30, V=32, E=60
  { name: 'Rhombic Triacontahedron', make: () => new RhombicTriacontahedron(), faceCount: 30, edgeCount: 60 },
];

describe.each(cases)('$name (Catalan rhombic)', ({ make, faceCount, edgeCount }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${faceCount} 4-sided faces`, () => {
    expect(faces.length).toBe(faceCount);
    for (const f of faces) {
      expect(f.vertices.length).toBe(4);
    }
  });

  it('each face is a rhombus (all 4 sides have equal length)', () => {
    for (const f of faces) {
      const v = f.vertices;
      const side0 = norm(sub(v[1]!, v[0]!));
      for (let i = 0; i < 4; i++) {
        const s = norm(sub(v[(i + 1) % 4]!, v[i]!));
        expect(s).toBeCloseTo(side0, 5);
      }
    }
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it('all face normals point outward', () => {
    for (const f of faces) {
      let cx = 0, cy = 0, cz = 0;
      for (const v of f.vertices) { cx += v[0]; cy += v[1]; cz += v[2]; }
      cx /= 4; cy /= 4; cz /= 4;
      expect(f.normal[0] * cx + f.normal[1] * cy + f.normal[2] * cz).toBeGreaterThan(0);
    }
  });

  it('each face has an antipodal partner', () => {
    for (const f of faces) {
      expect(oppositeFace(faces, f.id)).not.toBeNull();
    }
  });

  it('gridForFace returns RectGrid for every face', () => {
    for (const f of faces) {
      expect(poly.gridForFace(f, 3)).toBeInstanceOf(RectGrid);
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
    const mg = new MazeGraph(poly, 3, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(42) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });

  it('generates with warp enabled', () => {
    const mg = new MazeGraph(poly, 3, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: true, rng: createRng(7) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
