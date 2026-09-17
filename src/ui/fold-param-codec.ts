/**
 * URL <-> parameters for the folding maze.
 *
 * Shorter than the other two pages' codecs, and for a reason worth saying out
 * loud: there is almost nothing to put in it. An object is a ring of cubes and
 * a taping, both settled by what can be folded rather than by anything a
 * visitor would want to turn, so there is no shape and no algorithm to name.
 * What it carries is which object, how finely it is ruled, which maze, and
 * where it happens to be standing.
 *
 * The maze is a *seed*, as on the polyhedral page, rather than an index into a
 * shelf. Searching for one takes about a second at any ruling the page offers
 * (`maze-contracted.ts`), so there is no reason to ration them: a link can
 * name any of a million mazes, and the few that are shipped are a cache in
 * front of the search rather than the whole of what exists.
 *
 * The pose is in the URL even though it is not a property of the object. A
 * link to this page is a link to something someone was looking at, and half of
 * what they were looking at is which shape it was in. How many shapes there
 * are is a question for the object's geometry rather than for a URL, so it is
 * brought into range where the object is built rather than here.
 */

import { DEFAULT_PRESET_ID, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import {
  DEFAULT_CUBE_RING, cubeRingObject, cubeRingRulings,
} from '../core/kinetic/mechanisms/cube-ring-objects.ts';
import type { CubeRingObject } from '../core/kinetic/mechanisms/cube-ring.ts';

export interface FoldParams {
  /** Which ring of cubes: `CubeRingObject.id`. */
  object: string;
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
} as const;

/** A seed to shuffle to, in the range a link can carry. */
export function randomSeed(): number {
  return Math.floor(Math.random() * (FOLD_LIMITS.maxSeed + 1));
}

export const DEFAULT_FOLD_PARAMS: FoldParams = {
  // The eight-cube ring: the one the page shipped with, and the one a visitor
  // is likeliest to have in a drawer already.
  object: DEFAULT_CUBE_RING.id,
  // Five squares a face: the finest ruling that is still comfortably legible
  // as paper cubes, and coarse enough to read on screen at a glance.
  cells: nearestRuling(DEFAULT_CUBE_RING, 5),
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

/** The nearest ruling the object offers: a link cannot ask for one it has not. */
export function nearestRuling(object: CubeRingObject, cells: number): number {
  const rulings = cubeRingRulings(object);
  return rulings.reduce((best, ruling) =>
    Math.abs(ruling - cells) < Math.abs(best - cells) ? ruling : best, rulings[0]!);
}

export function clampFoldParams(p: FoldParams): FoldParams {
  // A link that names an object this page no longer has is opened on the one
  // it does have, rather than on nothing.
  const object = cubeRingObject(p.object);
  return {
    object: object.id,
    cells: nearestRuling(object, Math.round(p.cells)),
    seed: clamp(Math.round(p.seed), 0, FOLD_LIMITS.maxSeed),
    // Only the floor is known here. Which shapes there are is worked out from
    // the taping, and the pose is brought into that range when it is applied.
    pose: Math.max(0, Math.round(p.pose) || 0),
    showSolution: p.showSolution,
    fold: p.fold,
    autoRotate: p.autoRotate,
    style: resolvePreset(p.style).id,
  };
}

export function encodeFoldParams(params: FoldParams): string {
  const d = DEFAULT_FOLD_PARAMS;
  const p = new URLSearchParams();
  if (params.object !== d.object) p.set('object', params.object);
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
    object: p.get('object') ?? d.object,
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
