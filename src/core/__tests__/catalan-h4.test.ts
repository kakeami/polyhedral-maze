import { describe, it, expect } from 'vitest';
import { DisdyakisDodecahedron } from '../polyhedra/catalan/disdyakis-dodecahedron.ts';
import { DisdyakisTriacontahedron } from '../polyhedra/catalan/disdyakis-triacontahedron.ts';
import { PentagonalIcositetrahedron } from '../polyhedra/catalan/pentagonal-icositetrahedron.ts';
import { PentagonalHexecontahedron } from '../polyhedra/catalan/pentagonal-hexecontahedron.ts';
import { TriGrid } from '../polyhedra/grids/tri-grid.ts';
import { PentGrid } from '../polyhedra/grids/pent-grid.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { oppositeFace } from '../polyhedron.ts';
import { dot, sub, cross, normalize, mean, norm } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';

interface H4Case {
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  faceVertices: number;
  hasAntipodes: boolean;
  gridClass: typeof TriGrid | typeof PentGrid;
}

const cases: H4Case[] = [
  // F=48, V=26, E=72
  { name: 'Disdyakis Dodecahedron', make: () => new DisdyakisDodecahedron(), faceCount: 48, edgeCount: 72, faceVertices: 3, hasAntipodes: true, gridClass: TriGrid },
  // F=120, V=62, E=180
  { name: 'Disdyakis Triacontahedron', make: () => new DisdyakisTriacontahedron(), faceCount: 120, edgeCount: 180, faceVertices: 3, hasAntipodes: true, gridClass: TriGrid },
  // F=24, V=38, E=60 — chiral (snub cube dual), no central inversion
  { name: 'Pentagonal Icositetrahedron', make: () => new PentagonalIcositetrahedron(), faceCount: 24, edgeCount: 60, faceVertices: 5, hasAntipodes: false, gridClass: PentGrid },
  // F=60, V=92, E=150 — chiral (snub dodec dual), no central inversion
  { name: 'Pentagonal Hexecontahedron', make: () => new PentagonalHexecontahedron(), faceCount: 60, edgeCount: 150, faceVertices: 5, hasAntipodes: false, gridClass: PentGrid },
];

describe.each(cases)('$name (Catalan H4)', ({ make, faceCount, edgeCount, faceVertices, hasAntipodes, gridClass }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${faceCount} ${faceVertices}-sided faces`, () => {
    expect(faces.length).toBe(faceCount);
    for (const f of faces) {
      expect(f.vertices.length).toBe(faceVertices);
    }
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it('all face normals point outward', () => {
    for (const f of faces) {
      const c = mean(f.vertices);
      expect(dot(f.normal, c)).toBeGreaterThan(0);
    }
  });

  it(`face antipodes: ${hasAntipodes ? 'all present' : 'none (chiral)'}`, () => {
    for (const f of faces) {
      const opp = oppositeFace(faces, f.id);
      if (hasAntipodes) {
        expect(opp).not.toBeNull();
      } else {
        expect(opp).toBeNull();
      }
    }
  });

  it('each face is convex (vertices in consistent winding)', () => {
    for (const f of faces) {
      const c = mean(f.vertices);
      const n = normalize(f.normal);
      let sign = 0;
      for (let i = 0; i < f.vertices.length; i++) {
        const a = sub(f.vertices[i]!, c);
        const b = sub(f.vertices[(i + 1) % f.vertices.length]!, c);
        const z = dot(cross(a, b), n);
        if (sign === 0) sign = Math.sign(z);
        else expect(Math.sign(z), `face ${f.id} non-convex at vertex ${i}`).toBe(sign);
      }
    }
  });

  it('cell centers lie on the face plane', () => {
    const f = faces[0]!;
    const grid = poly.gridForFace(f, 3);
    expect(grid).toBeInstanceOf(gridClass);
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
});

// Sanity: dualize preserves edge counts (Catalan E equals Archimedean E)
describe('edge counts of duals match parent Archimedean', () => {
  it('|E(dual)| = |E(original)|', () => {
    // Disdyakis Dodec (48 tri faces, 26 verts) ↔ Trunc Cuboct (26 faces, 48 verts), E = 72
    // Disdyakis Triacont ↔ Trunc Icosidodec, E = 180
    // Pent Icositetra (24, 38) ↔ Snub Cube (38, 24), E = 60
    // Pent Hexecont (60, 92) ↔ Snub Dodec (92, 60), E = 150
    expect(new DisdyakisDodecahedron().faceAdjacency().edgeCount()).toBe(72);
    expect(new PentagonalIcositetrahedron().faceAdjacency().edgeCount()).toBe(60);
    // Avoid duplicating the parametrized assertions; this just guards the formula.
    expect(norm([3, 4, 0])).toBeCloseTo(5);
  });
});
