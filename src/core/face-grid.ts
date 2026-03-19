import type { CellKey, Vec3 } from './types.ts';

export interface FaceGrid {
  readonly faceId: number;
  readonly n: number;
  cells(): CellKey[];
  internalEdges(): [CellKey, CellKey][];
  boundaryCells(edgeStart: Vec3, edgeEnd: Vec3): CellKey[];
  cellCenter2d(cell: CellKey): [number, number];
  cellCenter3d(cell: CellKey): Vec3;
  isInterior(cell: CellKey): boolean;
}
