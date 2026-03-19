export interface MazeParams {
  shape: string;
  n: number;
  k: number;
  algorithm: string;
  seed: number;
  warp: boolean;
  showSolution: boolean;
}

export const DEFAULT_PARAMS: MazeParams = {
  shape: 'cube',
  n: 6,
  k: 2,
  algorithm: 'KRUSKAL',
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
    algorithm: (p.get('algo') ?? DEFAULT_PARAMS.algorithm).toUpperCase(),
    seed: clamp(Number(p.get('seed') ?? DEFAULT_PARAMS.seed), 0, 999999),
    warp: p.get('warp') === '1',
    showSolution: p.get('solution') === '1',
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}
