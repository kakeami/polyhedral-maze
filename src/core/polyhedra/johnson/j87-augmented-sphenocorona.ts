import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { augmentWithPyramid } from './_augment.ts';
import { sphenocoronaFaces } from './j86-sphenocorona.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Augmented Sphenocorona (J87). Sphenocorona (J86) with a square pyramid (J1)
 * attached to one of its two square faces. 17 faces (16 triangles + 1 square),
 * 11 vertices, 26 edges.
 *
 * The two squares of J86 are related by its C_2 symmetry, so the choice of
 * host face does not affect the resulting shape — pick the first 4-gon.
 */
function augmentedSphenocoronaFaces(): Face[] {
  const base = sphenocoronaFaces();
  const hostId = base.find((f) => f.vertices.length === 4)?.id;
  if (hostId === undefined) {
    throw new Error('augmentedSphenocorona: no square face found on base');
  }
  return augmentWithPyramid(base, hostId);
}

export class AugmentedSphenocorona implements Polyhedron {
  private _faces = normalizeFaces(augmentedSphenocoronaFaces(), 1);

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
