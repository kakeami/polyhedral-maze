import { describe, it, expect } from 'vitest';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { oppositeFace } from '../polyhedron.ts';

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
