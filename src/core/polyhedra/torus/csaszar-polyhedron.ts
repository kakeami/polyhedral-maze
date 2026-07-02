import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';
import { orientFacesOutward } from './_orient.ts';

/**
 * Császár Polyhedron: the classic toroidal polyhedron with no diagonals —
 * its 7 vertices and 21 edges embed the complete graph K₇ on a torus.
 * 14 triangles, genus 1 (V=7, E=21, F=14, χ=0). Discovered by Ákos Császár
 * (1949).
 *
 * Coordinates: dmccooey.com "Csaszar Polyhedron (version 4)".
 */
const C0 = Math.SQRT2 / 2;
const C1 = (8 * Math.SQRT2) / 3;
const C2 = 6 * Math.SQRT2;

const VERTS: Vec3[] = [
  [12, 0, -C2],
  [-12, 0, -C2],
  [0, 12, C2],
  [0, -12, C2],
  [-4, -3, C0],
  [4, 3, C0],
  [0, 0, C1],
];

const TRIANGLES: [number, number, number][] = [
  [0, 1, 2], [0, 2, 5], [0, 5, 4], [0, 4, 6], [0, 6, 3], [0, 3, 1], [1, 3, 4],
  [1, 4, 5], [1, 5, 6], [1, 6, 2], [2, 6, 4], [2, 4, 3], [2, 3, 5], [5, 3, 6],
];

function csaszarFaces(): Face[] {
  return orientFacesOutward(TRIANGLES.map((tri) => tri.map((i) => VERTS[i]!)));
}

export class CsaszarPolyhedron implements Polyhedron {
  private _faces = normalizeFaces(csaszarFaces(), 1);

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

export { csaszarFaces };
