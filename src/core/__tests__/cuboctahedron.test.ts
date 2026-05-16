import { describe, it, expect } from 'vitest';
import { Cuboctahedron } from '../polyhedra/archimedean/cuboctahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot } from '../vec3.ts';

describe('Cuboctahedron', () => {
  const cubo = new Cuboctahedron();
  const faces = cubo.faces();

  it('has 14 faces (8 triangles + 6 squares)', () => {
    expect(faces.length).toBe(14);
    const triCount = faces.filter((f) => f.vertices.length === 3).length;
    const sqCount = faces.filter((f) => f.vertices.length === 4).length;
    expect(triCount).toBe(8);
    expect(sqCount).toBe(6);
  });

  it('face adjacency has 24 edges', () => {
    const adj = cubo.faceAdjacency();
    expect(adj.edgeCount()).toBe(24);
  });

  it('each triangle face is adjacent to 3 square faces (no tri-tri adjacency)', () => {
    const adj = cubo.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length === 3) {
        const neighbors = [...adj.neighbors(String(f.id))];
        expect(neighbors.length).toBe(3);
        for (const nbr of neighbors) {
          const nbrFace = faces[Number(nbr)]!;
          expect(nbrFace.vertices.length).toBe(4);
        }
      }
    }
  });

  it('each square face is adjacent to 4 triangle faces (no sq-sq adjacency)', () => {
    const adj = cubo.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length === 4) {
        const neighbors = [...adj.neighbors(String(f.id))];
        expect(neighbors.length).toBe(4);
        for (const nbr of neighbors) {
          const nbrFace = faces[Number(nbr)]!;
          expect(nbrFace.vertices.length).toBe(3);
        }
      }
    }
  });

  it('all face normals point outward (dot with centroid > 0)', () => {
    for (const f of faces) {
      const c = f.vertices.reduce(
        (acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]] as const,
        [0, 0, 0],
      );
      const cx = c[0] / f.vertices.length;
      const cy = c[1] / f.vertices.length;
      const cz = c[2] / f.vertices.length;
      expect(f.normal[0] * cx + f.normal[1] * cy + f.normal[2] * cz).toBeGreaterThan(0);
    }
  });

  it('each face has an antipodal partner of the same type', () => {
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      expect(opp).not.toBeNull();
      const oppFace = faces[opp!]!;
      expect(oppFace.vertices.length).toBe(f.vertices.length);
      // normals should point in opposite directions
      const d =
        f.normal[0] * oppFace.normal[0] +
        f.normal[1] * oppFace.normal[1] +
        f.normal[2] * oppFace.normal[2];
      expect(d).toBeLessThan(-0.99);
    }
  });

  it('gridForFace returns TriGrid for triangular faces and RectGrid for squares', () => {
    for (const f of faces) {
      const g = cubo.gridForFace(f, 3);
      if (f.vertices.length === 3) {
        expect(g).toBeInstanceOf(TriGrid);
      } else {
        expect(g).toBeInstanceOf(RectGrid);
      }
    }
  });

  it('triangle face cells lie on the face plane', () => {
    const tri = faces.find((f) => f.vertices.length === 3)!;
    const grid = cubo.gridForFace(tri, 4);
    const planeD = dot(tri.vertices[0]!, tri.normal);
    for (const cell of grid.cells()) {
      const pos = grid.cellCenter3d(cell);
      expect(dot(pos, tri.normal)).toBeCloseTo(planeD, 5);
    }
  });

  it('square face cells lie on the face plane', () => {
    const sq = faces.find((f) => f.vertices.length === 4)!;
    const grid = cubo.gridForFace(sq, 4);
    const planeD = dot(sq.vertices[0]!, sq.normal);
    for (const cell of grid.cells()) {
      const pos = grid.cellCenter3d(cell);
      expect(dot(pos, sq.normal)).toBeCloseTo(planeD, 5);
    }
  });
});

describe('Cuboctahedron MazeGraph integration', () => {
  it('builds a valid maze graph for n=3, k=1', () => {
    const cubo = new Cuboctahedron();
    const mg = new MazeGraph(cubo, 3, 1);
    expect(() => mg.build()).not.toThrow();
    // 8 triangles × n² + 6 squares × n² = 8·9 + 6·9 = 126 cells at n=3
    expect(mg.graph.nodeCount()).toBe(8 * 9 + 6 * 9);
  });

  it('builds with k=2 (more passages)', () => {
    const cubo = new Cuboctahedron();
    const mg = new MazeGraph(cubo, 3, 2);
    expect(() => mg.build()).not.toThrow();
  });

  it('generates a spanning tree (Kruskal)', () => {
    const cubo = new Cuboctahedron();
    const mg = new MazeGraph(cubo, 3, 1);
    mg.build();
    const maze = generate(mg, {
      algorithm: 'KRUSKAL',
      warp: false,
      rng: createRng(42),
    });
    // spanning tree has nodeCount - 1 edges
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });

  it('generates a spanning tree (DFS)', () => {
    const cubo = new Cuboctahedron();
    const mg = new MazeGraph(cubo, 3, 1);
    mg.build();
    const maze = generate(mg, {
      algorithm: 'DFS',
      warp: false,
      rng: createRng(42),
    });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });

  it('generates with warp enabled', () => {
    const cubo = new Cuboctahedron();
    const mg = new MazeGraph(cubo, 3, 1);
    mg.build();
    const maze = generate(mg, {
      algorithm: 'KRUSKAL',
      warp: true,
      rng: createRng(7),
    });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
