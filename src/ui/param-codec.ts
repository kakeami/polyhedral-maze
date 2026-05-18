import type { Algorithm } from '../core/maze.ts';

export interface MazeParams {
  shape: string;
  n: number;
  k: number;
  algorithm: Algorithm;
  seed: number;
  warp: boolean;
  showSolution: boolean;
}

const ALGORITHMS: readonly Algorithm[] = ['KRUSKAL', 'DFS', 'WILSON'];

export const DEFAULT_PARAMS: MazeParams = {
  shape: 'icosahedron',
  n: 9,
  k: 3,
  algorithm: 'DFS',
  seed: 42,
  warp: false,
  showSolution: false,
};

export function encodeParams(params: MazeParams): string {
  const p = new URLSearchParams();
  if (params.shape !== DEFAULT_PARAMS.shape) p.set('shape', params.shape);
  if (params.n !== DEFAULT_PARAMS.n) p.set('n', String(params.n));
  if (params.k !== DEFAULT_PARAMS.k) p.set('k', String(params.k));
  if (params.algorithm !== DEFAULT_PARAMS.algorithm) p.set('algo', params.algorithm.toLowerCase());
  if (params.seed !== DEFAULT_PARAMS.seed) p.set('seed', String(params.seed));
  if (params.warp) p.set('warp', '1');
  if (params.showSolution) p.set('solution', '1');
  const qs = p.toString();
  return qs ? '?' + qs : '';
}

export function decodeParams(search: string): MazeParams {
  const p = new URLSearchParams(search);
  return {
    shape: p.get('shape') ?? DEFAULT_PARAMS.shape,
    n: clamp(Number(p.get('n') ?? DEFAULT_PARAMS.n), 2, 12),
    k: clamp(Number(p.get('k') ?? DEFAULT_PARAMS.k), 1, 4),
    algorithm: parseAlgorithm(p.get('algo')),
    seed: clamp(Number(p.get('seed') ?? DEFAULT_PARAMS.seed), 0, 999999),
    warp: p.get('warp') === '1',
    showSolution: p.get('solution') === '1',
  };
}

function parseAlgorithm(raw: string | null): Algorithm {
  if (raw === null) return DEFAULT_PARAMS.algorithm;
  const up = raw.toUpperCase();
  return (ALGORITHMS as readonly string[]).includes(up)
    ? (up as Algorithm)
    : DEFAULT_PARAMS.algorithm;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}
