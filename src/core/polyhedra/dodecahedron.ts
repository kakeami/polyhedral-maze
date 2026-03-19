import type { Face, Vec3, CellKey } from '../types.ts';
import { cellKey, parseCell } from '../types.ts';
import { sub, cross, normalize, dot, mean, scale, lstsq2 } from '../vec3.ts';
import type { FaceGrid } from '../face-grid.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../polyhedron.ts';
import { Graph } from '../graph.ts';

/**
 * PentGrid: 5-sector triangular grid for pentagonal faces.
 *
 * Each pentagon is divided into 5 sectors from the face center to
 * consecutive vertex pairs. Each sector uses a TriGrid-like layout
 * with n rows and n² cells. Total: 5n² cells per face.
 *
 * Cell addressing: row = sector * n + localRow, col = localCol.
 */
export class PentGrid implements FaceGrid {
  readonly faceId: number;
  readonly n: number;
  private _center: Vec3;
  readonly vertices: Vec3[];
  private _sectorU: Vec3[]; // Per-sector u vector (vertex[s] - center)
  private _sectorV: Vec3[]; // Per-sector v vector (vertex[(s+1)%5] - center)
  private _e1: Vec3;        // 2D basis vector 1 (for cellCenter2d)
  private _e2: Vec3;        // 2D basis vector 2

  constructor(face: Face, n: number) {
    this.faceId = face.id;
    this.n = n;
    this.vertices = face.vertices;
    this._center = mean(face.vertices);

    this._sectorU = [];
    this._sectorV = [];
    for (let s = 0; s < 5; s++) {
      this._sectorU.push(sub(face.vertices[s]!, this._center));
      this._sectorV.push(sub(face.vertices[(s + 1) % 5]!, this._center));
    }

    // 2D basis for cellCenter2d projection
    const e1 = normalize(this._sectorU[0]!);
    const faceNormal = normalize(face.normal);
    this._e1 = e1;
    this._e2 = cross(faceNormal, e1);
  }

  cells(): CellKey[] {
    const result: CellKey[] = [];
    for (let s = 0; s < 5; s++) {
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

    // Within-sector edges (TriGrid pattern per sector)
    for (let s = 0; s < 5; s++) {
      const base = s * n;
      for (let r = 0; r < n; r++) {
        // Within-row: consecutive cells
        for (let c = 0; c < 2 * r; c++) {
          edges.push([cellKey(fid, base + r, c), cellKey(fid, base + r, c + 1)]);
        }
        // Between-row: upward (r, 2k) → downward (r+1, 2k+1)
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

    // Cross-sector edges: right edge of sector s ↔ left edge of sector (s+1)%5
    for (let s = 0; s < 5; s++) {
      const nextS = (s + 1) % 5;
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
    const tol = 0.1;

    // Find which sector's bottom edge matches the given 3D edge
    for (let s = 0; s < 5; s++) {
      const u = this._sectorU[s]!;
      const v = this._sectorV[s]!;

      const ps = sub(edgeStart, this._center);
      const pe = sub(edgeEnd, this._center);
      const sLocal = lstsq2(u, v, ps);
      const eLocal = lstsq2(u, v, pe);

      // Bottom edge of sector s: a + b ≈ 1
      if (
        Math.abs(sLocal[0] + sLocal[1] - 1) < tol &&
        Math.abs(eLocal[0] + eLocal[1] - 1) < tol
      ) {
        const base = s * n;
        const cells = Array.from({ length: n }, (_, k) =>
          cellKey(fid, base + n - 1, 2 * k),
        );

        // Order: increasing b goes from vertex[s] to vertex[(s+1)%5]
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
      // upward triangle
      a = (3 * (r - k) + 1) / (3 * this.n);
      b = (3 * k + 1) / (3 * this.n);
    } else {
      // downward triangle
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
    // Boundary: bottom edge of any sector (last row, upward triangles)
    return !(r === this.n - 1 && col % 2 === 0);
  }
}

function makeDodecahedronFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const ip = 1 / phi;

  const V: Vec3[] = [
    // Cube vertices (±1, ±1, ±1)
    [1, 1, 1],      // 0
    [1, 1, -1],     // 1
    [1, -1, 1],     // 2
    [1, -1, -1],    // 3
    [-1, 1, 1],     // 4
    [-1, 1, -1],    // 5
    [-1, -1, 1],    // 6
    [-1, -1, -1],   // 7
    // (0, ±1/φ, ±φ)
    [0, ip, phi],   // 8
    [0, -ip, phi],  // 9
    [0, ip, -phi],  // 10
    [0, -ip, -phi], // 11
    // (±1/φ, ±φ, 0)
    [ip, phi, 0],   // 12
    [-ip, phi, 0],  // 13
    [ip, -phi, 0],  // 14
    [-ip, -phi, 0], // 15
    // (±φ, 0, ±1/φ)
    [phi, 0, ip],   // 16
    [-phi, 0, ip],  // 17
    [phi, 0, -ip],  // 18
    [-phi, 0, -ip], // 19
  ];

  // 12 pentagonal faces (vertex indices)
  const faceIndices: number[][] = [
    [0, 8, 4, 13, 12],
    [0, 12, 1, 18, 16],
    [0, 16, 2, 9, 8],
    [16, 18, 3, 14, 2],
    [9, 2, 14, 15, 6],
    [14, 3, 11, 7, 15],
    [18, 1, 10, 11, 3],
    [8, 9, 6, 17, 4],
    [4, 17, 19, 5, 13],
    [13, 5, 10, 1, 12],
    [10, 5, 19, 7, 11],
    [17, 6, 15, 7, 19],
  ];

  return faceIndices.map((indices, id) => {
    const verts = indices.map((i) => V[i]!);
    const u = sub(verts[1]!, verts[0]!);
    const w = sub(verts[2]!, verts[0]!);
    let faceNormal = normalize(cross(u, w));
    const center = mean(verts);

    // Ensure normal points outward
    if (dot(faceNormal, center) < 0) {
      verts.reverse();
      faceNormal = scale(faceNormal, -1);
    }

    return { id, vertices: verts, normal: faceNormal };
  });
}

export class Dodecahedron implements Polyhedron {
  private _faces = makeDodecahedronFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new PentGrid(face, n);
  }
}
