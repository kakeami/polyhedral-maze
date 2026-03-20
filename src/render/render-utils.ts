/**
 * Shared rendering utilities used by both texture-painter and svg-net-renderer.
 */

import type { CellKey, Face, Vec3 } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import { allClose } from '../core/vec3.ts';
import { VERTEX_EPSILON } from '../core/constants.ts';

/**
 * Find the adjacent face that shares the given edge (two vertices) with the current face.
 */
export function findAdjacentFaceId(
  faces: Face[],
  currentFaceId: number,
  edgeStart: Vec3,
  edgeEnd: Vec3,
): number | null {
  for (const f of faces) {
    if (f.id === currentFaceId) continue;
    let hasStart = false;
    let hasEnd = false;
    for (const v of f.vertices) {
      if (allClose(v, edgeStart, VERTEX_EPSILON)) hasStart = true;
      if (allClose(v, edgeEnd, VERTEX_EPSILON)) hasEnd = true;
    }
    if (hasStart && hasEnd) return f.id;
  }
  return null;
}

/**
 * Check if a cell has a tree edge to a cell on the specified target face.
 */
export function hasTreeEdgeToFace(
  cell: CellKey,
  tree: { neighbors(node: CellKey): CellKey[] },
  targetFaceId: number,
): boolean {
  for (const neighbor of tree.neighbors(cell)) {
    if (parseCell(neighbor).faceId === targetFaceId) return true;
  }
  return false;
}
