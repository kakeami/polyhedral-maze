import type { Vec3, CellKey, Face } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import { add, sub, scale, mean, allClose } from '../core/vec3.ts';
import { VERTEX_EPSILON } from '../core/constants.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import { bfsShortestPath } from '../core/graph.ts';
import { findAdjacentFaceId, hasTreeEdgeToFace } from './render-utils.ts';

/**
 * Compute 3D vertices of a cell polygon based on the face geometry.
 */
export function cellVertices3d(face: Face, cell: CellKey, n: number): Vec3[] {
  const { row, col } = parseCell(cell);
  const nv = face.vertices.length;

  if (nv === 4) {
    // RectGrid
    const o = face.vertices[0]!;
    const u = sub(face.vertices[1]!, o);
    const v = sub(face.vertices[3]!, o);
    const r = row, c = col;
    return [
      add(o, add(scale(u, c / n), scale(v, r / n))),
      add(o, add(scale(u, (c + 1) / n), scale(v, r / n))),
      add(o, add(scale(u, (c + 1) / n), scale(v, (r + 1) / n))),
      add(o, add(scale(u, c / n), scale(v, (r + 1) / n))),
    ];
  }

  if (nv === 3) {
    // TriGrid
    const o = face.vertices[0]!;
    const u = sub(face.vertices[1]!, o);
    const v = sub(face.vertices[2]!, o);
    return triCellVerts(o, u, v, row, col, n);
  }

  if (nv === 5) {
    // PentGrid
    const center = mean(face.vertices);
    const sector = Math.floor(row / n);
    const localRow = row - sector * n;
    const su = sub(face.vertices[sector]!, center);
    const sv = sub(face.vertices[(sector + 1) % 5]!, center);
    return triCellVerts(center, su, sv, localRow, col, n);
  }

  throw new Error(`Unsupported face vertex count: ${nv}`);
}

function triCellVerts(
  origin: Vec3, u: Vec3, v: Vec3,
  r: number, c: number, n: number,
): Vec3[] {
  const k = Math.floor(c / 2);
  const vtx = (a: number, b: number): Vec3 =>
    add(origin, add(scale(u, a / n), scale(v, b / n)));

  if (c % 2 === 0) {
    return [vtx(r - k, k), vtx(r - k + 1, k), vtx(r - k, k + 1)];
  } else {
    return [vtx(r - k, k), vtx(r - k, k + 1), vtx(r - k - 1, k + 1)];
  }
}

/**
 * Find the shared edge (2 vertices) between two adjacent cells.
 */
function sharedEdge(v1: Vec3[], v2: Vec3[]): [Vec3, Vec3] | null {
  const shared: Vec3[] = [];
  for (const a of v1) {
    for (const b of v2) {
      if (allClose(a, b, VERTEX_EPSILON)) {
        shared.push(a);
        break;
      }
    }
  }
  return shared.length === 2 ? [shared[0]!, shared[1]!] : null;
}

export interface MazeRenderData {
  walls: Vec3[];       // pairs of Vec3 (p1, p2, p1, p2, ...)
  outline: Vec3[];     // face boundary wall segments (with gaps at passages)
  portals: Vec3[];     // midpoints of inter-face passage gaps
  solution: Vec3[];    // solution path cell centers (with boundary midpoints)
  startPos: Vec3;
  goalPos: Vec3;
  warpA: Vec3 | null;
  warpB: Vec3 | null;
}

/**
 * Compute all 3D wall segments, face outlines, and markers for rendering.
 */
export function computeRenderData(
  mazeGraph: MazeGraph,
  maze: Maze,
  showSolution: boolean,
): MazeRenderData {
  const treeEdgeSet = new Set<string>();
  for (const [a, b] of maze.tree.edges()) {
    treeEdgeSet.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }

  const faces = mazeGraph.polyhedron.faces();
  const n = mazeGraph.n;
  const walls: Vec3[] = [];
  const outline: Vec3[] = [];
  const portals: Vec3[] = [];

  for (const face of faces) {
    const grid = mazeGraph.grids.get(face.id)!;

    // Internal walls: non-tree edges between adjacent cells
    for (const [c1, c2] of grid.internalEdges()) {
      const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`;
      if (!treeEdgeSet.has(key)) {
        const verts1 = cellVertices3d(face, c1, n);
        const verts2 = cellVertices3d(face, c2, n);
        const edge = sharedEdge(verts1, verts2);
        if (edge) {
          walls.push(edge[0], edge[1]);
        }
      }
    }

    // Face outline with gaps at inter-face passages
    const faceVerts = face.vertices;
    const nv = faceVerts.length;
    for (let i = 0; i < nv; i++) {
      const edgeStart = faceVerts[i]!;
      const edgeEnd = faceVerts[(i + 1) % nv]!;

      // Find the adjacent face that shares this edge
      const adjFaceId = findAdjacentFaceId(faces, face.id, edgeStart, edgeEnd);

      let boundaryCells: CellKey[];
      try {
        boundaryCells = grid.boundaryCells(edgeStart, edgeEnd);
      } catch {
        // Fallback: draw full edge if boundaryCells fails
        outline.push(edgeStart, edgeEnd);
        continue;
      }

      // Grid vertices are evenly spaced along the edge
      const du = scale(sub(edgeEnd, edgeStart), 1 / n);

      for (let j = 0; j < boundaryCells.length; j++) {
        const cell = boundaryCells[j]!;
        const segStart = add(edgeStart, scale(du, j));
        const segEnd = add(edgeStart, scale(du, j + 1));

        if (adjFaceId !== null && hasTreeEdgeToFace(cell, maze.tree, adjFaceId)) {
          // Gap at inter-face passage
          portals.push(scale(add(segStart, segEnd), 0.5));
        } else {
          outline.push(segStart, segEnd);
        }
      }
    }
  }

  // Cell center helper
  function center(cell: CellKey): Vec3 {
    const fid = parseCell(cell).faceId;
    return mazeGraph.grids.get(fid)!.cellCenter3d(cell);
  }

  // Face lookup by id
  const faceById = new Map<number, Face>();
  for (const f of faces) faceById.set(f.id, f);

  // Solution path with boundary midpoints at face crossings
  const solution: Vec3[] = [];
  if (showSolution) {
    const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
    for (let i = 0; i < path.length; i++) {
      const cell = path[i]!;
      const fid = parseCell(cell).faceId;

      // Insert boundary midpoint when crossing faces
      if (i > 0) {
        const prevCell = path[i - 1]!;
        const prevFid = parseCell(prevCell).faceId;
        if (fid !== prevFid) {
          const prevFace = faceById.get(prevFid)!;
          const currFace = faceById.get(fid)!;
          const v1 = cellVertices3d(prevFace, prevCell, n);
          const v2 = cellVertices3d(currFace, cell, n);
          const edge = sharedEdge(v1, v2);
          if (edge) {
            solution.push(scale(add(edge[0], edge[1]), 0.5));
          }
        }
      }

      solution.push(center(cell));
    }
  }

  return {
    walls,
    outline,
    portals,
    solution,
    startPos: center(maze.start),
    goalPos: center(maze.goal),
    warpA: maze.warp ? center(maze.warp.cellA) : null,
    warpB: maze.warp ? center(maze.warp.cellB) : null,
  };
}

