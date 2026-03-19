import type { CellKey } from './types.ts';
import { parseCell } from './types.ts';
import { bfsShortestPath } from './graph.ts';
import type { Maze } from './maze.ts';
import type { MazeGraph } from './maze-graph.ts';

export interface MazeMetrics {
  solutionLength: number;
  totalCells: number;
  solutionRatio: number;
  deadEndCount: number;
  deadEndDensity: number;
  faceCrossings: number;
  faceCoverage: number;
  totalFaces: number;
  warpUsed: boolean;
}

export function computeMetrics(maze: Maze, mazeGraph: MazeGraph): MazeMetrics {
  const path: CellKey[] = bfsShortestPath(maze.tree, maze.start, maze.goal);
  const totalCells = maze.tree.nodeCount();

  let faceCrossings = 0;
  for (let i = 0; i < path.length - 1; i++) {
    if (parseCell(path[i]!).faceId !== parseCell(path[i + 1]!).faceId) {
      faceCrossings++;
    }
  }

  const facesVisited = new Set<number>();
  for (const cell of path) {
    facesVisited.add(parseCell(cell).faceId);
  }

  let deadEnds = 0;
  for (const node of maze.tree.nodes()) {
    if (maze.tree.degree(node) === 1) deadEnds++;
  }

  let warpUsed = false;
  if (maze.warp) {
    const warpA = maze.warp.cellA;
    const warpB = maze.warp.cellB;
    for (let i = 0; i < path.length - 1; i++) {
      if (
        (path[i] === warpA && path[i + 1] === warpB) ||
        (path[i] === warpB && path[i + 1] === warpA)
      ) {
        warpUsed = true;
        break;
      }
    }
  }

  return {
    solutionLength: path.length,
    totalCells,
    solutionRatio: path.length / totalCells,
    deadEndCount: deadEnds,
    deadEndDensity: deadEnds / totalCells,
    faceCrossings,
    faceCoverage: facesVisited.size,
    totalFaces: mazeGraph.polyhedron.faces().length,
    warpUsed,
  };
}
