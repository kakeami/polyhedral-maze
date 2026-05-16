import { describe, it, expect } from 'vitest';
import { TruncatedTetrahedron } from '../polyhedra/archimedean/truncated-tetrahedron.ts';
import { TruncatedOctahedron } from '../polyhedra/archimedean/truncated-octahedron.ts';
import { TruncatedIcosahedron } from '../polyhedra/archimedean/truncated-icosahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { RectGrid } from '../polyhedra/grids/rect-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { HexGrid } from '../polyhedra/grids/hex-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';

describe('TruncatedTetrahedron', () => {
  const tt = new TruncatedTetrahedron();
  const faces = tt.faces();

  it('has 8 faces (4 triangles + 4 hexagons)', () => {
    expect(faces.length).toBe(8);
    expect(faces.filter((f) => f.vertices.length === 3).length).toBe(4);
    expect(faces.filter((f) => f.vertices.length === 6).length).toBe(4);
  });

  it('face adjacency has 18 edges', () => {
    const adj = tt.faceAdjacency();
    expect(adj.edgeCount()).toBe(18);
  });

  it('all face normals point outward', () => {
    for (const f of faces) {
      const cx = f.vertices.reduce((a, v) => a + v[0], 0) / f.vertices.length;
      const cy = f.vertices.reduce((a, v) => a + v[1], 0) / f.vertices.length;
      const cz = f.vertices.reduce((a, v) => a + v[2], 0) / f.vertices.length;
      expect(f.normal[0] * cx + f.normal[1] * cy + f.normal[2] * cz).toBeGreaterThan(0);
    }
  });

  it('gridForFace dispatches: TriGrid for triangles, HexGrid for hexagons', () => {
    for (const f of faces) {
      const g = tt.gridForFace(f, 3);
      if (f.vertices.length === 3) expect(g).toBeInstanceOf(TriGrid);
      else expect(g).toBeInstanceOf(HexGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree', () => {
    const mg = new MazeGraph(tt, 3, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: false, rng: createRng(1) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('TruncatedOctahedron', () => {
  const to = new TruncatedOctahedron();
  const faces = to.faces();

  it('has 14 faces (6 squares + 8 hexagons)', () => {
    expect(faces.length).toBe(14);
    expect(faces.filter((f) => f.vertices.length === 4).length).toBe(6);
    expect(faces.filter((f) => f.vertices.length === 6).length).toBe(8);
  });

  it('face adjacency has 36 edges', () => {
    const adj = to.faceAdjacency();
    expect(adj.edgeCount()).toBe(36);
  });

  it('antipodal partner of each face has the same vertex count', () => {
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      expect(opp).not.toBeNull();
      expect(faces[opp!]!.vertices.length).toBe(f.vertices.length);
    }
  });

  it('gridForFace dispatches: RectGrid for squares, HexGrid for hexagons', () => {
    for (const f of faces) {
      const g = to.gridForFace(f, 3);
      if (f.vertices.length === 4) expect(g).toBeInstanceOf(RectGrid);
      else expect(g).toBeInstanceOf(HexGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree (DFS)', () => {
    const mg = new MazeGraph(to, 3, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(2) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});

describe('TruncatedIcosahedron', () => {
  const ti = new TruncatedIcosahedron();
  const faces = ti.faces();

  it('has 32 faces (12 pentagons + 20 hexagons)', () => {
    expect(faces.length).toBe(32);
    expect(faces.filter((f) => f.vertices.length === 5).length).toBe(12);
    expect(faces.filter((f) => f.vertices.length === 6).length).toBe(20);
  });

  it('face adjacency has 90 edges', () => {
    // Truncated icosahedron has 90 edges total.
    const adj = ti.faceAdjacency();
    expect(adj.edgeCount()).toBe(90);
  });

  it('each pentagon is adjacent to 5 hexagons only', () => {
    const adj = ti.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 5) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(5);
      for (const n of neighbors) {
        expect(faces[Number(n)]!.vertices.length).toBe(6);
      }
    }
  });

  it('each hexagon is adjacent to 3 pentagons + 3 hexagons', () => {
    const adj = ti.faceAdjacency();
    for (const f of faces) {
      if (f.vertices.length !== 6) continue;
      const neighbors = [...adj.neighbors(String(f.id))];
      expect(neighbors.length).toBe(6);
      const nbrPent = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 5).length;
      const nbrHex = neighbors.filter((n) => faces[Number(n)]!.vertices.length === 6).length;
      expect(nbrPent).toBe(3);
      expect(nbrHex).toBe(3);
    }
  });

  it('gridForFace dispatches: PentGrid for pentagons, HexGrid for hexagons', () => {
    for (const f of faces) {
      const g = ti.gridForFace(f, 2);
      if (f.vertices.length === 5) expect(g).toBeInstanceOf(PentGrid);
      else expect(g).toBeInstanceOf(HexGrid);
    }
  });

  it('MazeGraph builds and generates a spanning tree (Wilson)', () => {
    const mg = new MazeGraph(ti, 2, 1);
    mg.build();
    const maze = generate(mg, { algorithm: 'WILSON', warp: false, rng: createRng(3) });
    expect(maze.tree.edgeCount()).toBe(mg.graph.nodeCount() - 1);
  });
});
