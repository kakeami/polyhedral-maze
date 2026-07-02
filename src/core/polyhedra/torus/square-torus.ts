import type { Face, FaceEdgeData } from '../../types.ts';
import type { Vec2 } from '../../vec2.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { extrudeFrame } from './_frame.ts';

/**
 * Square Torus: a 3×3×1 block of unit cubes with the center column removed.
 * The simplest lattice toroid — 32 unit-square faces, genus 1
 * (V=32, E=64, F=32, χ=0).
 *
 * Top and bottom rings are 8 unit squares each; the outer wall is split into
 * 3 squares per side so that every face meets its neighbors edge-to-edge.
 */
function squareTorusFaces(): Face[] {
  const cells: Vec2[][] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === 1 && j === 1) continue; // the hole
      const x0 = i - 1.5;
      const y0 = j - 1.5;
      cells.push([
        [x0, y0],
        [x0 + 1, y0],
        [x0 + 1, y0 + 1],
        [x0, y0 + 1],
      ]);
    }
  }
  return extrudeFrame(cells, 1);
}

export class SquareTorus implements Polyhedron {
  private _faces = normalizeFaces(squareTorusFaces(), 1);

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

export { squareTorusFaces };
