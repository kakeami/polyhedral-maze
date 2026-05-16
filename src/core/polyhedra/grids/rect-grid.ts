import type { Face, Vec3, CellKey } from '../../types.ts';
import { cellKey, parseCell } from '../../types.ts';
import { sub, lstsq2 } from '../../vec3.ts';
import type { FaceGrid, GridKind } from '../../face-grid.ts';
import { BOUNDARY_TOLERANCE } from '../../constants.ts';

export class RectGrid implements FaceGrid {
  readonly faceId: number;
  readonly n: number;
  readonly kind: GridKind = 'rect';
  private _origin: Vec3;
  private _u: Vec3;
  private _v: Vec3;

  constructor(face: Face, n: number) {
    this.faceId = face.id;
    this.n = n;
    const [v0, v1, , v3] = face.vertices;
    this._origin = v0!;
    this._u = sub(v1!, v0!);
    this._v = sub(v3!, v0!);
  }

  cells(): CellKey[] {
    const result: CellKey[] = [];
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        result.push(cellKey(this.faceId, r, c));
      }
    }
    return result;
  }

  internalEdges(): [CellKey, CellKey][] {
    const edges: [CellKey, CellKey][] = [];
    const fid = this.faceId;
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        if (c + 1 < this.n) {
          edges.push([cellKey(fid, r, c), cellKey(fid, r, c + 1)]);
        }
        if (r + 1 < this.n) {
          edges.push([cellKey(fid, r, c), cellKey(fid, r + 1, c)]);
        }
      }
    }
    return edges;
  }

  boundaryCells(edgeStart: Vec3, edgeEnd: Vec3): CellKey[] {
    const fid = this.faceId;
    const n = this.n;
    const s = this._toLocal(edgeStart);
    const e = this._toLocal(edgeEnd);
    const tol = BOUNDARY_TOLERANCE;

    let cells: CellKey[];

    if (Math.abs(s[1]) < tol && Math.abs(e[1]) < tol) {
      cells = Array.from({ length: n }, (_, c) => cellKey(fid, 0, c));
    } else if (Math.abs(s[1] - 1) < tol && Math.abs(e[1] - 1) < tol) {
      cells = Array.from({ length: n }, (_, c) => cellKey(fid, n - 1, c));
    } else if (Math.abs(s[0]) < tol && Math.abs(e[0]) < tol) {
      cells = Array.from({ length: n }, (_, r) => cellKey(fid, r, 0));
    } else if (Math.abs(s[0] - 1) < tol && Math.abs(e[0] - 1) < tol) {
      cells = Array.from({ length: n }, (_, r) => cellKey(fid, r, n - 1));
    } else {
      throw new Error(
        `Edge does not align with any boundary of face ${fid}`,
      );
    }

    if (this._shouldReverse(s, e, cells)) {
      cells.reverse();
    }

    return cells;
  }

  cellCenter2d(cell: CellKey): [number, number] {
    const { row, col } = parseCell(cell);
    const u = (col + 0.5) / this.n;
    const v = (row + 0.5) / this.n;
    return [u, v];
  }

  cellCenter3d(cell: CellKey): Vec3 {
    const [u, v] = this.cellCenter2d(cell);
    return [
      this._origin[0] + u * this._u[0] + v * this._v[0],
      this._origin[1] + u * this._u[1] + v * this._v[1],
      this._origin[2] + u * this._u[2] + v * this._v[2],
    ];
  }

  isInterior(cell: CellKey): boolean {
    const { row, col } = parseCell(cell);
    return row >= 1 && row <= this.n - 2 && col >= 1 && col <= this.n - 2;
  }

  private _toLocal(point: Vec3): [number, number] {
    // lstsq2 generalises to non-orthogonal u, v (needed for rhombic Catalan
    // faces). Reduces to per-axis projection when u ⊥ v.
    return lstsq2(this._u, this._v, sub(point, this._origin));
  }

  private _shouldReverse(
    s: [number, number],
    e: [number, number],
    cells: CellKey[],
  ): boolean {
    if (cells.length < 2) return false;
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const c0 = this.cellCenter2d(cells[0]!);
    const c1 = this.cellCenter2d(cells[1]!);
    const cdx = c1[0] - c0[0];
    const cdy = c1[1] - c0[1];
    return dx * cdx + dy * cdy < 0;
  }
}
