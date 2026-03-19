import type { Face, Vec3, CellKey } from '../types.ts';
import { cellKey, parseCell } from '../types.ts';
import { sub, lstsq2 } from '../vec3.ts';
import type { FaceGrid } from '../face-grid.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../polyhedron.ts';
import { Graph } from '../graph.ts';

export class TriGrid implements FaceGrid {
  readonly faceId: number;
  readonly n: number;
  private _origin: Vec3;
  private _u: Vec3;
  private _v: Vec3;

  constructor(face: Face, n: number) {
    this.faceId = face.id;
    this.n = n;
    const [v0, v1, v2] = face.vertices;
    this._origin = v0!;
    this._u = sub(v1!, v0!);
    this._v = sub(v2!, v0!);
  }

  cells(): CellKey[] {
    const result: CellKey[] = [];
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < 2 * r + 1; c++) {
        result.push(cellKey(this.faceId, r, c));
      }
    }
    return result;
  }

  internalEdges(): [CellKey, CellKey][] {
    const edges: [CellKey, CellKey][] = [];
    const fid = this.faceId;
    const n = this.n;

    for (let r = 0; r < n; r++) {
      // Within-row: consecutive cells share an edge
      for (let c = 0; c < 2 * r; c++) {
        edges.push([cellKey(fid, r, c), cellKey(fid, r, c + 1)]);
      }
      // Between-row: upward triangle (r, 2k) → downward triangle (r+1, 2k+1)
      if (r < n - 1) {
        for (let k = 0; k <= r; k++) {
          edges.push([cellKey(fid, r, 2 * k), cellKey(fid, r + 1, 2 * k + 1)]);
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
    const tol = 0.1;

    let cells: CellKey[];

    if (Math.abs(s[1]) < tol && Math.abs(e[1]) < tol) {
      // b ≈ 0 → edge v0–v1 (left edge)
      cells = Array.from({ length: n }, (_, r) => cellKey(fid, r, 0));
      if (s[0] > e[0]) cells.reverse();
    } else if (Math.abs(s[0]) < tol && Math.abs(e[0]) < tol) {
      // a ≈ 0 → edge v0–v2 (right edge)
      cells = Array.from({ length: n }, (_, r) => cellKey(fid, r, 2 * r));
      if (s[1] > e[1]) cells.reverse();
    } else if (
      Math.abs(s[0] + s[1] - 1) < tol &&
      Math.abs(e[0] + e[1] - 1) < tol
    ) {
      // a+b ≈ 1 → edge v1–v2 (bottom edge)
      cells = Array.from({ length: n }, (_, k) =>
        cellKey(fid, n - 1, 2 * k),
      );
      if (s[1] > e[1]) cells.reverse();
    } else {
      throw new Error(
        `Edge does not align with any boundary of face ${fid}`,
      );
    }

    return cells;
  }

  cellCenter2d(cell: CellKey): [number, number] {
    const { row: r, col: c } = parseCell(cell);
    const k = Math.floor(c / 2);
    let a: number, b: number;
    if (c % 2 === 0) {
      // upward triangle
      a = (3 * (r - k) + 1) / (3 * this.n);
      b = (3 * k + 1) / (3 * this.n);
    } else {
      // downward triangle
      a = (3 * (r - k) - 1) / (3 * this.n);
      b = (3 * k + 2) / (3 * this.n);
    }
    return [a, b];
  }

  cellCenter3d(cell: CellKey): Vec3 {
    const [a, b] = this.cellCenter2d(cell);
    return [
      this._origin[0] + a * this._u[0] + b * this._v[0],
      this._origin[1] + a * this._u[1] + b * this._v[1],
      this._origin[2] + a * this._u[2] + b * this._v[2],
    ];
  }

  isInterior(cell: CellKey): boolean {
    const { row: r, col: c } = parseCell(cell);
    const n = this.n;
    if (c === 0 || c === 2 * r) return false;
    if (r === n - 1 && c % 2 === 0) return false;
    return true;
  }

  private _toLocal(point: Vec3): [number, number] {
    const p = sub(point, this._origin);
    return lstsq2(this._u, this._v, p);
  }
}

function makeOctahedronFaces(): Face[] {
  const px: Vec3 = [1, 0, 0];
  const mx: Vec3 = [-1, 0, 0];
  const py: Vec3 = [0, 1, 0];
  const my: Vec3 = [0, -1, 0];
  const pz: Vec3 = [0, 0, 1];
  const mz: Vec3 = [0, 0, -1];

  const s = 1 / Math.sqrt(3);

  return [
    { id: 0, vertices: [px, py, pz], normal: [s, s, s] },
    { id: 1, vertices: [px, pz, my], normal: [s, -s, s] },
    { id: 2, vertices: [px, my, mz], normal: [s, -s, -s] },
    { id: 3, vertices: [px, mz, py], normal: [s, s, -s] },
    { id: 4, vertices: [mx, pz, py], normal: [-s, s, s] },
    { id: 5, vertices: [mx, my, pz], normal: [-s, -s, s] },
    { id: 6, vertices: [mx, mz, my], normal: [-s, -s, -s] },
    { id: 7, vertices: [mx, py, mz], normal: [-s, s, -s] },
  ];
}

export class Octahedron implements Polyhedron {
  private _faces = makeOctahedronFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new TriGrid(face, n);
  }
}
