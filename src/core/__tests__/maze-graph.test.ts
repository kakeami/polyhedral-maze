import { describe, it, expect } from 'vitest';
import { MazeGraph } from '../maze-graph.ts';
import { Cube } from '../polyhedra/cube.ts';
import { Octahedron } from '../polyhedra/octahedron.ts';
import { Tetrahedron } from '../polyhedra/tetrahedron.ts';
import { Icosahedron } from '../polyhedra/icosahedron.ts';
import { Dodecahedron } from '../polyhedra/dodecahedron.ts';
import { oppositeFace } from '../polyhedron.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fixtures = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tests/golden_fixtures.json'), 'utf-8'),
);

describe('MazeGraph golden fixtures', () => {
  const shapes = {
    tetrahedron: () => new Tetrahedron(),
    cube: () => new Cube(),
    octahedron: () => new Octahedron(),
    icosahedron: () => new Icosahedron(),
    dodecahedron: () => new Dodecahedron(),
  } as const;

  for (const [shapeName, factory] of Object.entries(shapes)) {
    const shapeData = (fixtures.shapes as Record<string, typeof fixtures.shapes.cube>)[shapeName]!;

    describe(shapeName, () => {
      it(`has ${shapeData.num_faces} faces`, () => {
        const poly = factory();
        expect(poly.faces().length).toBe(shapeData.num_faces);
      });

      it(`has ${shapeData.num_edges} adjacency edges`, () => {
        const poly = factory();
        expect(poly.faceAdjacency().edgeCount()).toBe(shapeData.num_edges);
      });

      it(`has_opposite_faces = ${shapeData.has_opposite_faces}`, () => {
        const poly = factory();
        const faces = poly.faces();
        const hasOpposite = faces.some((f) => oppositeFace(faces, f.id) !== null);
        expect(hasOpposite).toBe(shapeData.has_opposite_faces);
      });

      for (const [nStr, graphData] of Object.entries(shapeData.graphs)) {
        const n = Number(nStr);
        describe(`n=${n}`, () => {
          it('total_cells matches', () => {
            const mg = new MazeGraph(factory(), n, 2);
            mg.build();
            expect(mg.totalCells()).toBe(graphData.total_cells);
          });

          it('total_edges matches', () => {
            const mg = new MazeGraph(factory(), n, 2);
            mg.build();
            expect(mg.totalEdges()).toBe(graphData.total_edges);
          });

          it('inter_face_edges matches', () => {
            const mg = new MazeGraph(factory(), n, 2);
            mg.build();
            expect(mg.interFaceEdgeCount()).toBe(graphData.inter_face_edges);
          });
        });
      }
    });
  }
});

describe('MazeGraph.selectK', () => {
  it('returns empty for k=0', () => {
    expect(MazeGraph.selectK([['a', 'b']], 0)).toEqual([]);
  });

  it('returns all for k >= n', () => {
    const pairs: [string, string][] = [['a', 'b'], ['c', 'd']];
    expect(MazeGraph.selectK(pairs, 5)).toEqual(pairs);
  });

  it('returns middle for k=1', () => {
    const pairs: [string, string][] = [['a', 'b'], ['c', 'd'], ['e', 'f']];
    expect(MazeGraph.selectK(pairs, 1)).toEqual([['c', 'd']]);
  });

  it('returns evenly spaced for k=2', () => {
    const pairs: [string, string][] = [
      ['0', 'a'], ['1', 'b'], ['2', 'c'], ['3', 'd'],
    ];
    const selected = MazeGraph.selectK(pairs, 2);
    expect(selected).toEqual([['0', 'a'], ['3', 'd']]);
  });
});
