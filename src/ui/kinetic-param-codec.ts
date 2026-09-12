/**
 * URL <-> parameters for the moving maze, and the limits those parameters obey.
 *
 * The limits are here rather than in the panel because they are not a matter of
 * taste: a stack of `layers` rings with `sides` faces has sides^(layers-1)
 * states, and the design has to be a perfect maze in *every* one of them, so
 * the work grows with the number of states times the number of cells. The
 * bounds below are the ones that keep a rebuild under about a second, which is
 * what makes the sliders feel like sliders.
 */

import { DEFAULT_PRESET_ID, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';

export interface KineticParams {
  /** Faces of the prism. */
  sides: number;
  /** Rings threaded on the dowel. */
  layers: number;
  /** Maze cells across one face of a ring. */
  cols: number;
  /** Maze cells up one ring. */
  rows: number;
  /** Passages across a seam, over the minimum the mechanism needs. */
  k: number;
  seed: number;
  showSolution: boolean;
  /** Whether the rings turn on their own. */
  motion: boolean;
  /**
   * How hard to look for a design that is perfect in every state, as a
   * multiple of the default budget. Part of the URL because it is part of the
   * answer: the search is a heuristic, so the same seed at a different effort
   * is a different maze.
   */
  effort: number;
  /** 3D view only — the printed rings are unaffected. */
  style: PresetId;
}

export const KINETIC_LIMITS = {
  sides: { min: 3, max: 12 },
  layers: { min: 2, max: 6 },
  cols: { min: 1, max: 6 },
  rows: { min: 1, max: 6 },
  k: { min: 0, max: 4 },
  seed: { min: 0, max: 999999 },
  /** Effort multipliers the "Search harder" button steps through. */
  effortSteps: [1, 2, 4, 8] as readonly number[],
  /** Past this the mechanism has more configurations than anyone can feel. */
  maxStates: 1296,
  /** Past this the cells are too small to read on screen anyway. */
  maxCells: 720,
  /**
   * The real limit, and the reason the sliders bound each other.
   *
   * The search scores a candidate design by walking every cell of every state,
   * so what a rebuild costs is states x cells, not either alone. Measured on
   * this code, 160k of them comes back in well under a second, while the same
   * budget spent at the corners of the two limits above (1296 states of 720
   * cells) takes the better part of a minute. Either bound alone would let the
   * page hang; this one is what keeps a slider a slider.
   */
  maxWork: 160000,
} as const;

export const DEFAULT_KINETIC_PARAMS: KineticParams = {
  sides: 6,
  layers: 4,
  cols: 3,
  rows: 3,
  k: 0,
  seed: 42,
  showSolution: true,
  motion: true,
  effort: 1,
  style: DEFAULT_PRESET_ID,
};

export function stateCount(sides: number, layers: number): number {
  return sides ** (layers - 1);
}

export function cellCount(p: Pick<KineticParams, 'sides' | 'layers' | 'cols' | 'rows'>): number {
  return p.sides * p.layers * p.cols * p.rows;
}

/** Most rings this many sides can carry before the states run away. */
export function maxLayers(sides: number): number {
  let layers: number = KINETIC_LIMITS.layers.min;
  while (
    layers < KINETIC_LIMITS.layers.max &&
    stateCount(sides, layers + 1) <= KINETIC_LIMITS.maxStates
  ) {
    layers++;
  }
  return layers;
}

/** Cells the budget still has room for, given how many states there are. */
function cellBudget(sides: number, layers: number): number {
  return Math.min(
    KINETIC_LIMITS.maxCells,
    Math.floor(KINETIC_LIMITS.maxWork / stateCount(sides, layers)),
  );
}

/** Most cells a face can carry across, given the rest of the shape. */
export function maxCols(p: Pick<KineticParams, 'sides' | 'layers' | 'rows'>): number {
  const fits = Math.floor(
    cellBudget(p.sides, p.layers) / (p.sides * p.layers * Math.max(1, p.rows)),
  );
  return clamp(fits, KINETIC_LIMITS.cols.min, KINETIC_LIMITS.cols.max);
}

/** Most cells a ring can carry up its height, given the rest of the shape. */
export function maxRows(p: Pick<KineticParams, 'sides' | 'layers' | 'cols'>): number {
  const fits = Math.floor(
    cellBudget(p.sides, p.layers) / (p.sides * p.layers * Math.max(1, p.cols)),
  );
  return clamp(fits, KINETIC_LIMITS.rows.min, KINETIC_LIMITS.rows.max);
}

/**
 * Rings this many sides can carry while a one-cell-per-face ruling still fits
 * the work budget. Coarser than `maxLayers` alone, and it is what the panel
 * uses: a ring count that could only ever be drawn with no maze on it is not
 * a ring count worth offering.
 */
export function maxUsableLayers(sides: number): number {
  let layers: number = KINETIC_LIMITS.layers.min;
  while (layers < maxLayers(sides)) {
    const next = layers + 1;
    if (stateCount(sides, next) * sides * next > KINETIC_LIMITS.maxWork) break;
    layers = next;
  }
  return layers;
}

/**
 * Brings a set of parameters inside the limits.
 *
 * Rings give way to sides and the grid gives way to both, because that is the
 * order in which they matter to the object: how many faces and how many rings
 * is what the mechanism *is*, while the grid is how finely it is ruled.
 */
export function clampKineticParams(p: KineticParams): KineticParams {
  const sides = clamp(Math.round(p.sides), KINETIC_LIMITS.sides.min, KINETIC_LIMITS.sides.max);
  const layers = clamp(Math.round(p.layers), KINETIC_LIMITS.layers.min, maxUsableLayers(sides));
  const rows = clamp(Math.round(p.rows), KINETIC_LIMITS.rows.min, KINETIC_LIMITS.rows.max);
  const cols = clamp(Math.round(p.cols), KINETIC_LIMITS.cols.min, maxCols({ sides, layers, rows }));
  return {
    sides,
    layers,
    cols,
    rows: clamp(rows, KINETIC_LIMITS.rows.min, maxRows({ sides, layers, cols })),
    k: clamp(Math.round(p.k), KINETIC_LIMITS.k.min, KINETIC_LIMITS.k.max),
    seed: clamp(Math.round(p.seed), KINETIC_LIMITS.seed.min, KINETIC_LIMITS.seed.max),
    showSolution: p.showSolution,
    motion: p.motion,
    effort: nearestEffort(p.effort),
    style: resolvePreset(p.style).id,
  };
}

/** The next rung of the effort ladder, or the top one. */
export function harderEffort(effort: number): number {
  const steps = KINETIC_LIMITS.effortSteps;
  const index = steps.indexOf(nearestEffort(effort));
  return steps[Math.min(index + 1, steps.length - 1)]!;
}

export function isMaxEffort(effort: number): boolean {
  return nearestEffort(effort) === KINETIC_LIMITS.effortSteps[KINETIC_LIMITS.effortSteps.length - 1];
}

function nearestEffort(value: number): number {
  const steps = KINETIC_LIMITS.effortSteps;
  if (!Number.isFinite(value)) return steps[0]!;
  return steps.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best, steps[0]!);
}

