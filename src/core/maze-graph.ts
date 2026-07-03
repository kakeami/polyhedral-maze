import type { CellKey, Face, Vec3, EdgeVertices, MazeNodeData, MazeEdgeData } from './types.ts';
import { parseCell } from './types.ts';
import { dot, sub, add, cross, norm, scale } from './vec3.ts';
import { Graph } from './graph.ts';
import type { FaceGrid } from './face-grid.ts';
import type { Polyhedron } from './polyhedron.ts';
import { oppositeFace } from './polyhedron.ts';

export class MazeGraph {
  readonly polyhedron: Polyhedron;
  readonly n: number;
  readonly k: number;

  graph = new Graph<CellKey, MazeNodeData, MazeEdgeData>();
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
        this.graph.addNode(cell, { faceId: fid });
      }
      for (const [c1, c2] of grid.internalEdges()) {
        this.graph.addEdge(c1, c2, { interFace: false });
      }
    }

    // Layer 3: inter-face edges (at most k per shared edge)
    for (const [fiIdStr, fjIdStr, data] of adj.edgesWithData()) {
      const edgeVerts = data.edgeVertices;
      const fiId = Number(fiIdStr);
      const fjId = Number(fjIdStr);
      const fiFace = faces.find((f) => f.id === fiId)!;
      const fjFace = faces.find((f) => f.id === fjId)!;

      const pairs = this._boundaryMapping(fiFace, fjFace, edgeVerts);
      const selected = MazeGraph.selectK(pairs, this.k);

      for (const [c1, c2] of selected) {
        this.graph.addEdge(c1, c2, {
          interFace: true,
          edgeVertices: edgeVerts,
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
    // Warp availability is unchanged: only shapes whose face has an
    // antiparallel partner participate (the tetrahedron never warps).
    if (oppositeFace(faces, parsed.faceId) === null) return null;

    const face = faces.find((f) => f.id === parsed.faceId)!;
    const grid = this.grids.get(parsed.faceId)!;
    const origin = grid.cellCenter3d(cell);
    const dir = scale(face.normal, -1);

    // The warp is a physical skewer: cast a ray straight into the solid and
    // surface at the FIRST face it reaches. On a toroidal solid this is the
    // near tunnel wall — not the far side across the hole, which a straw
    // could never thread.
    let exitFace: Face | null = null;
    let exitPoint: Vec3 | null = null;
    let bestT = Infinity;
    for (const f of faces) {
      if (f.id === parsed.faceId) continue;
      const denom = dot(dir, f.normal);
      if (Math.abs(denom) < 1e-12) continue;
      const t = dot(sub(f.vertices[0]!, origin), f.normal) / denom;
      if (t <= RAY_EPSILON || t >= bestT) continue;
      const p = add(origin, scale(dir, t));
      if (pointInConvexFace(p, f)) {
        bestT = t;
        exitFace = f;
        exitPoint = p;
      }
    }
    if (exitFace === null || exitPoint === null) return null;

    const oppGrid = this.grids.get(exitFace.id)!;
    let bestCell: CellKey | null = null;
    let bestDist = Infinity;
    for (const c of oppGrid.cells()) {
      const dist = norm(sub(oppGrid.cellCenter3d(c), exitPoint));
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = c;
      }
    }
    return bestCell;
  }
}

const RAY_EPSILON = 1e-9;

/** True if a point on the face's plane lies inside the (convex) face polygon. */
function pointInConvexFace(p: Vec3, face: Face): boolean {
  const vs = face.vertices;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i]!;
    const b = vs[(i + 1) % vs.length]!;
    if (dot(cross(sub(b, a), sub(p, a)), face.normal) < -RAY_EPSILON) return false;
  }
  return true;
}
