/**
 * URL <-> parameters for the kinetic maze, and the limits those parameters obey.
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
import {
  DEFAULT_JOINED_PAIR,
  joinedPairById,
  joinedPairCellCount,
} from '../core/kinetic/mechanisms/joined.ts';

/** Which mechanism the page is showing. */
export type MechanismId = 'stack' | 'pair';

export interface KineticParams {
  /** Rings on a dowel, or two solids glued at a face. */
  mechanism: MechanismId;
  /** Faces of the prism. */
  sides: number;
  /** Rings threaded on the dowel. */
  layers: number;
  /** Maze cells across one face of a ring. */
  cols: number;
  /** Maze cells up one ring. */
  rows: number;
  /** Which pair of solids to glue, when the mechanism is the pair. */
  pair: string;
  /** Cells along one edge of a face, when the mechanism is the pair. */
  pairN: number;
  /** Passages across a seam, over the minimum the mechanism needs. */
  k: number;
  seed: number;
  showSolution: boolean;
  /** Whether the rings turn on their own. */
  motion: boolean;
  /** Whether the view drifts around the object. */
  autoRotate: boolean;
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
  /**
   * States a mechanism may have.
   *
   * It used to say "past this the mechanism has more configurations than
   * anyone can feel", which was a judgement about hands rather than about
   * arithmetic, and it was the wrong judgement: a stack is *meant* to have
   * more turns than anyone will try, and what a visitor feels is that the
   * maze holds up whatever they do with it. Then it guarded `buildSurface`,
   * which welded each state's cells separately — and that is gone too: the
   * surface is built out of pairs of pieces, and every question about all the
   * states is answered by one walk along the line they sit in.
   *
   * What is left is the mechanism itself. `Mechanism.states` is a placement
   * per piece per state, worked out up front, so a quarter of a million states
   * over six rings is a few hundred megabytes of them before anything is built
   * on top. Measured on a twelve-sided stack six rings deep — 248832 states —
   * the mechanism takes 65ms and the surface 555ms, which is a wait but not
   * the problem; the memory is. At this ceiling the same two come to 7ms and
   * 54ms.
   *
   * Lifting it means handing out a state when asked rather than keeping them
   * all, which is the move `adjOfState` made one layer up.
   */
  maxStates: 32768,
  /**
   * Cells a stack may carry.
   *
   * A cap on the total rather than on the ruling, because what it guards is
   * reading the thing: a barrel with seven hundred squares on it is already
   * more than the eye follows at a glance, however they are shared out. It
   * does *not* guard the printed size — that is settled at export, where a
   * band too wide for the sheet is drawn smaller until a cell would come out
   * under 5 mm, and then the page says so and names a ruling that would fit.
   */
  maxCells: 720,
  /** Cells along a face edge of a glued pair. */
  pairN: { min: 1, max: 12 },
  /**
   * Cells a glued pair may carry, as a backstop.
   *
   * What actually bounds a pair is `maxN` on the joint itself, measured per
   * joint because nothing simpler predicts it. This is here for a joint added
   * to the catalogue before anyone has measured one, and what it now says is
   * that the cells still print at 7 mm: the second reason it once gave, that
   * a rebuild of this many comes back in a second and a half, stopped being
   * true when the pair went over to the contracted search and the same
   * rebuild started coming back in five milliseconds. Its own number rather
   * than `maxCells` because the two
   * mechanisms are not costly in the same way — a stack has hundreds of states
   * and a few cells each, a pair has a few states and all of its cost in the
   * cells, so `states x cells` never comes near binding here.
   */
  pairCells: 1250,
} as const;

