import type { Face, Vec3, CellKey } from '../../types.ts';
import { cellKey, parseCell } from '../../types.ts';
import { sub, cross, normalize, dot, mean, lstsq2 } from '../../vec3.ts';
import type { FaceGrid, GridKind } from '../../face-grid.ts';
import { BOUNDARY_TOLERANCE } from '../../constants.ts';

/**
 * DecGrid: 10-sector triangular grid for decagonal faces.
 *
 * Each decagon is divided into 10 sectors from the face center to consecutive
 * vertex pairs. Each sector uses a TriGrid-like layout with n rows and n²
 * cells. Total: 10n² cells per face.
 *
 * Note: at large n the central cells become very narrow wedges. Recommended
 * to keep n ≤ 3 for visual clarity.
 */
export class DecGrid implements FaceGrid {
  readonly faceId: number;
  readonly n: number;
  readonly kind: GridKind = 'dec';
  private _center: Vec3;
  readonly vertices: Vec3[];
  private _sectorU: Vec3[];
  private _sectorV: Vec3[];
  private _e1: Vec3;
  private _e2: Vec3;

  constructor(face: Face, n: number) {
    this.faceId = face.id;
    this.n = n;
    this.vertices = face.vertices;
    this._center = mean(face.vertices);

    this._sectorU = [];
    this._sectorV = [];
    for (let s = 0; s < 10; s++) {
      this._sectorU.push(sub(face.vertices[s]!, this._center));
      this._sectorV.push(sub(face.vertices[(s + 1) % 10]!, this._center));
    }

    const e1 = normalize(this._sectorU[0]!);
    const faceNormal = normalize(face.normal);
    this._e1 = e1;
    this._e2 = cross(faceNormal, e1);
  }

  cells(): CellKey[] {
    const result: CellKey[] = [];
    for (let s = 0; s < 10; s++) {
      const base = s * this.n;
      for (let r = 0; r < this.n; r++) {
        for (let c = 0; c < 2 * r + 1; c++) {
          result.push(cellKey(this.faceId, base + r, c));
        }
      }
    }
    return result;
  }

  internalEdges(): [CellKey, CellKey][] {
    const edges: [CellKey, CellKey][] = [];
    const fid = this.faceId;
    const n = this.n;

    for (let s = 0; s < 10; s++) {
      const base = s * n;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < 2 * r; c++) {
          edges.push([cellKey(fid, base + r, c), cellKey(fid, base + r, c + 1)]);
        }
        if (r < n - 1) {
          for (let k = 0; k <= r; k++) {
            edges.push([
              cellKey(fid, base + r, 2 * k),
              cellKey(fid, base + r + 1, 2 * k + 1),
            ]);
          }
        }
      }
    }

    for (let s = 0; s < 10; s++) {
      const nextS = (s + 1) % 10;
      for (let r = 0; r < n; r++) {
        edges.push([
          cellKey(fid, s * n + r, 2 * r),
          cellKey(fid, nextS * n + r, 0),
        ]);
      }
    }

    return edges;
  }

  boundaryCells(edgeStart: Vec3, edgeEnd: Vec3): CellKey[] {
    const fid = this.faceId;
    const n = this.n;
    const tol = BOUNDARY_TOLERANCE;

    for (let s = 0; s < 10; s++) {
      const u = this._sectorU[s]!;
      const v = this._sectorV[s]!;

      const ps = sub(edgeStart, this._center);
      const pe = sub(edgeEnd, this._center);
      const sLocal = lstsq2(u, v, ps);
      const eLocal = lstsq2(u, v, pe);

      if (
        Math.abs(sLocal[0] + sLocal[1] - 1) < tol &&
        Math.abs(eLocal[0] + eLocal[1] - 1) < tol
      ) {
        const base = s * n;
        const cells = Array.from({ length: n }, (_, k) =>
          cellKey(fid, base + n - 1, 2 * k),
        );

        if (sLocal[1] > eLocal[1]) {
          cells.reverse();
        }
        return cells;
      }
    }

    throw new Error(
      `Edge does not align with any boundary of face ${fid}`,
    );
  }

  cellCenter2d(cell: CellKey): [number, number] {
    const pos = this.cellCenter3d(cell);
    const delta = sub(pos, this._center);
    return [dot(delta, this._e1), dot(delta, this._e2)];
  }

  cellCenter3d(cell: CellKey): Vec3 {
    const { row, col } = parseCell(cell);
    const s = Math.floor(row / this.n);
    const r = row - s * this.n;
    const c = col;
    const k = Math.floor(c / 2);

    let a: number, b: number;
    if (c % 2 === 0) {
      a = (3 * (r - k) + 1) / (3 * this.n);
      b = (3 * k + 1) / (3 * this.n);
    } else {
      a = (3 * (r - k) - 1) / (3 * this.n);
      b = (3 * k + 2) / (3 * this.n);
    }

    const u = this._sectorU[s]!;
    const v = this._sectorV[s]!;
    return [
      this._center[0] + a * u[0] + b * v[0],
      this._center[1] + a * u[1] + b * v[1],
      this._center[2] + a * u[2] + b * v[2],
    ];
  }

  isInterior(cell: CellKey): boolean {
    const { row, col } = parseCell(cell);
    const r = row % this.n;
    return !(r === this.n - 1 && col % 2 === 0);
  }
}
