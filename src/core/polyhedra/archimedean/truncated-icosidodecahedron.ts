import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { HexGrid } from '../grids/hex-grid.ts';
import { DecGrid } from '../grids/dec-grid.ts';
import { cantitruncate } from './_cantitruncate.ts';

/**
 * Truncated Icosidodecahedron (a.k.a. great rhombicosidodecahedron):
 * 30 squares + 20 hexagons + 12 decagons = 62 faces, 120 vertices, 180 edges.
 *
 * Built by cantitruncating the icosahedron:
 *   - 20 triangle faces → 20 hexagons
 *   - 30 edges          → 30 squares
 *   - 12 vertices       → 12 decagons (each of valence 5)
 */
function makeFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;

  const V: Vec3[] = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];

  const F: number[][] = [
    [0, 1, 8], [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1],
    [3, 6, 10], [3, 10, 2], [3, 2, 11], [3, 11, 7], [3, 7, 6],
    [1, 6, 8], [8, 6, 10], [8, 10, 4], [4, 10, 2], [4, 2, 5],
    [5, 2, 11], [5, 11, 9], [9, 11, 7], [9, 7, 1], [1, 7, 6],
  ];

  return cantitruncate(V, F);
}

export class TruncatedIcosidodecahedron implements Polyhedron {
  private _faces = makeFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    if (face.vertices.length === 4) return new RectGrid(face, n);
    if (face.vertices.length === 6) return new HexGrid(face, n);
    return new DecGrid(face, n);
  }
}
