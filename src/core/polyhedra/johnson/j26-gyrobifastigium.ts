import type { Face, FaceEdgeData, Vec3 } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyrobifastigium (J26). Two unit-edge triangular prisms joined on one of
 * their square faces with a 90° twist. 8 faces (4 triangles + 4 squares),
 * 8 vertices, 14 edges.
 *
 * The shared square sits in the plane z = 0; the lower prism's ridge runs
 * along the y-axis at z = −√3/2, the upper prism's ridge along the x-axis at
 * z = +√3/2.
 */
function gyrobifastigiumFaces(): Face[] {
  const h = Math.sqrt(3) / 2;

  // Shared square corners
  const p_mm: Vec3 = [-0.5, -0.5, 0];
  const p_pm: Vec3 = [ 0.5, -0.5, 0];
  const p_pp: Vec3 = [ 0.5,  0.5, 0];
  const p_mp: Vec3 = [-0.5,  0.5, 0];

  // Lower prism ridge endpoints (along y-axis, below the square)
  const lo_n: Vec3 = [0, -0.5, -h];
  const lo_p: Vec3 = [0,  0.5, -h];

  // Upper prism ridge endpoints (along x-axis, above the square)
  const up_n: Vec3 = [-0.5, 0, h];
  const up_p: Vec3 = [ 0.5, 0, h];

  const faces: Face[] = [];
  const id = { value: 0 };

  // Lower prism: 2 triangles + 2 slope squares (floor is internal).
  faces.push(makeFace(id.value++, [p_mm, p_pm, lo_n]));            // y = -1/2 triangle
  faces.push(makeFace(id.value++, [p_mp, p_pp, lo_p]));            // y = +1/2 triangle
  faces.push(makeFace(id.value++, [p_mm, lo_n, lo_p, p_mp]));      // slope at x = -1/2 side
  faces.push(makeFace(id.value++, [p_pm, lo_n, lo_p, p_pp]));      // slope at x = +1/2 side

  // Upper prism: 2 triangles + 2 slope squares (rotated 90° relative to lower).
  faces.push(makeFace(id.value++, [p_mm, p_mp, up_n]));            // x = -1/2 triangle
  faces.push(makeFace(id.value++, [p_pm, p_pp, up_p]));            // x = +1/2 triangle
  faces.push(makeFace(id.value++, [p_mm, up_n, up_p, p_pm]));      // slope at y = -1/2 side
  faces.push(makeFace(id.value++, [p_mp, up_n, up_p, p_pp]));      // slope at y = +1/2 side

  return faces;
}

export class Gyrobifastigium implements Polyhedron {
  private _faces = normalizeFaces(gyrobifastigiumFaces(), 1);

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
