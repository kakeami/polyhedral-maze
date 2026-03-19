import type { Face, Vec3, EdgeVertices } from './types.ts';
import type { FaceGrid } from './face-grid.ts';
import { Graph } from './graph.ts';
import { allClose } from './vec3.ts';

export interface Polyhedron {
  faces(): Face[];
  faceAdjacency(): Graph<string>;
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
      if (d < -1 + 1e-6) {
        return f.id;
      }
    }
  }
  return null;
}

export function buildFaceAdjacency(
  faces: Face[],
  sharedFn: (f1: Face, f2: Face) => EdgeVertices | null,
): Graph<string> {
  const g = new Graph<string>();
  for (const f of faces) {
    g.addNode(String(f.id));
  }
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const shared = sharedFn(faces[i]!, faces[j]!);
      if (shared) {
        g.addEdge(String(faces[i]!.id), String(faces[j]!.id), {
          edge_vertices: shared,
        });
      }
    }
  }
  return g;
}
