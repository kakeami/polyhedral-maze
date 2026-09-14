/**
 * URL <-> parameters for the folding maze.
 *
 * Shorter than the other two pages' codecs, and for a reason worth saying out
 * loud: there is almost nothing to put in it. The object is fixed — one ring,
 * one taping, six poses — and the mazes are found offline and shipped with the
 * page, so a link cannot carry a seed, an effort or a shape. What it carries
 * is which maze off the shelf, how finely it is ruled, and where the object
 * happens to be standing.
 *
 * The pose is in the URL even though it is not a property of the object. A
 * link to this page is a link to something someone was looking at, and half of
 * what they were looking at is which of the six shapes it was in.
 */

import { DEFAULT_PRESET_ID, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import {
  INFINITY_CUBE_RULINGS, infinityCubeDesigns,
} from '../core/kinetic/mechanisms/infinity-cube-designs.ts';

export interface FoldParams {
  /** Maze cells across one face of one cube. */
  cells: number;
  /** Which of the shipped mazes at that ruling, counting from one. */
  maze: number;
  /** Which shape it is standing in. */
  pose: number;
  showSolution: boolean;
  /** Whether it folds from pose to pose on its own. */
  fold: boolean;
  autoRotate: boolean;
  /** 3D view only — the printed cubes are unaffected. */
  style: PresetId;
}

export const FOLD_LIMITS = {
  /**
   * Shapes the ring shuts into: four planks and two cubes.
   *
   * A property of the taping rather than of anything anyone can set, and it is
   * checked against the mechanism when a pose is applied; it is here so that a
   * URL with a pose of 40 in it is brought back into range before anything
   * tries to fold into it.
   */
  poses: 6,
} as const;

export const DEFAULT_FOLD_PARAMS: FoldParams = {
  cells: INFINITY_CUBE_RULINGS.includes(3) ? 3 : (INFINITY_CUBE_RULINGS[0] ?? 3),
  maze: 1,
  pose: 0,
  showSolution: false,
  fold: true,
  autoRotate: true,
  style: DEFAULT_PRESET_ID,
};

/** The nearest ruling there are mazes for: a link cannot ask for one there is not. */
export function nearestRuling(cells: number): number {
  const rulings = INFINITY_CUBE_RULINGS;
  if (rulings.length === 0) return DEFAULT_FOLD_PARAMS.cells;
  return rulings.reduce((best, ruling) =>
    Math.abs(ruling - cells) < Math.abs(best - cells) ? ruling : best, rulings[0]!);
}

export function clampFoldParams(p: FoldParams): FoldParams {
  const cells = nearestRuling(Math.round(p.cells));
  const shelf = Math.max(1, infinityCubeDesigns(cells).length);
  return {
    cells,
    maze: clamp(Math.round(p.maze), 1, shelf),
    pose: clamp(Math.round(p.pose), 0, FOLD_LIMITS.poses - 1),
    showSolution: p.showSolution,
    fold: p.fold,
    autoRotate: p.autoRotate,
    style: resolvePreset(p.style).id,
  };
}

export function encodeFoldParams(params: FoldParams): string {
  const d = DEFAULT_FOLD_PARAMS;
  const p = new URLSearchParams();
  if (params.cells !== d.cells) p.set('n', String(params.cells));
  if (params.maze !== d.maze) p.set('maze', String(params.maze));
  if (params.pose !== d.pose) p.set('pose', String(params.pose));
  if (params.showSolution !== d.showSolution) p.set('solution', params.showSolution ? '1' : '0');
  if (params.fold !== d.fold) p.set('fold', params.fold ? '1' : '0');
  if (params.autoRotate !== d.autoRotate) p.set('rotate', params.autoRotate ? '1' : '0');
  if (params.style !== d.style) p.set('style', params.style);
  const qs = p.toString();
  return qs ? '?' + qs : '';
}

export function decodeFoldParams(search: string): FoldParams {
  const p = new URLSearchParams(search);
  const d = DEFAULT_FOLD_PARAMS;
  return clampFoldParams({
    cells: number(p.get('n'), d.cells),
    maze: number(p.get('maze'), d.maze),
    pose: number(p.get('pose'), d.pose),
    showSolution: flag(p.get('solution'), d.showSolution),
    fold: flag(p.get('fold'), d.fold),
    autoRotate: flag(p.get('rotate'), d.autoRotate),
    style: resolvePreset(p.get('style')).id,
  });
}

function number(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function flag(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true';
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.max(low, Math.min(high, value));
}
