import { describe, it, expect } from 'vitest';
import { SquareTorus } from '../polyhedra/torus/square-torus.ts';
import { HexagonalTorus } from '../polyhedra/torus/hexagonal-torus.ts';
import { DrilledTruncatedOctahedron } from '../polyhedra/torus/drilled-truncated-octahedron.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { bfsSingleSourceLengths } from '../graph.ts';
import { dot, sub, cross, norm, mean } from '../vec3.ts';
import type { Polyhedron } from '../polyhedron.ts';
import type { Vec3 } from '../types.ts';

interface TorusCase {
  id: string;
  name: string;
  make: () => Polyhedron;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  composition: Record<number, number>;
  /** Faces whose outward normal points back toward the origin (inner walls). */
  inwardFaces: number | null;
}

const cases: TorusCase[] = [
  {
    id: 'square-torus', name: 'Square Torus', make: () => new SquareTorus(),
    faceCount: 32, edgeCount: 64, vertexCount: 32,
    composition: { 4: 32 }, inwardFaces: 4,
  },
  {
    id: 'hexagonal-torus', name: 'Hexagonal Torus', make: () => new HexagonalTorus(),
    faceCount: 54, edgeCount: 90, vertexCount: 36,
    composition: { 3: 36, 4: 18 }, inwardFaces: 6,
  },
  {
    id: 'drilled-truncated-octahedron', name: 'Drilled Truncated Octahedron',
    make: () => new DrilledTruncatedOctahedron(),
    faceCount: 16, edgeCount: 40, vertexCount: 24,
    composition: { 4: 8, 6: 8 }, inwardFaces: 4,
  },
];

describe.each(cases)('Torus: $name ($id)', ({ make, faceCount, edgeCount, vertexCount, composition, inwardFaces }) => {
  const poly = make();
  const faces = poly.faces();

  it(`has ${faceCount} faces`, () => {
    expect(faces.length).toBe(faceCount);
  });

  it('face composition matches', () => {
    const actual: Record<number, number> = {};
    for (const f of faces) {
      const k = f.vertices.length;
      actual[k] = (actual[k] ?? 0) + 1;
    }
    expect(actual).toEqual(composition);
  });

  it(`face adjacency has ${edgeCount} edges`, () => {
    expect(poly.faceAdjacency().edgeCount()).toBe(edgeCount);
  });

  it('every face edge is shared with exactly one neighbor (closed manifold)', () => {
    const totalSides = faces.reduce((s, f) => s + f.vertices.length, 0);
    expect(totalSides).toBe(2 * edgeCount);
  });

  it(`has ${vertexCount} unique vertices, Euler V − E + F = 0 (genus 1)`, () => {
    const uniq: Vec3[] = [];
    for (const f of faces) {
      for (const v of f.vertices) {
        if (!uniq.some((u) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) < 1e-9)) {
          uniq.push(v);
        }
      }
    }
    expect(uniq.length).toBe(vertexCount);
    expect(vertexCount - edgeCount + faceCount).toBe(0);
  });

  it('normals match winding and enclose positive volume', () => {
    let vol6 = 0;
    for (const f of faces) {
      const [a, ...rest] = f.vertices;
      for (let i = 0; i < rest.length - 1; i++) {
        const b = rest[i]!;
        const c = rest[i + 1]!;
        vol6 += dot(a!, cross(b, c));
        // winding-derived triangle normal agrees with stored face normal
        const tn = cross(sub(b, a!), sub(c, a!));
        expect(dot(tn, f.normal)).toBeGreaterThan(0);
      }
      expect(norm(f.normal)).toBeCloseTo(1, 9);
    }
    expect(vol6).toBeGreaterThan(0);
  });

  if (inwardFaces !== null) {
    it(`has ${inwardFaces} faces facing the tunnel (dot(normal, centroid) < 0)`, () => {
      const count = faces.filter((f) => dot(f.normal, mean(f.vertices)) < -1e-9).length;
      expect(count).toBe(inwardFaces);
    });
  }

  it.each(['KRUSKAL', 'DFS', 'WILSON'] as const)('%s maze spans all cells', (algorithm) => {
    const mg = new MazeGraph(make(), 3, 2);
    mg.build();
    const maze = generate(mg, { algorithm, rng: createRng(42) });
    const total = mg.totalCells();
    expect(maze.tree.nodeCount()).toBe(total);
    expect(maze.tree.edgeCount()).toBe(total - 1);
    expect(bfsSingleSourceLengths(maze.tree, maze.start).size).toBe(total);
    expect(maze.start).not.toBe(maze.goal);
  });
});

describe('Torus specifics', () => {
  it('Square torus finds a warp pair', () => {
    const mg = new MazeGraph(new SquareTorus(), 3, 2);
    mg.build();
    const maze = generate(mg, { algorithm: 'KRUSKAL', warp: true, rng: createRng(7) });
    expect(maze.warp).not.toBeNull();
  });
});
