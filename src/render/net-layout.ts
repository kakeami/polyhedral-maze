/**
 * Net unfolding layouts for each Platonic solid.
 * Computes 2D vertex positions for unfolded face nets (used in PDF export).
 *
 * Stub — to be implemented in Phase 5.
 */

import type { Face } from '../core/types.ts';

export interface NetFace {
  faceId: number;
  vertices2d: [number, number][];
}

export interface NetLayout {
  faces: NetFace[];
  width: number;
  height: number;
}

export function computeNetLayout(
  _faces: Face[],
  _shape: string,
): NetLayout {
  // TODO: implement per-shape net unfolding
  return { faces: [], width: 0, height: 0 };
}
