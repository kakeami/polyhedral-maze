import { describe, it, expect } from 'vitest';
import { SnubCube } from '../polyhedra/archimedean/snub-cube.ts';
import { SnubDodecahedron } from '../polyhedra/archimedean/snub-dodecahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';

function edgeLengths(faces: ReturnType<SnubCube['faces']>): number[] {
  const lens: number[] = [];
  for (const f of faces) {
    const n = f.vertices.length;
    for (let i = 0; i < n; i++) {
      const a = f.vertices[i]!;
      const b = f.vertices[(i + 1) % n]!;
      lens.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
  }
  return lens;
}

describe('SnubCube', () => {
  const sc = new SnubCube();
  const faces = sc.faces();

  it('has 38 faces (6 squares + 32 triangles)', () => {
    expect(faces.length).toBe(38);
    expect(faces.filter((f) => f.vertices.length === 4).length).toBe(6);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(32);
  });

  it('face adjacency has 60 edges', () => {
    expect(sc.faceAdjacency().edgeCount()).toBe(60);
  });

  it('has 24 unique vertices', () => {
    const set = new Set<string>();
    for (const f of faces) {
      for (const v of f.vertices) {
        set.add(v.map((x) => x.toFixed(6)).join(','));
      }
    }
    expect(set.size).toBe(24);
  });

  it('every square is adjacent to 4 triangles', () => {
    const adj = sc.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 4) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(4);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(3);
      }
    }
  });

  it('all edges are equal length (Archimedean)', () => {
    const lens = edgeLengths(faces);
    const mn = Math.min(...lens);
    const mx = Math.max(...lens);
    expect(mx - mn).toBeLessThan(1e-3);
  });

  it('gridForFace dispatches correctly', () => {
    for (const f of faces) {
      const g = sc.gridForFace(f, 2);
      if (f.vertices.length === 4) expect(g).toBeInstanceOf(RectGrid);
      else expect(g).toBeInstanceOf(TriGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(sc, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(51) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('SnubDodecahedron', () => {
  const sd = new SnubDodecahedron();
  const faces = sd.faces();

  it('has 92 faces (12 pentagons + 80 triangles)', () => {
    expect(faces.length).toBe(92);
    expect(faces.filter((f) => f.vertices.length === 5).length).toBe(12);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(80);
  });

  it('face adjacency has 150 edges', () => {
    expect(sd.faceAdjacency().edgeCount()).toBe(150);
  });

  it('has 60 unique vertices', () => {
    const set = new Set<string>();
    for (const f of faces) {
      for (const v of f.vertices) {
        set.add(v.map((x) => x.toFixed(6)).join(','));
      }
    }
    expect(set.size).toBe(60);
  });

  it('every pentagon is adjacent to 5 triangles', () => {
    const adj = sd.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 5) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(5);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(3);
      }
    }
  });

  it('all edges are equal length (Archimedean)', () => {
    const lens = edgeLengths(faces);
    const mn = Math.min(...lens);
    const mx = Math.max(...lens);
    expect(mx - mn).toBeLessThan(1e-3);
  });

  it('gridForFace dispatches correctly', () => {
    for (const f of faces) {
      const g = sd.gridForFace(f, 2);
      if (f.vertices.length === 5) expect(g).toBeInstanceOf(PentGrid);
      else expect(g).toBeInstanceOf(TriGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(sd, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(53) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
