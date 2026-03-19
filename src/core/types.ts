export type Vec3 = [number, number, number];

export type CellKey = string; // "f:r:c"

export interface CellId {
  faceId: number;
  row: number;
  col: number;
}

export function cellKey(faceId: number, row: number, col: number): CellKey {
  return `${faceId}:${row}:${col}`;
}

export function cellIdToKey(cell: CellId): CellKey {
  return `${cell.faceId}:${cell.row}:${cell.col}`;
}

export function parseCell(key: CellKey): CellId {
  const parts = key.split(':');
  return {
    faceId: Number(parts[0]),
    row: Number(parts[1]),
    col: Number(parts[2]),
  };
}

export interface Face {
  id: number;
  vertices: Vec3[];
  normal: Vec3;
}

export type EdgeVertices = [Vec3, Vec3];
