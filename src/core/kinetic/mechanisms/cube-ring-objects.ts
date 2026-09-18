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

import { createCubeRing, plankRing, rectRing } from './cube-ring.ts';
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
  label: 'Eight cubes — two cubes and four planks',
  blurb: 'Shuts into six shapes, four planks and two cubes.',
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
  label: 'Twelve cubes — a frame, a block and three planks',
  blurb: 'Shuts into five shapes, one of them a frame with a hole through it.',
  ring: plankRing(12),
  hinges: [3, 0, 2, 3, 0, 1, 0, 1, 2, 0, 1, 1],
  maxCells: 10,
};

/**
 * Ten cubes, which is the fewest that can shut into a frame at all.
 *
 * The same demand as the twelve-cube rings — one printed pattern, perfect on a
 * sphere and perfect on a torus — asked of the smallest object that can make
 * it. Eight cubes cannot, and that is exhaustive rather than unlucky: a pose
 * of genus 1 has to be flat, the only flat ring of eight cells with a hole in
 * it is the 3 by 3 annulus, and of its 65536 tapings 3896 shut into a shape of
 * genus 0 as well while *none* of them can be folded from the one to the other
 * (`.dev/probe-fold-hunt2.ts`). Ten cubes can: 396 of the 1048576 tapings of
 * the 3 by 4 frame fold between the genera.
 *
 * This is the best of those — three shapes and no strays, which is as much as
 * ten cubes manage while changing genus. Two of the three are the frame, built
 * two ways round: the same silhouette with different squares buried, which is
 * a different state and a different maze on show. The third is a 2 by 5 plank.
 * Six folds from end to end, and eleven sheets to print rather than thirteen.
 */
export const SMALLEST_FRAME: CubeRingObject = {
  id: 'smallest-frame',
  label: 'Ten cubes — two frames and a plank',
  blurb: 'Shuts into three shapes, two of them a frame — the fewest cubes that can.',
  ring: rectRing(3, 4),
  hinges: [2, 0, 1, 0, 1, 0, 2, 3, 0, 3],
  maxCells: 10,
};

/**
 * Twelve cubes taped on the frame itself: three shapes, as unlike one another
 * as this mechanism gets.
 *
 * The same twelve cubes as `FRAME_RING` and a different object, because the
 * layout the tape goes on is part of what an object is. Taped round the 4 by 4
 * frame it shuts into three shapes rather than five — the frame, a 2 by 6
 * plank and a solid 3 by 2 by 2 block — and they show 48, 40 and 32 of the 72
 * cube faces. The block shows two thirds of what the frame does — 128 cells
 * against 192 at two across a face — and that is the widest swing of anything
 * here, so nothing else asks the one printed pattern to be a perfect maze over
 * as wide a range of passage counts.
 *
 * Against the five-shape ring it trades shapes for tape. Four folds reach
 * anything from anything, where that one takes ten, and the tape is what wears
 * out first on an object that is meant to be folded all evening. It also has
 * the one thing here that cannot be taped where it is laid out: two of its
 * twelve strips are pressed into the frame's own corners, so the pattern says
 * to lay the cubes out as the plank and tape them there (`fold-sheet-model`).
 */
export const SQUARE_FRAME: CubeRingObject = {
  id: 'square-frame',
  label: 'Twelve cubes — a frame, a plank and a block',
  blurb: 'Shuts into three shapes, and shows half as much again of itself in one as in another.',
  ring: rectRing(4, 4),
  hinges: [2, 0, 2, 2, 0, 2, 3, 0, 3, 0, 1, 0],
  maxCells: 10,
};

/**
 * The objects on offer, fewest cubes first.
 *
 * Each is here for a silhouette the others do not have: eight cubes for the
 * cube and the plank, ten for the smallest frame there is, twelve for the
 * widest swing between one shape and the next and for the most shapes. Three
 * counts and four objects, because what an object does is decided by how it is
 * laid out and taped rather than by how many cubes are in it: two of these are
 * twelve cubes and neither folds like the other.
 *
 * What is *not* a reason to be here is a large number of poses. Ten cubes can
 * be taped to shut sixteen ways — exactly one taping does, and it is the most
 * any ten cubes have (`.dev/probe-fold-most.ts`, 6.3 million tapings,
 * exhaustive) — but all sixteen of those shapes are the same flat five-by-four
 * blob with the same 38 faces on show, so folding it changes which squares are
 * out and nothing a hand can feel. Counting states is not counting shapes, and
 * the shapes are what this is for.
 */
export const CUBE_RING_OBJECTS: readonly CubeRingObject[] = [
  INFINITY_CUBE, SMALLEST_FRAME, SQUARE_FRAME, FRAME_RING,
];

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
