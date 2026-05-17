import type { Face, Vec3, EdgeVertices, FaceEdgeData } from './types.ts';
import type { FaceGrid } from './face-grid.ts';
import { Graph } from './graph.ts';
import { allClose, norm } from './vec3.ts';
import { OPPOSITE_FACE_EPSILON } from './constants.ts';

export interface Polyhedron {
  faces(): Face[];
  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData>;
  gridForFace(face: Face, n: number): FaceGrid;
}

export function sharedEdgeVertices(
  f1: Face,
  f2: Face,
  atol = 1e-9,
): EdgeVertices | null {
  const shared: Vec3[] = [];
  for (const v1 of f1.vertices) {
    for (const v2 of f2.vertices) {
      if (allClose(v1, v2, atol)) {
        shared.push(v1);
        break;
      }
    }
  }
  if (shared.length === 2) {
    return [shared[0]!, shared[1]!];
  }
  return null;
}

export function oppositeFace(
  faces: Face[],
  faceId: number,
): number | null {
  const target = faces.find((f) => f.id === faceId);
  if (!target) return null;
  for (const f of faces) {
    if (f.id !== faceId) {
      const d =
        target.normal[0] * f.normal[0] +
        target.normal[1] * f.normal[1] +
        target.normal[2] * f.normal[2];
      if (d < -1 + OPPOSITE_FACE_EPSILON) {
        return f.id;
      }
    }
  }
  return null;
}

/**
 * Uniformly scale faces so that the maximum vertex distance from the origin
 * (the circumradius) equals `targetR`. Face normals are preserved.
 *
 * Used to give every polyhedron a consistent visual size in the renderer
 * regardless of the canonical-coordinate convention chosen for its vertices.
 */
export function normalizeFaces(faces: Face[], targetR = 1): Face[] {
  let maxR = 0;
  for (const f of faces) {
    for (const v of f.vertices) {
      const r = norm(v);
      if (r > maxR) maxR = r;
    }
  }
  if (maxR === 0) return faces;
  const s = targetR / maxR;
  return faces.map((f) => ({
    id: f.id,
    vertices: f.vertices.map((v) => [v[0] * s, v[1] * s, v[2] * s] as Vec3),
    normal: f.normal,
  }));
}

export function buildFaceAdjacency(
  faces: Face[],
  sharedFn: (f1: Face, f2: Face) => EdgeVertices | null,
): Graph<string, Record<string, unknown>, FaceEdgeData> {
  const g = new Graph<string, Record<string, unknown>, FaceEdgeData>();
  for (const f of faces) {
    g.addNode(String(f.id));
  }
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const shared = sharedFn(faces[i]!, faces[j]!);
      if (shared) {
        g.addEdge(String(faces[i]!.id), String(faces[j]!.id), {
          edgeVertices: shared,
        });
      }
    }
  }
  return g;
}
