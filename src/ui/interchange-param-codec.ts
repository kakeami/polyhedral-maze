/**
 * URL <-> parameters for the interchange maze.
 *
 * Two numbers more than the folding page carries, and they are the two that
 * make this a different maze rather than a different view of one: how many
 * stations there are to fold on, and how many times the way from start to
 * goal folds. Both are asked of the maze, not read off it — a seed names a
 * maze only together with them.
 *
 * The pose is a position among the shapes that are walked in, not among
 * everything the object can be put down as: a shape halfway between two of
 * them is somewhere a fold passes through, and a link cannot stand there.
 */

import { DEFAULT_PRESET_ID, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import { interchangeRulings } from './interchange-objects.ts';

export interface InterchangeParams {
  /** Maze cells across one face of one cube. */
  cells: number;
  /** Stations: the marks to fold on, beside the start and the goal. */
  stations: number;
  /** Folds the way from start to goal makes. */
  folds: number;
  /** Which maze, of those with that many stations and folds. */
  seed: number;
  /** Which shape it stands in, among the shapes walked in. */
  pose: number;
  showSolution: boolean;
  autoRotate: boolean;
  /** 3D view only. */
  style: PresetId;
}

export const INTERCHANGE_LIMITS = {
  maxSeed: 999999,
  /** One on the way and one off it: fewer and there is nothing to choose between. */
  minStations: 2,
  /** As many as there are symbols to tell them apart by. */
  maxStations: 12,
  minFolds: 1,
  /** Past five, a maze with that long a way is rarely found in the time a slider allows. */
  maxFolds: 5,
} as const;

export function randomSeed(): number {
  return Math.floor(Math.random() * (INTERCHANGE_LIMITS.maxSeed + 1));
}

export const DEFAULT_INTERCHANGE_PARAMS: InterchangeParams = {
  cells: nearestRuling(4),
  stations: 4,
  folds: 2,
  seed: 42,
  pose: 0,
  showSolution: false,
  autoRotate: true,
  style: DEFAULT_PRESET_ID,
};

/** The nearest ruling on offer: a link cannot ask for one that is not. */
export function nearestRuling(cells: number): number {
  const rulings = interchangeRulings();
  return rulings.reduce((best, ruling) =>
    Math.abs(ruling - cells) < Math.abs(best - cells) ? ruling : best, rulings[0]!);
}

export function clampInterchangeParams(p: InterchangeParams): InterchangeParams {
  const { minStations, maxStations, minFolds, maxFolds, maxSeed } = INTERCHANGE_LIMITS;
  return {
    cells: nearestRuling(Math.round(p.cells)),
    stations: clamp(Math.round(p.stations), minStations, maxStations),
    folds: clamp(Math.round(p.folds), minFolds, maxFolds),
    seed: clamp(Math.round(p.seed), 0, maxSeed),
    // Only the floor is known here; how many shapes there are is the object's to say.
    pose: Math.max(0, Math.round(p.pose) || 0),
    showSolution: p.showSolution,
    autoRotate: p.autoRotate,
    style: resolvePreset(p.style).id,
  };
}

export function encodeInterchangeParams(params: InterchangeParams): string {
  const d = DEFAULT_INTERCHANGE_PARAMS;
  const p = new URLSearchParams();
  if (params.cells !== d.cells) p.set('n', String(params.cells));
  if (params.stations !== d.stations) p.set('stations', String(params.stations));
  if (params.folds !== d.folds) p.set('folds', String(params.folds));
  if (params.seed !== d.seed) p.set('seed', String(params.seed));
  if (params.pose !== d.pose) p.set('pose', String(params.pose));
  if (params.showSolution !== d.showSolution) p.set('solution', params.showSolution ? '1' : '0');
  if (params.autoRotate !== d.autoRotate) p.set('rotate', params.autoRotate ? '1' : '0');
  if (params.style !== d.style) p.set('style', params.style);
  const qs = p.toString();
  return qs ? '?' + qs : '';
}

/**
 * The link a printed pattern carries: the maze, and nothing of how it was
 * being looked at when it was printed — least of all the answer playing.
 */
export function encodeInterchangeMaze(
  maze: Pick<InterchangeParams, 'cells' | 'stations' | 'folds' | 'seed'>,
): string {
  return encodeInterchangeParams({
    ...DEFAULT_INTERCHANGE_PARAMS,
    cells: maze.cells, stations: maze.stations, folds: maze.folds, seed: maze.seed,
  });
}

export function decodeInterchangeParams(search: string): InterchangeParams {
  const p = new URLSearchParams(search);
  const d = DEFAULT_INTERCHANGE_PARAMS;
  return clampInterchangeParams({
    cells: number(p.get('n'), d.cells),
    stations: number(p.get('stations'), d.stations),
    folds: number(p.get('folds'), d.folds),
    seed: number(p.get('seed'), d.seed),
    pose: number(p.get('pose'), d.pose),
    showSolution: flag(p.get('solution'), d.showSolution),
    autoRotate: flag(p.get('rotate'), d.autoRotate),
    style: resolvePreset(p.get('style')).id,
  });
}

function number(raw: string | null, fallback: number): number {
  if (raw === null || raw === '') return fallback;
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
