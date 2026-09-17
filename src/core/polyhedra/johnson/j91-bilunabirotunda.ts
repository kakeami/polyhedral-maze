import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { convexHull } from './_convex_hull.ts';

/**
 * Bilunabirotunda (J91). 14 faces (8 triangles + 2 squares + 4 pentagons),
 * 14 vertices, 26 edges. D_2h symmetry.
 *
 * Vertex set assembled from three D_2h orbits (edge length √5 − 1, before
 * normalization), then the face structure is recovered by convex hull and
 * coplanar-face merging. Wikipedia gives vertex coordinates but not face
 * indices, so the hull approach avoids manual transcription.
 */
function bilunabirotundaFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const ip = 1 / phi;

  const verts: Vec3[] = [];
  for (const sz of [-1, 1]) {
    verts.push([0, 0, sz]);
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        verts.push([sx * ip, sy, sz * ip]);
      }
    }
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      verts.push([sx * phi, sy * ip, 0]);
    }
  }

  return convexHull(verts).map((f, id) => makeFace(id, f.vertices));
}

export class Bilunabirotunda extends Solid {
  protected readonly _faces = normalizeFaces(bilunabirotundaFaces(), 1);
}
