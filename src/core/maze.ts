import type { CellKey } from './types.ts';
import { parseCell } from './types.ts';
import { Graph, UnionFind, bfsShortestPath, bfsSingleSourceLengths } from './graph.ts';
import type { Rng } from './prng.ts';
import type { MazeGraph } from './maze-graph.ts';

export type Algorithm = 'KRUSKAL' | 'DFS' | 'WILSON';

export interface Warp {
  cellA: CellKey;
  cellB: CellKey;
}

export interface Maze {
  tree: Graph<CellKey>;
  start: CellKey;
  goal: CellKey;
  warp: Warp | null;
}

export function generate(
  mazeGraph: MazeGraph,
  options: {
    algorithm?: Algorithm;
    warp?: boolean;
    rng: Rng;
  },
): Maze {
  const { algorithm = 'KRUSKAL', warp: enableWarp = false, rng } = options;
  const g = mazeGraph.graph;

  if (g.nodeCount() === 0) {
    throw new Error('MazeGraph is empty — did you call build()?');
  }

  const builders: Record<Algorithm, (g: Graph<CellKey>, rng: Rng) => Graph<CellKey>> = {
    KRUSKAL: kruskal,
    DFS: dfsBacktracker,
    WILSON: wilson,
  };
  const tree = builders[algorithm](g, rng);

  let warpResult: Warp | null = null;
  if (enableWarp) {
    warpResult = findWarp(tree, mazeGraph);
    if (warpResult) {
      spliceWarp(tree, warpResult);
    }
  }

  const [start, goal] = placeStartGoal(tree, mazeGraph);
  return { tree, start, goal, warp: warpResult };
}

function kruskal(g: Graph<CellKey>, rng: Rng): Graph<CellKey> {
  const edges = g.edges();
  rng.shuffle(edges);

  const tree = new Graph<CellKey>();
  for (const node of g.nodes()) {
    tree.addNode(node, g.nodeData(node) ?? {});
  }

  const uf = new UnionFind<CellKey>();
  for (const [u, v] of edges) {
    if (uf.find(u) !== uf.find(v)) {
      tree.addEdge(u, v);
      uf.union(u, v);
    }
  }
  return tree;
}

function dfsBacktracker(g: Graph<CellKey>, rng: Rng): Graph<CellKey> {
  const tree = new Graph<CellKey>();
  for (const node of g.nodes()) {
    tree.addNode(node, g.nodeData(node) ?? {});
  }

  const nodes = g.nodes();
  const start = rng.choice(nodes);
  const visited = new Set<CellKey>([start]);
  const stack: CellKey[] = [start];

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const neighbors = g.neighbors(current).filter((n) => !visited.has(n));
    if (neighbors.length > 0) {
      const nxt = rng.choice(neighbors);
      tree.addEdge(current, nxt);
      visited.add(nxt);
      stack.push(nxt);
    } else {
      stack.pop();
    }
  }
  return tree;
}

function wilson(g: Graph<CellKey>, rng: Rng): Graph<CellKey> {
  const tree = new Graph<CellKey>();
  for (const node of g.nodes()) {
    tree.addNode(node, g.nodeData(node) ?? {});
  }

  const nodes = g.nodes();
  rng.shuffle(nodes);

  const inTree = new Set<CellKey>();
  inTree.add(nodes[0]!);

  for (const node of nodes) {
    if (inTree.has(node)) continue;

    // Random walk until hitting the tree
    const path = new Map<CellKey, CellKey>();
    let current = node;
    while (!inTree.has(current)) {
      const neighbors = g.neighbors(current);
      const nxt = rng.choice(neighbors);
      path.set(current, nxt);
      current = nxt;
    }

    // Trace the loop-erased path
    current = node;
    while (!inTree.has(current)) {
      const nxt = path.get(current)!;
      tree.addEdge(current, nxt);
      inTree.add(current);
      current = nxt;
    }
  }
  return tree;
}

