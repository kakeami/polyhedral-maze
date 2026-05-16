import { describe, it, expect } from 'vitest';
import { Icosidodecahedron } from '../polyhedra/archimedean/icosidodecahedron.ts';
import { Rhombicuboctahedron } from '../polyhedra/archimedean/rhombicuboctahedron.ts';
import { Rhombicosidodecahedron } from '../polyhedra/archimedean/rhombicosidodecahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';

describe('Icosidodecahedron', () => {
  const id = new Icosidodecahedron();
  const faces = id.faces();

  it('has 32 faces (20 triangles + 12 pentagons)', () => {
    expect(faces.length).toBe(32);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(20);
    expect(faces.filter((f) => f.vertices.length === 5).length).toBe(12);
  });

  it('face adjacency has 60 edges', () => {
    // Icosidodecahedron has 60 edges.
    expect(id.faceAdjacency().edgeCount()).toBe(60);
  });

  it('every triangle is adjacent to 3 pentagons only', () => {
    const adj = id.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 3) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(3);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(5);
      }
    }
  });

  it('every pentagon is adjacent to 5 triangles only', () => {
    const adj = id.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 5) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(5);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(3);
      }
    }
  });

  it('gridForFace dispatches correctly', () => {
    for (const f of faces) {
      const g = id.gridForFace(f, 3);
      if (f.vertices.length === 3) expect(g).toBeInstanceOf(TriGrid);
      else expect(g).toBeInstanceOf(PentGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(id, 3, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(11) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('Rhombicuboctahedron', () => {
  const r = new Rhombicuboctahedron();
  const faces = r.faces();

  it('has 26 faces (8 triangles + 18 squares)', () => {
    expect(faces.length).toBe(26);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(8);
    expect(faces.filter((f) => f.vertices.length === 4).length).toBe(18);
  });

  it('face adjacency has 48 edges', () => {
    // Rhombicuboctahedron has 48 edges.
    expect(r.faceAdjacency().edgeCount()).toBe(48);
  });

  it('every triangle is adjacent to 3 squares only', () => {
    const adj = r.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 3) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(3);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(4);
      }
    }
  });

  it('gridForFace dispatches correctly', () => {
    for (const f of faces) {
      const g = r.gridForFace(f, 2);
      if (f.vertices.length === 3) expect(g).toBeInstanceOf(TriGrid);
      else expect(g).toBeInstanceOf(RectGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree (DFS)', () => {
    const mg = new MazeGraph(r, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(13) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('Rhombicosidodecahedron', () => {
  const r = new Rhombicosidodecahedron();
  const faces = r.faces();

  it('has 62 faces (20 triangles + 30 squares + 12 pentagons)', () => {
    expect(faces.length).toBe(62);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(20);
    expect(faces.filter((f) => f.vertices.length === 4).length).toBe(30);
    expect(faces.filter((f) => f.vertices.length === 5).length).toBe(12);
  });

  it('face adjacency has 120 edges', () => {
    // Rhombicosidodecahedron has 120 edges.
    expect(r.faceAdjacency().edgeCount()).toBe(120);
  });

  it('every triangle is adjacent to 3 squares only', () => {
    const adj = r.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 3) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(3);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(4);
      }
    }
  });

  it('every pentagon is adjacent to 5 squares only', () => {
    const adj = r.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 5) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(5);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(4);
      }
    }
  });

  it('gridForFace dispatches across all three face types', () => {
    for (const f of faces) {
      const g = r.gridForFace(f, 2);
      if (f.vertices.length === 3) expect(g).toBeInstanceOf(TriGrid);
      else if (f.vertices.length === 4) expect(g).toBeInstanceOf(RectGrid);
      else expect(g).toBeInstanceOf(PentGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(r, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(17) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