/**
 * There is no budget of `states x cells` here any more, and that is the point.
 *
 * One used to sit between these sliders and tie them together: ask for another
 * ring and the panel took cells away, because `buildSurface` welded every
 * state's cells and so cost exactly that product. It no longer does, and
 * neither does anything else. Measured over every corner of these sliders at
 * the finest ruling the cell cap allows, building the mechanism, the surface
 * and the seam openings comes to 630ms at the very worst — a twelve-sided
 * stack six rings deep, a quarter of a million states — and to under 50ms
 * everywhere a visitor is likely to go. The shape of the cost is now
 * `a * states + b * cells`, both terms small, so a product bound describes
 * nothing. Twelve-sided rings five deep were held to one cell a face by it,
 * and carry twelve without.
 *
 * What can still be slow is the search, and it is slow in a way no product
 * predicts: eight-sided rings six deep find a design perfect in all 32768
 * states in a second and a half, while twelve-sided rings five deep spend half
 * a minute and reach five states in six. That is annealing, not arithmetic.
 * It is also not a reason to take a slider away, because the search runs a
 * round a frame and says what it has — "a perfect maze in so many of so many
 * states", with a button to look harder. A visitor who turns every slider up
 * is told what they got, rather than quietly handed a coarser object.
 */

export const DEFAULT_KINETIC_PARAMS: KineticParams = {
  mechanism: 'stack',
  pair: DEFAULT_JOINED_PAIR.id,
  pairN: 3,
  sides: 6,
  layers: 4,
  cols: 3,
  rows: 3,
  k: 0,
  seed: 42,
  showSolution: true,
  motion: true,
  autoRotate: true,
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

/**
 * Most cells a face can carry across, given the rest of the shape.
 *
 * The only thing sharing out the cells is the cell cap itself: a barrel of so
 * many faces and so many rings has that many squares to give away, and how
 * many ways it turns does not enter into it.
 */
export function maxCols(p: Pick<KineticParams, 'sides' | 'layers' | 'rows'>): number {
  const fits = Math.floor(
    KINETIC_LIMITS.maxCells / (p.sides * p.layers * Math.max(1, p.rows)),
  );
  return clamp(fits, KINETIC_LIMITS.cols.min, KINETIC_LIMITS.cols.max);
}

/** Most cells a ring can carry up its height, given the rest of the shape. */
export function maxRows(p: Pick<KineticParams, 'sides' | 'layers' | 'cols'>): number {
  const fits = Math.floor(
    KINETIC_LIMITS.maxCells / (p.sides * p.layers * Math.max(1, p.cols)),
  );
  return clamp(fits, KINETIC_LIMITS.rows.min, KINETIC_LIMITS.rows.max);
}

/**
 * Cells a glued pair would carry, cached because the sliders ask repeatedly
 * and the answer means building the solid and ruling all of its faces.
 */
const pairCells = new Map<string, number>();
export function pairCellCount(pairId: string, n: number): number {
  const key = `${pairId}:${n}`;
  const known = pairCells.get(key);
  if (known !== undefined) return known;
  const choice = joinedPairById(pairId) ?? DEFAULT_JOINED_PAIR;
  const count = joinedPairCellCount({ shape: choice.shape, gon: choice.gon, n });
  pairCells.set(key, count);
  return count;
}

export function pairStateCount(pairId: string): number {
  return (joinedPairById(pairId) ?? DEFAULT_JOINED_PAIR).gon;
}

/**
 * How finely a pair may be ruled.
 *
 * The joint's own measured ceiling first, then the cost guards. Since the pair
 * went over to the contracted search the two nearly coincide: `maxN` is itself
 * now bounded by the cell limit rather than by the search running out, so what
 * stops the slider is a cell too small to print rather than a search that
 * usually fails. The effort ladder is still there for anyone who wants to push
 * past it by hand.
 */
export function maxPairN(pairId: string): number {
  const choice = joinedPairById(pairId) ?? DEFAULT_JOINED_PAIR;
  const ceiling = Math.min(KINETIC_LIMITS.pairN.max, choice.maxN);
  let best: number = KINETIC_LIMITS.pairN.min;
  for (let n = KINETIC_LIMITS.pairN.min + 1; n <= ceiling; n++) {
    const cells = pairCellCount(pairId, n);
    if (cells > KINETIC_LIMITS.pairCells) break;
    best = n;
  }
  return best;
}

/**
 * Brings a set of parameters inside the limits.
 *
 * Rings give way to sides and the grid gives way to both, because that is the
 * order in which they matter to the object: how many faces and how many rings
 * is what the mechanism *is*, while the grid is how finely it is ruled.
 */
export function clampKineticParams(p: KineticParams): KineticParams {
  const mechanism: MechanismId = p.mechanism === 'pair' ? 'pair' : 'stack';
  const sides = clamp(Math.round(p.sides), KINETIC_LIMITS.sides.min, KINETIC_LIMITS.sides.max);
  const layers = clamp(Math.round(p.layers), KINETIC_LIMITS.layers.min, maxLayers(sides));
  const rows = clamp(Math.round(p.rows), KINETIC_LIMITS.rows.min, KINETIC_LIMITS.rows.max);
  const cols = clamp(Math.round(p.cols), KINETIC_LIMITS.cols.min, maxCols({ sides, layers, rows }));
  const pair = (joinedPairById(p.pair) ?? DEFAULT_JOINED_PAIR).id;
  const pairN = clamp(Math.round(p.pairN), KINETIC_LIMITS.pairN.min, maxPairN(pair));
  // A pair has one seam, ruled into `pairN` classes, and one of them has to be
  // spent joining the halves; the stack's ceiling is a matter of taste.
  const maxK = mechanism === 'pair' ? pairN - 1 : KINETIC_LIMITS.k.max;
  return {
    mechanism,
    pair,
    pairN,
    sides,
    layers,
    cols,
    rows: clamp(rows, KINETIC_LIMITS.rows.min, maxRows({ sides, layers, cols })),
    k: clamp(Math.round(p.k), KINETIC_LIMITS.k.min, maxK),
    seed: clamp(Math.round(p.seed), KINETIC_LIMITS.seed.min, KINETIC_LIMITS.seed.max),
    showSolution: p.showSolution,
    motion: p.motion,
    autoRotate: p.autoRotate,
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
  if (params.mechanism !== d.mechanism) p.set('mech', params.mechanism);
  if (params.pair !== d.pair) p.set('pair', params.pair);
  if (params.pairN !== d.pairN) p.set('n', String(params.pairN));
  if (params.sides !== d.sides) p.set('sides', String(params.sides));
  if (params.layers !== d.layers) p.set('rings', String(params.layers));
  if (params.cols !== d.cols) p.set('cols', String(params.cols));
  if (params.rows !== d.rows) p.set('rows', String(params.rows));
  if (params.k !== d.k) p.set('k', String(params.k));
  if (params.seed !== d.seed) p.set('seed', String(params.seed));
  if (params.showSolution !== d.showSolution) p.set('solution', params.showSolution ? '1' : '0');
  if (params.motion !== d.motion) p.set('motion', params.motion ? '1' : '0');
  if (params.autoRotate !== d.autoRotate) p.set('rotate', params.autoRotate ? '1' : '0');
  if (params.effort !== d.effort) p.set('effort', String(params.effort));
  if (params.style !== d.style) p.set('style', params.style);
  const qs = p.toString();
  return qs ? '?' + qs : '';
}

export function decodeKineticParams(search: string): KineticParams {
  const p = new URLSearchParams(search);
  const d = DEFAULT_KINETIC_PARAMS;
  return clampKineticParams({
    mechanism: p.get('mech') === 'pair' ? 'pair' : 'stack',
    pair: p.get('pair') ?? d.pair,
    pairN: number(p.get('n'), d.pairN),
    sides: number(p.get('sides'), d.sides),
    layers: number(p.get('rings'), d.layers),
    cols: number(p.get('cols'), d.cols),
    rows: number(p.get('rows'), d.rows),
    k: number(p.get('k'), d.k),
    seed: number(p.get('seed'), d.seed),
    showSolution: flag(p.get('solution'), d.showSolution),
    motion: flag(p.get('motion'), d.motion),
    autoRotate: flag(p.get('rotate'), d.autoRotate),
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
