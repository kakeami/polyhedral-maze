/**
 * URL <-> parameters for the folding maze.
 *
 * Shorter than the other two pages' codecs, and for a reason worth saying out
 * loud: there is almost nothing to put in it. The object is fixed — one ring,
 * one taping, six poses — so there is no shape and no algorithm to name. What
 * it carries is how finely the object is ruled, which maze, and where it
 * happens to be standing.
 *
 * The maze is a *seed*, as on the polyhedral page, rather than an index into a
 * shelf. Searching for one takes about a second at any ruling the page offers
 * (`maze-contracted.ts`), so there is no reason to ration them: a link can
 * name any of a million mazes, and the few that are shipped are a cache in
 * front of the search rather than the whole of what exists.
 *
 * The pose is in the URL even though it is not a property of the object. A
 * link to this page is a link to something someone was looking at, and half of
 * what they were looking at is which of the six shapes it was in.
 */

import { DEFAULT_PRESET_ID, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import { INFINITY_CUBE_RULINGS } from '../core/kinetic/mechanisms/infinity-cube-designs.ts';

export interface FoldParams {
  /** Maze cells across one face of one cube. */
  cells: number;
  /** Which maze: the seed the search for it starts from. */
  seed: number;
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
  /** As on the polyhedral page, and for the same reason: it has to end somewhere. */
  maxSeed: 999999,
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

/** A seed to shuffle to, in the range a link can carry. */
export function randomSeed(): number {
  return Math.floor(Math.random() * (FOLD_LIMITS.maxSeed + 1));
}

export const DEFAULT_FOLD_PARAMS: FoldParams = {
  // Five squares a face: the finest ruling that is still comfortably legible
  // as eight paper cubes, and coarse enough to read on screen at a glance.
  cells: INFINITY_CUBE_RULINGS.includes(5) ? 5 : (INFINITY_CUBE_RULINGS[0] ?? 5),
  // As on the polyhedral page. It is cached at every ruling, so the first
  // thing anyone sees is drawn without a search, and so is the first thing
  // they see after dragging the ruling slider.
  seed: 42,
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
  return {
    cells,
    seed: clamp(Math.round(p.seed), 0, FOLD_LIMITS.maxSeed),
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
  if (params.seed !== d.seed) p.set('seed', String(params.seed));
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
    // `maze` is what this used to be called, when it was an index into a shelf
    // of six. The numbers happen to line up — the shelf is now the first few
    // seeds — so an old link still opens a maze at the ruling it asked for.
    seed: number(p.get('seed') || p.get('maze'), d.seed),
    pose: number(p.get('pose'), d.pose),
    showSolution: flag(p.get('solution'), d.showSolution),
    fold: flag(p.get('fold'), d.fold),
    autoRotate: flag(p.get('rotate'), d.autoRotate),
    style: resolvePreset(p.get('style')).id,
  });
}

function number(raw: string | null | undefined, fallback: number): number {
  // An empty value names nothing, and `Number('')` is 0 — which used to be
  // hidden by a lower bound of one and is not, now that seed 0 is a real maze.
  if (raw === null || raw === undefined || raw === '') return fallback;
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
