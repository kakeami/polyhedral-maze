import type { CellKey, Vec3, EdgeVertices } from './types.ts';
import { parseCell } from './types.ts';
import { dot, sub, norm, mean } from './vec3.ts';
import { Graph } from './graph.ts';
import type { FaceGrid } from './face-grid.ts';
import type { Polyhedron } from './polyhedron.ts';
import { oppositeFace } from './polyhedron.ts';

export class MazeGraph {
  readonly polyhedron: Polyhedron;
  readonly n: number;
  readonly k: number;

  graph = new Graph<CellKey>();
  interFaceEdges = new Set<string>(); // "u|v" keys for inter-face edges
  grids = new Map<number, FaceGrid>();

  constructor(polyhedron: Polyhedron, n = 6, k = 2) {
    this.polyhedron = polyhedron;
    this.n = n;
    this.k = k;
  }

  build(): void {
    this.graph.clear();
    this.interFaceEdges.clear();
    this.grids.clear();

    const faces = this.polyhedron.faces();
    const adj = this.polyhedron.faceAdjacency();

    // Layer 2: per-face grids → nodes + internal edges
    for (const face of faces) {
      const grid = this.polyhedron.gridForFace(face, this.n);
      this.grids.set(face.id, grid);
      for (const cell of grid.cells()) {
        const fid = parseCell(cell).faceId;
        this.graph.addNode(cell, { face_id: fid });
      }
      for (const [c1, c2] of grid.internalEdges()) {
        this.graph.addEdge(c1, c2, { inter_face: false });
      }
    }

    // Layer 3: inter-face edges (at most k per shared edge)
    for (const [fiIdStr, fjIdStr, data] of adj.edgesWithData()) {
      const edgeVerts = data['edge_vertices'] as EdgeVertices;
      const fiId = Number(fiIdStr);
      const fjId = Number(fjIdStr);
      const fiFace = faces.find((f) => f.id === fiId)!;
      const fjFace = faces.find((f) => f.id === fjId)!;

      const pairs = this._boundaryMapping(fiFace, fjFace, edgeVerts);
      const selected = MazeGraph.selectK(pairs, this.k);

      for (const [c1, c2] of selected) {
        this.graph.addEdge(c1, c2, {
          inter_face: true,
          edge_vertices: edgeVerts,
        });
        const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`;
        this.interFaceEdges.add(key);
      }
    }
  }

  private _boundaryMapping(
    f1: { id: number },
    f2: { id: number },
    edgeVertices: EdgeVertices,
  ): [CellKey, CellKey][] {
    const [vStart, vEnd] = edgeVertices;
    const g1 = this.grids.get(f1.id)!;
    const g2 = this.grids.get(f2.id)!;

    const cells1 = g1.boundaryCells(vStart, vEnd);
    const cells2 = g2.boundaryCells(vStart, vEnd);

    if (cells1.length !== cells2.length) {
      throw new Error(
        `Boundary length mismatch: face ${f1.id} has ${cells1.length}, face ${f2.id} has ${cells2.length}`,
      );
    }

    return cells1.map((c1, i) => [c1, cells2[i]!]);
  }

  static selectK(
    pairs: [CellKey, CellKey][],
    k: number,
  ): [CellKey, CellKey][] {
    const n = pairs.length;
    if (n === 0 || k === 0) return [];
    if (k >= n) return pairs;
    if (k === 1) return [pairs[Math.floor(n / 2)]!];
    const indices = Array.from({ length: k }, (_, i) =>
      Math.round((i * (n - 1)) / (k - 1)),
    );
    return indices.map((i) => pairs[i]!);
  }

  totalCells(): number {
    return this.graph.nodeCount();
  }

  totalEdges(): number {
    return this.graph.edgeCount();
  }

  interFaceEdgeCount(): number {
    return this.interFaceEdges.size;
  }

  oppositeCell(cell: CellKey): CellKey | null {
    const parsed = parseCell(cell);
    const faces = this.polyhedron.faces();
    const oppFid = oppositeFace(faces, parsed.faceId);
    if (oppFid === null) return null;

    const grid = this.grids.get(parsed.faceId)!;
    const pos = grid.cellCenter3d(cell);
    const face = faces.find((f) => f.id === parsed.faceId)!;
    const center = this._polyhedronCenter();

    // Project perpendicular to the face along normal
    const diff = sub(pos, center);
    const d = dot(diff, face.normal);
    const projected: Vec3 = [
      pos[0] - 2 * d * face.normal[0],
      pos[1] - 2 * d * face.normal[1],
      pos[2] - 2 * d * face.normal[2],
    ];

    const oppGrid = this.grids.get(oppFid)!;
    let bestCell: CellKey | null = null;
    let bestDist = Infinity;
    for (const c of oppGrid.cells()) {
      const cPos = oppGrid.cellCenter3d(c);
      const dist = norm(sub(cPos, projected));
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = c;
      }
    }
    return bestCell;
  }

  private _polyhedronCenter(): Vec3 {
    const seen = new Set<string>();
    const unique: Vec3[] = [];
    for (const face of this.polyhedron.faces()) {
      for (const v of face.vertices) {
        const key = v.map((x) => x.toFixed(10)).join(',');
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(v);
        }
      }
    }
    return mean(unique);
  }
}