export function encodeKineticParams(params: KineticParams): string {
  const d = DEFAULT_KINETIC_PARAMS;
  const p = new URLSearchParams();
  if (params.sides !== d.sides) p.set('sides', String(params.sides));
  if (params.layers !== d.layers) p.set('rings', String(params.layers));
  if (params.cols !== d.cols) p.set('cols', String(params.cols));
  if (params.rows !== d.rows) p.set('rows', String(params.rows));
  if (params.k !== d.k) p.set('k', String(params.k));
  if (params.seed !== d.seed) p.set('seed', String(params.seed));
  if (params.showSolution !== d.showSolution) p.set('solution', params.showSolution ? '1' : '0');
  if (params.motion !== d.motion) p.set('motion', params.motion ? '1' : '0');
  if (params.effort !== d.effort) p.set('effort', String(params.effort));
  if (params.style !== d.style) p.set('style', params.style);
  const qs = p.toString();
  return qs ? '?' + qs : '';
}

export function decodeKineticParams(search: string): KineticParams {
  const p = new URLSearchParams(search);
  const d = DEFAULT_KINETIC_PARAMS;
  return clampKineticParams({
    sides: number(p.get('sides'), d.sides),
    layers: number(p.get('rings'), d.layers),
    cols: number(p.get('cols'), d.cols),
    rows: number(p.get('rows'), d.rows),
    k: number(p.get('k'), d.k),
    seed: number(p.get('seed'), d.seed),
    showSolution: flag(p.get('solution'), d.showSolution),
    motion: flag(p.get('motion'), d.motion),
    effort: number(p.get('effort'), d.effort),
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

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
