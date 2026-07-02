import type { Face, FaceEdgeData } from '../../types.ts';
import type { Vec2 } from '../../vec2.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { extrudeFrame } from './_frame.ts';

/**
 * Hexagonal Torus: the annulus between a regular hexagon of side 2 and a
 * concentric hexagon of side 1 (both on the unit triangular lattice),
 * extruded to height 1. Genus 1 (V=36, E=90, F=54, χ=0).
 *
 * Top and bottom are 18 unit triangles each; the 12 outer and 6 inner
 * boundary lattice edges each carry a unit-square wall.
 */
const SQRT3_2 = Math.sqrt(3) / 2;

/** Triangular lattice point a·(1,0) + b·(1/2, √3/2). */
function latticePoint(a: number, b: number): Vec2 {
  return [a + b / 2, b * SQRT3_2];
}

/** Inside hexagon of side 2, excluding the center vertex (the hole). */
function inAnnulus(a: number, b: number): boolean {
  if (a === 0 && b === 0) return false;
  return Math.max(Math.abs(a), Math.abs(b), Math.abs(a + b)) <= 2;
}

function hexagonalTorusFaces(): Face[] {
  const cells: Vec2[][] = [];
  for (let a = -3; a <= 2; a++) {
    for (let b = -3; b <= 2; b++) {
      const up: [number, number][] = [[a, b], [a + 1, b], [a, b + 1]];
      const down: [number, number][] = [[a + 1, b], [a + 1, b + 1], [a, b + 1]];
      for (const tri of [up, down]) {
        if (tri.every(([x, y]) => inAnnulus(x, y))) {
          cells.push(tri.map(([x, y]) => latticePoint(x, y)));
        }
      }
    }
  }
  return extrudeFrame(cells, 1);
}

export class HexagonalTorus implements Polyhedron {
  private _faces = normalizeFaces(hexagonalTorusFaces(), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return gridForPolygonFace(face, n);
  }
}

export { hexagonalTorusFaces };
