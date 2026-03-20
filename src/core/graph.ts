/**
 * Simple undirected graph with string node keys and typed data.
 * Replaces networkx.Graph for the maze domain.
 */
export class Graph<
  N extends string = string,
  NData = Record<string, unknown>,
  EData = Record<string, unknown>,
> {
  private _adj = new Map<N, Map<N, EData>>();
  private _nodeData = new Map<N, NData>();

  addNode(node: N, data?: NData): void {
    if (!this._adj.has(node)) {
      this._adj.set(node, new Map());
    }
    if (data) {
      const existing = this._nodeData.get(node);
      this._nodeData.set(node, existing ? { ...existing, ...data } : data);
    }
  }

  addEdge(u: N, v: N, data?: EData): void {
    this.addNode(u);
    this.addNode(v);
    const d = data ?? ({} as EData);
    this._adj.get(u)!.set(v, d);
    this._adj.get(v)!.set(u, d);
  }

  removeEdge(u: N, v: N): void {
    this._adj.get(u)?.delete(v);
    this._adj.get(v)?.delete(u);
  }

  hasEdge(u: N, v: N): boolean {
    return this._adj.get(u)?.has(v) ?? false;
  }

  neighbors(node: N): N[] {
    const adj = this._adj.get(node);
    return adj ? Array.from(adj.keys()) : [];
  }

  nodes(): N[] {
    return Array.from(this._adj.keys());
  }

  edges(): [N, N][] {
    const result: [N, N][] = [];
    const seen = new Set<string>();
    for (const [u, adj] of this._adj) {
      for (const v of adj.keys()) {
        const key = u < v ? `${u}|${v}` : `${v}|${u}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push([u, v]);
        }
      }
    }
    return result;
  }

  edgesWithData(): [N, N, EData][] {
    const result: [N, N, EData][] = [];
    const seen = new Set<string>();
    for (const [u, adj] of this._adj) {
      for (const [v, data] of adj) {
        const key = u < v ? `${u}|${v}` : `${v}|${u}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push([u, v, data]);
        }
      }
    }
    return result;
  }

  nodeData(node: N): NData | undefined {
    return this._nodeData.get(node);
  }

  edgeData(u: N, v: N): EData | undefined {
    return this._adj.get(u)?.get(v);
  }

  nodeCount(): number {
    return this._adj.size;
  }

  edgeCount(): number {
    let count = 0;
    for (const adj of this._adj.values()) {
      count += adj.size;
    }
    return count / 2;
  }

  degree(node: N): number {
    return this._adj.get(node)?.size ?? 0;
  }

  hasNode(node: N): boolean {
    return this._adj.has(node);
  }

  clear(): void {
    this._adj.clear();
    this._nodeData.clear();
  }
}

/**
 * Union-Find (disjoint set) with path compression and union by rank.
 */
export class UnionFind<T> {
  private parent = new Map<T, T>();
  private rank = new Map<T, number>();

  find(x: T): T {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(x: T, y: T): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    const rankX = this.rank.get(rx)!;
    const rankY = this.rank.get(ry)!;
    if (rankX < rankY) {
      this.parent.set(rx, ry);
    } else if (rankX > rankY) {
      this.parent.set(ry, rx);
    } else {
      this.parent.set(ry, rx);
      this.rank.set(rx, rankX + 1);
    }
  }

  connected(x: T, y: T): boolean {
    return this.find(x) === this.find(y);
  }
}

/**
 * BFS shortest path between source and target.
 * Returns the path as an array of nodes, or empty array if unreachable.
 */
export function bfsShortestPath<N extends string>(
  graph: Pick<Graph<N>, 'neighbors'>,
  source: N,
  target: N,
): N[] {
  if (source === target) return [source];
  const prev = new Map<N, N>();
  const visited = new Set<N>([source]);
  const queue: N[] = [source];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph.neighbors(current)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        prev.set(neighbor, current);
        if (neighbor === target) {
          // Reconstruct path
          const path: N[] = [target];
          let node = target;
          while (node !== source) {
            node = prev.get(node)!;
            path.push(node);
          }
          return path.reverse();
        }
        queue.push(neighbor);
      }
    }
  }
  return [];
}

/**
 * BFS from source, returns distance to all reachable nodes.
 */
export function bfsSingleSourceLengths<N extends string>(
  graph: Pick<Graph<N>, 'neighbors'>,
  source: N,
): Map<N, number> {
  const dist = new Map<N, number>();
  dist.set(source, 0);
  const queue: N[] = [source];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = dist.get(current)!;
    for (const neighbor of graph.neighbors(current)) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }
  return dist;
}
