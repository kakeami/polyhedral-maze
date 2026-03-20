import { describe, it, expect } from 'vitest';
import { sharedEdgeVertices, oppositeFace, buildFaceAdjacency } from '../polyhedron.ts';
import { Cube } from '../polyhedra/cube.ts';
import { Octahedron } from '../polyhedra/octahedron.ts';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { Icosahedron } from '../polyhedra/icosahedron.ts';
import { Dodecahedron } from '../polyhedra/dodecahedron.ts';

describe('sharedEdgeVertices', () => {
  const cube = new Cube();
  const faces = cube.faces();

  it('returns 2 vertices for adjacent cube faces', () => {
    // Face 0 and face 2 share an edge on the cube
    const adj = cube.faceAdjacency();
    // Find any adjacent pair
    const edges = adj.edges();
    const [f0Str, f1Str] = edges[0]!;
    const f0 = faces.find((f) => f.id === Number(f0Str))!;
    const f1 = faces.find((f) => f.id === Number(f1Str))!;
    const shared = sharedEdgeVertices(f0, f1);
    expect(shared).not.toBeNull();
    expect(shared!.length).toBe(2);
  });

  it('returns null for non-adjacent faces', () => {
    // Opposite faces on a cube share no edge
    const f0 = faces[0]!;
    const oppId = oppositeFace(faces, f0.id);
    if (oppId !== null) {
      const fOpp = faces.find((f) => f.id === oppId)!;
      expect(sharedEdgeVertices(f0, fOpp)).toBeNull();
    }
  });

  it('returns null for the same face', () => {
    const f0 = faces[0]!;
    // A face shares all vertices with itself (4 for cube), not exactly 2
    const result = sharedEdgeVertices(f0, f0);
    // Cube face has 4 shared vertices with itself, so length !== 2 → null
    expect(result).toBeNull();
  });
});

describe('oppositeFace', () => {
  it('cube has 3 opposite pairs', () => {
    const faces = new Cube().faces();
    const opposites = new Set<string>();
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      expect(opp).not.toBeNull();
      const key = Math.min(f.id, opp!) + ',' + Math.max(f.id, opp!);
      opposites.add(key);
    }
    expect(opposites.size).toBe(3);
  });

  it('tetrahedron has no opposite faces', () => {
    const faces = new Tetrahedron().faces();
    for (const f of faces) {
      expect(oppositeFace(faces, f.id)).toBeNull();
    }
  });

  it('octahedron has 4 opposite pairs', () => {
    const faces = new Octahedron().faces();
    const opposites = new Set<string>();
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      expect(opp).not.toBeNull();
      opposites.add(Math.min(f.id, opp!) + ',' + Math.max(f.id, opp!));
    }
    expect(opposites.size).toBe(4);
  });

  it('icosahedron has 10 opposite pairs', () => {
    const faces = new Icosahedron().faces();
    const opposites = new Set<string>();
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      expect(opp).not.toBeNull();
      opposites.add(Math.min(f.id, opp!) + ',' + Math.max(f.id, opp!));
    }
    expect(opposites.size).toBe(10);
  });

  it('dodecahedron has 6 opposite pairs', () => {
    const faces = new Dodecahedron().faces();
    const opposites = new Set<string>();
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      expect(opp).not.toBeNull();
      opposites.add(Math.min(f.id, opp!) + ',' + Math.max(f.id, opp!));
    }
    expect(opposites.size).toBe(6);
  });

  it('returns null for invalid faceId', () => {
    const faces = new Cube().faces();
    expect(oppositeFace(faces, 999)).toBeNull();
  });
});

describe('buildFaceAdjacency', () => {
  const cases = [
    { name: 'tetrahedron', factory: () => new Tetrahedron(), nodes: 4, edges: 6 },
    { name: 'cube', factory: () => new Cube(), nodes: 6, edges: 12 },
    { name: 'octahedron', factory: () => new Octahedron(), nodes: 8, edges: 12 },
    { name: 'icosahedron', factory: () => new Icosahedron(), nodes: 20, edges: 30 },
    { name: 'dodecahedron', factory: () => new Dodecahedron(), nodes: 12, edges: 30 },
  ];

  for (const { name, factory, nodes, edges } of cases) {
    describe(name, () => {
      const poly = factory();
      const faces = poly.faces();
      const g = buildFaceAdjacency(faces, sharedEdgeVertices);

      it(`has ${nodes} nodes`, () => {
        expect(g.nodeCount()).toBe(nodes);
      });

      it(`has ${edges} edges`, () => {
        expect(g.edgeCount()).toBe(edges);
      });

      it('edges are symmetric', () => {
        for (const [u, v] of g.edges()) {
          expect(g.hasEdge(v, u)).toBe(true);
        }
      });

      it('edge data contains edgeVertices', () => {
        for (const [u, v, data] of g.edgesWithData()) {
          expect(data).toHaveProperty('edgeVertices');
          expect(data.edgeVertices.length).toBe(2);
        }
      });
    });
  }
});
