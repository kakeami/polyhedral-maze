import type { Face, FaceEdgeData } from '../types.ts';
import type { FaceGrid } from '../face-grid.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { buildFaceAdjacency, sharedEdgeVertices } from '../polyhedron.ts';
import type { Graph } from '../graph.ts';
import { gridForPolygonFace } from './grids/dispatch.ts';

/**
 * A catalogued solid: its faces, and nothing else it has to say.
 *
 * All 144 of them answered `faces()` and `faceAdjacency()` with the same eight
 * lines, because there is only one answer. Faces come out copied, so a caller
 * cannot reach in and move the solid; adjacency is worked out from the faces
 * themselves — two faces are neighbours when they share two vertices — so it
 * cannot disagree with them.
 *
 * `gridForFace` has a default too, and the same reason: the number of sides
 * decides the grid (`grids/dispatch.ts`), so a solid only overrides it where
 * the count is not enough. That is the seven whose quadrilaterals are kites
 * rather than rectangles, and nothing else in the catalogue.
 *
 * What is left for a subclass is the one thing that makes it that solid: the
 * faces, assigned to `_faces` and normalised to a circumradius of 1 so that
 * every solid arrives at the camera the same size.
 */
export abstract class Solid implements Polyhedron {
  protected abstract readonly _faces: Face[];

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
