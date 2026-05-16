import { describe, it, expect } from 'vitest';
import { DecGrid } from '../polyhedra/grids/dec-grid.ts';
import { TruncatedDodecahedron } from '../polyhedra/archimedean/truncated-dodecahedron.ts';
import { TruncatedIcosidodecahedron } from '../polyhedra/archimedean/truncated-icosidodecahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { HexGrid } from '../polyhedra/grids/hex-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { dot } from '../vec3.ts';

describe('DecGrid', () => {
  const td = new TruncatedDodecahedron();
  const decFace = td.faces().find((f) => f.vertices.length === 10)!;

  it('cell count = 10 * n^2', () => {
    for (const n of [1, 2, 3]) {
      const grid = new DecGrid(decFace, n);
      expect(grid.cells().length).toBe(10 * n * n);
    }
  });

  it('boundary cells have length n along each decagon edge', () => {
    const n = 2;
    const grid = new DecGrid(decFace, n);
    const verts = decFace.vertices;
    for (let i = 0; i < 10; i++) {
      expect(grid.boundaryCells(verts[i]!, verts[(i + 1) % 10]!).length).toBe(n);
    }
  });

  it('cell centers lie on the face plane', () => {
    const grid = new DecGrid(decFace, 2);
    const planeD = dot(decFace.vertices[0]!, decFace.normal);
    for (const cell of grid.cells()) {
      const pos = grid.cellCenter3d(cell);
      expect(dot(pos, decFace.normal)).toBeCloseTo(planeD, 5);
    }
  });
});

describe('TruncatedDodecahedron', () => {
  const td = new TruncatedDodecahedron();
  const faces = td.faces();

  it('has 32 faces (20 triangles + 12 decagons)', () => {
    expect(faces.length).toBe(32);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(20);
    expect(faces.filter((f) => f.vertices.length === 10).length).toBe(12);
  });

  it('face adjacency has 90 edges', () => {
    expect(td.faceAdjacency().edgeCount()).toBe(90);
  });

  it('triangles are adjacent to 3 decagons only', () => {
    const adj = td.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 3) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(3);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(10);
      }
    }
  });

  it('decagons are adjacent to 5 triangles + 5 decagons', () => {
    const adj = td.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 10) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(10);
      const triCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 3).length;
      const decCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 10).length;
      expect(triCount).toBe(5);
      expect(decCount).toBe(5);
    }
  });

  it('gridForFace dispatches correctly', () => {
    for (const f of faces) {
      const g = td.gridForFace(f, 2);
      if (f.vertices.length === 3) expect(g).toBeInstanceOf(TriGrid);
      else expect(g).toBeInstanceOf(DecGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(td, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(41) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('TruncatedIcosidodecahedron', () => {
  const tid = new TruncatedIcosidodecahedron();
  const faces = tid.faces();

  it('has 62 faces (30 squares + 20 hexagons + 12 decagons)', () => {
    expect(faces.length).toBe(62);
    expect(faces.filter((f) => f.vertices.length === 4).length).toBe(30);
    expect(faces.filter((f) => f.vertices.length === 6).length).toBe(20);
    expect(faces.filter((f) => f.vertices.length === 10).length).toBe(12);
  });

  it('face adjacency has 180 edges', () => {
    expect(tid.faceAdjacency().edgeCount()).toBe(180);
  });

  it('every square is adjacent to 2 hexagons + 2 decagons', () => {
    const adj = tid.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 4) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(4);
      const hexCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 6).length;
      const decCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 10).length;
      expect(hexCount).toBe(2);
      expect(decCount).toBe(2);
    }
  });

  it('every hexagon is adjacent to 3 squares + 3 decagons', () => {
    const adj = tid.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 6) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(6);
      const sqCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 4).length;
      const decCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 10).length;
      expect(sqCount).toBe(3);
      expect(decCount).toBe(3);
    }
  });

  it('every decagon is adjacent to 5 squares + 5 hexagons', () => {
    const adj = tid.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 10) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(10);
      const sqCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 4).length;
      const hexCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 6).length;
      expect(sqCount).toBe(5);
      expect(hexCount).toBe(5);
    }
  });

  it('gridForFace dispatches across all three face types', () => {
    for (const f of faces) {
      const g = tid.gridForFace(f, 2);
      if (f.vertices.length === 4) expect(g).toBeInstanceOf(RectGrid);
      else if (f.vertices.length === 6) expect(g).toBeInstanceOf(HexGrid);
      else expect(g).toBeInstanceOf(DecGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(tid, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(43) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
