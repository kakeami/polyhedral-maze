import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { ICOSA_VERTEX } from './_diminish.ts';
import { tridiminishedFaces } from './j63-tridiminished-icosahedron.ts';
import { augmentWithPyramid } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

const VERTEX_TOL = 1e-9;

function approxEqual(a: Vec3, b: Vec3): boolean {
  return (
    Math.abs(a[0] - b[0]) < VERTEX_TOL &&
    Math.abs(a[1] - b[1]) < VERTEX_TOL &&
    Math.abs(a[2] - b[2]) < VERTEX_TOL
  );
}

function findTriangleByVertices(faces: Face[], targets: Vec3[]): number {
  for (const f of faces) {
    if (f.vertices.length !== 3) continue;
    const ok = targets.every((t) =>
      f.vertices.some((v) => approxEqual(v, t)),
    );
    if (ok) return f.id;
  }
  throw new Error('augmented-tridiminished-icosahedron: target triangle not found');
}

/**
 * Augmented Tridiminished Icosahedron (J64). J63 with a tetrahedral cap
 * (triangular pyramid) added to its "central" triangle — the unique remaining
 * triangle that shares an edge with each of the three pentagonal cavities.
 * In the canonical (v0, v2, v7) tridiminish, that triangle's vertices are
 * v5, v11, v9. 10 faces: 7 △ + 3 ⬠.
 */
function build(): Face[] {
  const tridim = tridiminishedFaces();
  const targetId = findTriangleByVertices(tridim, [
    ICOSA_VERTEX.v5!,
    ICOSA_VERTEX.v11!,
    ICOSA_VERTEX.v9!,
  ]);
  return augmentWithPyramid(tridim, targetId);
}

export class AugmentedTridiminishedIcosahedron implements Polyhedron {
  private _faces = normalizeFaces(build(), 1);

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
