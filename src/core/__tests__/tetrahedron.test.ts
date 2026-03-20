import { describe, it, expect } from 'vitest';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { TriGrid } from '../polyhedra/octahedron.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot } from '../vec3.ts';

describe('Tetrahedron', () => {
  const tet = new Tetrahedron();

  it('has 4 faces', () => {
    expect(tet.faces().length).toBe(4);
  });

  it('face adjacency has 6 edges (complete K4)', () => {
    const adj = tet.faceAdjacency();
    expect(adj.edgeCount()).toBe(6);
  });

  it('each face has 3 adjacent faces', () => {
    const adj = tet.faceAdjacency();
    for (let i = 0; i < 4; i++) {
      expect(adj.degree(String(i))).toBe(3);
    }
  });

  it('has no opposite faces', () => {
    const faces = tet.faces();
    for (const f of faces) {
      expect(oppositeFace(faces, f.id)).toBeNull();
    }
  });
});

describe('Tetrahedron TriGrid cellCenter3d', () => {
  const tet = new Tetrahedron();
  const face = tet.faces()[0]!;

  it('all cell centers are finite and on face plane', () => {
    const grid = new TriGrid(face, 4);
    const normal = face.normal;
    const planeD = dot(face.vertices[0]!, normal);
    for (const cell of grid.cells()) {
      const pos = grid.cellCenter3d(cell);
      expect(pos.every((v) => isFinite(v))).toBe(true);
      expect(dot(pos, normal)).toBeCloseTo(planeD, 5);
    }
  });
});
