import { describe, it, expect } from 'vitest';
import { Graph, UnionFind, bfsShortestPath, bfsSingleSourceLengths } from '../graph.ts';

describe('Graph', () => {
  it('add and query nodes/edges', () => {
    const g = new Graph();
    g.addNode('a');
    g.addNode('b');
    g.addEdge('a', 'b');
    expect(g.nodeCount()).toBe(2);
    expect(g.edgeCount()).toBe(1);
    expect(g.hasEdge('a', 'b')).toBe(true);
    expect(g.hasEdge('b', 'a')).toBe(true);
    expect(g.neighbors('a')).toEqual(['b']);
  });

  it('removeEdge', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.removeEdge('a', 'b');
    expect(g.hasEdge('a', 'b')).toBe(false);
    expect(g.edgeCount()).toBe(0);
  });

  it('degree', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.addEdge('a', 'c');
    expect(g.degree('a')).toBe(2);
    expect(g.degree('b')).toBe(1);
  });

  it('edges returns unique edges', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    expect(g.edges().length).toBe(2);
  });

  it('nodeData and edgeData', () => {
    const g = new Graph();
    g.addNode('a', { color: 'red' });
    g.addEdge('a', 'b', { weight: 5 });
    expect(g.nodeData('a')).toEqual({ color: 'red' });
    expect(g.edgeData('a', 'b')).toEqual({ weight: 5 });
  });

  it('clear', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.clear();
    expect(g.nodeCount()).toBe(0);
    expect(g.edgeCount()).toBe(0);
  });
});

describe('UnionFind', () => {
  it('basic union and find', () => {
    const uf = new UnionFind<string>();
    expect(uf.connected('a', 'b')).toBe(false);
    uf.union('a', 'b');
    expect(uf.connected('a', 'b')).toBe(true);
  });

  it('transitive union', () => {
    const uf = new UnionFind<string>();
    uf.union('a', 'b');
    uf.union('b', 'c');
    expect(uf.connected('a', 'c')).toBe(true);
  });

  it('separate components', () => {
    const uf = new UnionFind<string>();
    uf.union('a', 'b');
    uf.union('c', 'd');
    expect(uf.connected('a', 'c')).toBe(false);
  });
});

describe('bfsShortestPath', () => {
  it('finds path in simple graph', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('a', 'c');
    expect(bfsShortestPath(g, 'a', 'c')).toEqual(['a', 'c']);
  });

  it('returns empty for unreachable', () => {
    const g = new Graph();
    g.addNode('a');
    g.addNode('b');
    expect(bfsShortestPath(g, 'a', 'b')).toEqual([]);
  });

  it('source equals target', () => {
    const g = new Graph();
    g.addNode('a');
    expect(bfsShortestPath(g, 'a', 'a')).toEqual(['a']);
  });
});

describe('bfsSingleSourceLengths', () => {
  it('computes distances', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.addEdge('b', 'c');
    g.addEdge('c', 'd');
    const dist = bfsSingleSourceLengths(g, 'a');
    expect(dist.get('a')).toBe(0);
    expect(dist.get('b')).toBe(1);
    expect(dist.get('c')).toBe(2);
    expect(dist.get('d')).toBe(3);
  });
});
