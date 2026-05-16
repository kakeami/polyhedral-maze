import { describe, it, expect } from 'vitest';
import { OctGrid } from '../polyhedra/grids/oct-grid.ts';
import { TruncatedCube } from '../polyhedra/archimedean/truncated-cube.ts';
import { TruncatedCuboctahedron } from '../polyhedra/archimedean/truncated-cuboctahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { HexGrid } from '../polyhedra/grids/hex-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { dot } from '../vec3.ts';

describe('OctGrid', () => {
  const tc = new TruncatedCube();
  const octFace = tc.faces().find((f) => f.vertices.length === 8)!;

  it('cell count = 8 * n^2', () => {
    for (const n of [1, 2, 3]) {
      const grid = new OctGrid(octFace, n);
      expect(grid.cells().length).toBe(8 * n * n);
    }
  });

  it('boundary cells have length n along each octagon edge', () => {
    const n = 3;
    const grid = new OctGrid(octFace, n);
    const verts = octFace.vertices;
    for (let i = 0; i < 8; i++) {
      const v0 = verts[i]!;
      const v1 = verts[(i + 1) % 8]!;
      expect(grid.boundaryCells(v0, v1).length).toBe(n);
    }
  });

  it('cell centers lie on the face plane', () => {
    const grid = new OctGrid(octFace, 2);
    const planeD = dot(octFace.vertices[0]!, octFace.normal);
    for (const cell of grid.cells()) {
      const pos = grid.cellCenter3d(cell);
      expect(dot(pos, octFace.normal)).toBeCloseTo(planeD, 5);
    }
  });
});

describe('TruncatedCube', () => {
  const tc = new TruncatedCube();
  const faces = tc.faces();

  it('has 14 faces (8 triangles + 6 octagons)', () => {
    expect(faces.length).toBe(14);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(8);
    expect(faces.filter((f) => f.vertices.length === 8).length).toBe(6);
  });

  it('face adjacency has 36 edges', () => {
    expect(tc.faceAdjacency().edgeCount()).toBe(36);
  });

  it('triangles are adjacent to 3 octagons only', () => {
    const adj = tc.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 3) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(3);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(8);
      }
    }
  });

  it('octagons are adjacent to 4 triangles + 4 octagons', () => {
    const adj = tc.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 8) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(8);
      const triCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 3).length;
      const octCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 8).length;
      expect(triCount).toBe(4);
      expect(octCount).toBe(4);
    }
  });

  it('gridForFace dispatches correctly', () => {
    for (const f of faces) {
      const g = tc.gridForFace(f, 2);
      if (f.vertices.length === 3) expect(g).toBeInstanceOf(TriGrid);
      else expect(g).toBeInstanceOf(OctGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(tc, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(31) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('TruncatedCuboctahedron', () => {
  const tco = new TruncatedCuboctahedron();
  const faces = tco.faces();

  it('has 26 faces (12 squares + 8 hexagons + 6 octagons)', () => {
    expect(faces.length).toBe(26);
    expect(faces.filter((f) => f.vertices.length === 4).length).toBe(12);
    expect(faces.filter((f) => f.vertices.length === 6).length).toBe(8);
    expect(faces.filter((f) => f.vertices.length === 8).length).toBe(6);
  });

  it('face adjacency has 72 edges', () => {
    expect(tco.faceAdjacency().edgeCount()).toBe(72);
  });

  it('every square is adjacent to 1 hexagon + 1 octagon + 2 of the other types', () => {
    // Each square's 4 edges are shared with: one octagon, one hexagon, and two
    // additional faces. By the omnitruncation structure, the two squares share
    // edges only via the octagons/hexagons (no square-square adjacency).
    const adj = tco.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 4) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(4);
      const octCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 8).length;
      const hexCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 6).length;
      expect(octCount).toBe(2);
      expect(hexCount).toBe(2);
    }
  });

  it('every octagon is adjacent to 4 squares + 4 hexagons (alternating)', () => {
    const adj = tco.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 8) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(8);
      const sqCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 4).length;
      const hexCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 6).length;
      expect(sqCount).toBe(4);
      expect(hexCount).toBe(4);
    }
  });

  it('every hexagon is adjacent to 3 squares + 3 octagons', () => {
    const adj = tco.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 6) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(6);
      const sqCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 4).length;
      const octCount = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 8).length;
      expect(sqCount).toBe(3);
      expect(octCount).toBe(3);
    }
  });

  it('gridForFace dispatches across all three face types', () => {
    for (const f of faces) {
      const g = tco.gridForFace(f, 2);
      if (f.vertices.length === 4) expect(g).toBeInstanceOf(RectGrid);
      else if (f.vertices.length === 6) expect(g).toBeInstanceOf(HexGrid);
      else expect(g).toBeInstanceOf(OctGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(tco, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(33) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
