/**
 * The rings of cubes on offer, and how each one is taped.
 *
 * An object is a layout and a taping (`cube-ring.ts` does the rest), and
 * neither is a preference: of the tapings that shut into anything worth
 * holding, most cannot be folded from one shape to another at all, and which
 * ones can is decided by geometry. So these are found by search, offline, and
 * written down — `.dev/probe-fold-hunt2.ts` sweeps the tapings of a layout,
 * `.dev/probe-ring-maze.ts` puts a maze on one, `.dev/probe-ring-audit.ts`
 * checks the result without using any of this code.
 *
 * The notation is one digit a seam, in ring order: which of the four edges of
 * the shared face the tape crosses, numbered as `hingeLine` numbers them.
 */

import { createCubeRing, plankRing } from './cube-ring.ts';
import type { CubeRingMechanism, CubeRingObject, CubeRingOptions, Lattice } from './cube-ring.ts';

/** The layout the eight-cube ring is taped in: a 1x2x4 plank. */
export const PLANK_RING: readonly Lattice[] = plankRing(8);

/**
 * Which edge of each seam the tape sits on, for the eight-cube ring.
 *
 * Of the 65536 tapings of the plank, exactly eight shut into two cubes, and
 * every one of those eight shuts into four planks as well — six shapes in all
 * — and shows *completely different faces* in its two cubes.
 * `.dev/probe-infinity.ts` lists them; `.dev/probe-tape-map.ts` reads a taping
 * back as "top, bottom or which side", which is the form a pair of hands
 * needs.
 *
 * Only four of the eight can be folded from any shape to any other, and this
 * is one of them. Which four is decided by the two seams that cross from one
 * row of the plank to the other: tape those on the same face, in line with
 * each other, and the plank can be split along its length and opened, which is
 * the move that reaches the second cube. Tape them on opposite faces and only
 * three of the six shapes are reachable — `.dev/probe-taping-connectivity.ts`
 * counts it, and the taping first recommended here was one of those, chosen
 * because the search of the day happened to manage it.
 *
 * Of the four, this one is the plainest to build: each row of the plank is
 * taped top, outer side, top, and the two crossing seams at the ends are taped
 * underneath — two tapes on an awkward vertical edge rather than four. On the
 * maze it is a coin toss; all four reach a design in seven or eight tries out
 * of eight at both rulings, with the same dead ends and the same walks
 * (`.dev/probe-taping-choice.ts`).
 */
export const DEFAULT_HINGES: readonly number[] = [2, 3, 2, 3, 2, 1, 2, 3];

/**
 * Eight cubes taped into a ring — the fidget toy that folds forever.
 *
 * The one this page shipped with, and the one the literature has: it is figure
 * 8 of Demaine, Demaine, Lindy and Souvaine, *Hinged Dissection of
 * Polypolyhedra* (WADS 2005), down to "every face has at least one exposed
 * hinge". What is not in the literature is a maze on it that is perfect in
 * every shape it takes.
 */
export const INFINITY_CUBE: CubeRingObject = {
  id: 'infinity-cube',
  label: 'Eight cubes — cube and plank',
  blurb: 'Shuts into six shapes: four planks and two cubes.',
  ring: PLANK_RING,
  hinges: DEFAULT_HINGES,
  // Ten cells a face is 5.8 mm a cell with the cubes at 58 mm on A4: about as
  // small as a knife and a pair of eyes can be asked to follow.
  maxCells: 10,
};

/**
 * Twelve cubes, taped so that one of the shapes has a hole through it.
 *
 * The reason to have a second object. The eight-cube ring folds between a
 * cube and a plank, and both of those are spheres — the maze lives on a
 * surface of genus 0 either way. Twelve cubes can shut into a frame, and a
 * frame is a torus: the *same printed pattern* has to be a perfect maze on a
 * sphere and on a torus, which is not a stronger version of the same demand
 * but a different one, since a torus has a passage count of its own.
 *
 * Found by sweeping the tapings of the 2x6 plank for ones whose shapes are
 * reachable from each other by folding (`.dev/probe-fold-hunt2.ts`): five
 * shapes, no strays, and the widest range of silhouettes of anything measured
 * — a 2x6 plank, a solid 3x2x2 block, two more planks and the frame, with
 * between 32 and 46 of the 72 cube faces on show. Ten cubes is the fewest that
 * can change genus at all, and eight is provably impossible; twelve is the
 * first count where the shapes are also worth looking at.
 *
 * The price is in the tape: the longest way round is ten folds, against four
 * on the eight-cube ring.
 */
export const FRAME_RING: CubeRingObject = {
  id: 'frame-ring',
  label: 'Twelve cubes — plank, block and frame',
  blurb: 'Shuts into five shapes, one of them a frame with a hole through it.',
  ring: plankRing(12),
  hinges: [3, 0, 2, 3, 0, 1, 0, 1, 2, 0, 1, 1],
  maxCells: 10,
};

export const CUBE_RING_OBJECTS: readonly CubeRingObject[] = [INFINITY_CUBE, FRAME_RING];

export const DEFAULT_CUBE_RING = INFINITY_CUBE;

/** The object of that name, or the default if a link names one that is gone. */
export function cubeRingObject(id: string): CubeRingObject {
  return CUBE_RING_OBJECTS.find(object => object.id === id) ?? DEFAULT_CUBE_RING;
}

/** Cells across a face: what an object can be ruled into, coarsest to finest. */
export function cubeRingRulings(object: CubeRingObject): number[] {
  const rulings: number[] = [];
  for (let cells = 2; cells <= object.maxCells; cells++) rulings.push(cells);
  return rulings;
}

/**
 * The eight-cube ring, by name.
 *
 * Here because most of what asks for one asks for that one, and because a
 * taping can be handed in to try another: sweeping the tapings of a layout is
 * what found both of the objects above.
 */
export function createInfinityCube(
  options: CubeRingOptions & {
    ring?: readonly Lattice[];
    hinges?: readonly number[];
  } = {},
): CubeRingMechanism {
  const { ring, hinges, ...rest } = options;
  const object = ring || hinges
    ? {
      ...INFINITY_CUBE,
      id: `${INFINITY_CUBE.id}-${(hinges ?? DEFAULT_HINGES).join('')}`,
      ring: ring ?? PLANK_RING,
      hinges: hinges ?? DEFAULT_HINGES,
    }
    : INFINITY_CUBE;
  return createCubeRing(object, rest);
}
