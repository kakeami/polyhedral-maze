import { describe, it, expect } from 'vitest';
import { DeltoidalIcositetrahedron } from '../polyhedra/catalan/deltoidal-icositetrahedron.ts';
import { DeltoidalHexecontahedron } from '../polyhedra/catalan/deltoidal-hexecontahedron.ts';
import { KiteGrid } from '../polyhedra/grids/kite-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot, sub, norm } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface KiteCase {
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
}

const cases: KiteCase[] = [
  // F=24, V=26, E=48
  { name: 'Deltoidal Icositetrahedron', make: () => new DeltoidalIcositetrahedron(), faceCount: 24, edgeCount: 48 },
  // F=60, V=62, E=120
  { name: 'Deltoidal Hexecontahedron', make: () => new DeltoidalHexecontahedron(), faceCount: 60, edgeCount: 120 },
];

describe.each(cases)('$name (Catalan kite)', ({ make, faceCount, edgeCount }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${faceCount} 4-sided faces`, () => {
    expect(faces.length).toBe(faceCount);
    for (const f of faces) {
      expect(f.vertices.length).toBe(4);
    }
  });

  it('each face is a kite (two adjacent edge pairs of equal length)', () => {
    // Kite property: there exists a vertex i such that |v[i]-v[i-1]| = |v[i]-v[i+1]|
    // AND the opposite vertex has the same property with the other pair.
    for (const f of faces) {
      const v = f.vertices;
      const len = (a: number, b: number) => norm(sub(v[b]!, v[a]!));
      const sides = [len(0, 1), len(1, 2), len(2, 3), len(3, 0)];
      // Kite: either (s0==s1 && s2==s3) or (s0==s3 && s1==s2)
      const pat1 = Math.abs(sides[0]! - sides[1]!) < 1e-5 && Math.abs(sides[2]! - sides[3]!) < 1e-5;
      const pat2 = Math.abs(sides[0]! - sides[3]!) < 1e-5 && Math.abs(sides[1]! - sides[2]!) < 1e-5;
      expect(pat1 || pat2, `face ${f.id} sides=${sides}`).toBe(true);
    }
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it('each face has an antipodal partner', () => {
    for (const f of faces) {
      expect(oppositeFace(faces, f.id)).not.toBeNull();
    }
  });

  it('gridForFace returns KiteGrid (with kind=kite) for every face', () => {
    for (const f of faces) {
      const g = poly.gridForFace(f, 3);
      expect(g).toBeInstanceOf(KiteGrid);
      expect(g.kind).toBe('kite');
    }
  });

  it('cell centers lie on the face plane', () => {
    const f = faces[0]!;
    const grid = poly.gridForFace(f, 3);
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
