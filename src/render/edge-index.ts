/**
 * Edge index for a polyhedron's face set.
 *
 * Buckets every face edge by a quantised canonical key so that face-pair
 * adjacency queries become O(1). Used by maze-geometry, svg-net-renderer
 * (for `findAdjacentFace`) and by net-layout (for `adjacencies`, which
 * exposes the parent-child vertex index pairs needed for trilateration).
 *
 * Replaces the previous O(F²·V²) pairwise vertex scan with a single
 * O(F·V) pass.
 */

import type { Face, Vec3 } from '../core/types.ts';
import { VERTEX_EPSILON } from '../core/constants.ts';

const QUANTUM = Math.round(1 / VERTEX_EPSILON);

function vKey(v: Vec3): string {
  return `${Math.round(v[0] * QUANTUM)},${Math.round(v[1] * QUANTUM)},${Math.round(v[2] * QUANTUM)}`;
}

function edgeKeyFromVKeys(ka: string, kb: string): string {
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/**
 * A directed parent-to-child adjacency record produced by `adjacencies()`.
 * `parentIdx[k]` (vertex index in the parent face) and `childIdx[k]`
 * (vertex index in the child face) point at the same 3D vertex.
 */
export interface AdjEdge {
  neighborId: number;
  parentIdx: [number, number];
  childIdx: [number, number];
}

export interface EdgeIndex {
  /** Face id sharing the i-th edge of `faceId`, or null if no neighbor. */
  findAdjacentFace(faceId: number, edgeIdx: number): number | null;
  /** Full adjacency map keyed by face id, with vertex index pairs. */
  adjacencies(): ReadonlyMap<number, AdjEdge[]>;
}

interface FaceEdgeRef {
  faceId: number;
  edgeIdx: number;
  vIdx: [number, number];
  vKeys: [string, string];
}

export function buildEdgeIndex(faces: Face[]): EdgeIndex {
  const buckets = new Map<string, FaceEdgeRef[]>();
  for (const f of faces) {
    const vs = f.vertices;
    const nv = vs.length;
    for (let i = 0; i < nv; i++) {
      const a = vs[i]!;
      const b = vs[(i + 1) % nv]!;
      const ka = vKey(a);
      const kb = vKey(b);
      const key = edgeKeyFromVKeys(ka, kb);
      const ref: FaceEdgeRef = {
        faceId: f.id,
        edgeIdx: i,
        vIdx: [i, (i + 1) % nv],
        vKeys: [ka, kb],
      };
      let bucket = buckets.get(key);
      if (!bucket) { bucket = []; buckets.set(key, bucket); }
      bucket.push(ref);
    }
  }

  // adjacent[faceId][edgeIdx] = neighbor face id (or null)
  const adjacent = new Map<number, (number | null)[]>();
  const adjacencies = new Map<number, AdjEdge[]>();
  for (const f of faces) {
    adjacent.set(f.id, new Array(f.vertices.length).fill(null));
    adjacencies.set(f.id, []);
  }

  for (const bucket of buckets.values()) {
    if (bucket.length !== 2) continue; // boundary or degenerate
    const [e1, e2] = bucket as [FaceEdgeRef, FaceEdgeRef];

    adjacent.get(e1.faceId)![e1.edgeIdx] = e2.faceId;
    adjacent.get(e2.faceId)![e2.edgeIdx] = e1.faceId;

    // Match vertex indices: e1.vIdx[0] sits at the same 3D point as either
    // e2.vIdx[0] or e2.vIdx[1]. Choose by comparing quantised keys.
    const sameOrder = e1.vKeys[0] === e2.vKeys[0];
    const e2Matched: [number, number] = sameOrder
      ? [e2.vIdx[0], e2.vIdx[1]]
      : [e2.vIdx[1], e2.vIdx[0]];

    adjacencies.get(e1.faceId)!.push({
      neighborId: e2.faceId,
      parentIdx: [e1.vIdx[0], e1.vIdx[1]],
      childIdx: e2Matched,
    });
    adjacencies.get(e2.faceId)!.push({
      neighborId: e1.faceId,
      parentIdx: [e2.vIdx[0], e2.vIdx[1]],
      childIdx: sameOrder ? [e1.vIdx[0], e1.vIdx[1]] : [e1.vIdx[1], e1.vIdx[0]],
    });
  }

  // Preserve the prior `buildFaceAdjacency` traversal order (ascending by
  // neighbor id) so net-layout's BFS unfolding produces an identical net.
  for (const list of adjacencies.values()) {
    list.sort((a, b) => a.neighborId - b.neighborId);
  }

  return {
    findAdjacentFace(faceId, edgeIdx) {
      return adjacent.get(faceId)?.[edgeIdx] ?? null;
    },
    adjacencies() {
      return adjacencies;
    },
  };
}