function findWarp(
  tree: Graph<CellKey>,
  mazeGraph: MazeGraph,
): Warp | null {
  const deadEnds = new Set<CellKey>();
  for (const node of tree.nodes()) {
    if (tree.degree(node) === 1) deadEnds.add(node);
  }

  function getPairs(
    pool: CellKey[],
    oppMustBeDeadEnd: boolean,
    oppMustBeInterior: boolean,
  ): [CellKey, CellKey][] {
    const result: [CellKey, CellKey][] = [];
    const seen = new Set<string>();
    for (const cell of pool) {
      const opp = mazeGraph.oppositeCell(cell);
      if (opp === null) continue;
      const pairKey = cell < opp ? `${cell}|${opp}` : `${opp}|${cell}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      if (oppMustBeDeadEnd && !deadEnds.has(opp)) continue;
      if (oppMustBeInterior && !mazeGraph.grids.get(parseCell(opp).faceId)!.isInterior(opp))
        continue;
      result.push([cell, opp]);
    }
    return result;
  }

  const interiorDeadEnds = Array.from(deadEnds).filter((c) =>
    mazeGraph.grids.get(parseCell(c).faceId)!.isInterior(c),
  );

  // Tier 1: both interior dead-ends
  let pairs = getPairs(interiorDeadEnds, true, true);

  if (pairs.length === 0) {
    // Tier 2: both interior, any degree
    const interiorCells = tree
      .nodes()
      .filter((c) => mazeGraph.grids.get(parseCell(c).faceId)!.isInterior(c));
    pairs = getPairs(interiorCells, false, true);
  }

  if (pairs.length === 0) {
    // Tier 3: any opposite pair
    pairs = getPairs(tree.nodes(), false, false);
  }

  if (pairs.length === 0) return null;

  let best = pairs[0]!;
  let bestDist = bfsSingleSourceLengths(tree, best[0]).get(best[1]) ?? 0;
  for (let i = 1; i < pairs.length; i++) {
    const [a, b] = pairs[i]!;
    const dist = bfsSingleSourceLengths(tree, a).get(b) ?? 0;
    if (dist > bestDist) {
      bestDist = dist;
      best = pairs[i]!;
    }
  }

  return { cellA: best[0], cellB: best[1] };
}

function spliceWarp(tree: Graph<CellKey>, warp: Warp): void {
  const path = bfsShortestPath(tree, warp.cellA, warp.cellB);
  const mid = Math.floor(path.length / 2);
  tree.removeEdge(path[mid - 1]!, path[mid]!);
  tree.addEdge(warp.cellA, warp.cellB, { warp: true });
}

function placeStartGoal(
  tree: Graph<CellKey>,
  _mazeGraph: MazeGraph,
): [CellKey, CellKey] {
  const nodes = tree.nodes();
  const arbitrary = nodes[0]!;

  // First BFS: find farthest node
  const lengths1 = bfsSingleSourceLengths(tree, arbitrary);
  let far1 = arbitrary;
  let maxDist = 0;
  for (const [node, dist] of lengths1) {
    if (dist > maxDist) {
      maxDist = dist;
      far1 = node;
    }
  }

  // Second BFS: from far1, find farthest on different face
  const lengths2 = bfsSingleSourceLengths(tree, far1);
  const far1Face = parseCell(far1).faceId;

  let far2 = far1;
  let maxDist2 = -1;
  let maxDist2Any = 0;
  let far2Any = far1;

  for (const [node, dist] of lengths2) {
    if (parseCell(node).faceId !== far1Face && dist > maxDist2) {
      maxDist2 = dist;
      far2 = node;
    }
    if (dist > maxDist2Any) {
      maxDist2Any = dist;
      far2Any = node;
    }
  }

  if (maxDist2 === -1) {
    far2 = far2Any;
  }

  return [far1, far2];
}
