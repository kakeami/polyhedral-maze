/**
 * 3D geometry for the maze rendered in the Three.js scene:
 * wall segments, face-outline gaps, solution polyline, and marker positions.
 * Output is consumed by three-scene.ts to build Line2 / LineSegments2 geometry.
 */

import type { Vec3, CellKey, Face } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import { add, sub, scale, allClose } from '../core/vec3.ts';
import { VERTEX_EPSILON } from '../core/constants.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import { cellVertices3d } from '../core/cell-geometry.ts';
import { bfsShortestPath } from '../core/graph.ts';
import { hasTreeEdgeToFace } from './render-utils.ts';
import { buildEdgeIndex } from './edge-index.ts';

export { cellVertices3d };

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

export type MarkerKind = 'start' | 'goal' | 'warp';

/**
 * A marked cell, given as a point on the surface plus the direction that
 * leaves it. The scene stands a pin here: the head floats clear of the maze
 * and the stem runs down the normal to `at`, so a dense grid keeps both its
 * walls and an unambiguous answer to "which cell exactly?".
 */
export interface MazeMarker {
  kind: MarkerKind;
  /** Centre of the marked cell, on the surface. */
  at: Vec3;
  /** Outward unit normal of the face the cell belongs to. */
  normal: Vec3;
}

export interface MazeRenderData {
  walls: Vec3[];       // pairs of Vec3 (p1, p2, p1, p2, ...)
  outline: Vec3[];     // face boundary wall segments (with gaps at passages)
  solution: Vec3[];    // solution path cell centers (with boundary midpoints)
  markers: MazeMarker[];
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
  const edgeIndex = buildEdgeIndex(faces);
  const walls: Vec3[] = [];
  const outline: Vec3[] = [];

  for (const face of faces) {
    const grid = mazeGraph.grids.get(face.id)!;

    // Internal walls: non-tree edges between adjacent cells
    for (const [c1, c2] of grid.internalEdges()) {
      const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`;
      if (!treeEdgeSet.has(key)) {
        const verts1 = cellVertices3d(face, c1, n, grid.kind);
        const verts2 = cellVertices3d(face, c2, n, grid.kind);
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
      const adjFaceId = edgeIndex.findAdjacentFace(face.id, i);

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
          // Gap at inter-face passage (no segment drawn)
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
          const v1 = cellVertices3d(prevFace, prevCell, n, mazeGraph.grids.get(prevFid)!.kind);
          const v2 = cellVertices3d(currFace, cell, n, mazeGraph.grids.get(fid)!.kind);
          const edge = sharedEdge(v1, v2);
          if (edge) {
            solution.push(scale(add(edge[0], edge[1]), 0.5));
          }
        }
      }

      solution.push(center(cell));
    }
  }

  const marker = (cell: CellKey, kind: MarkerKind): MazeMarker => ({
    kind,
    at: center(cell),
    normal: faceById.get(parseCell(cell).faceId)!.normal,
  });
  const markers: MazeMarker[] = [
    marker(maze.start, 'start'),
    marker(maze.goal, 'goal'),
  ];
  if (maze.warp) {
    markers.push(marker(maze.warp.cellA, 'warp'), marker(maze.warp.cellB, 'warp'));
  }

  return { walls, outline, solution, markers };
}

