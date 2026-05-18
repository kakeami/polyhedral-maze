/**
 * Shared rendering utilities used by both maze-geometry and svg-net-renderer.
 */

import type { CellKey } from '../core/types.ts';
import { parseCell } from '../core/types.ts';

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
