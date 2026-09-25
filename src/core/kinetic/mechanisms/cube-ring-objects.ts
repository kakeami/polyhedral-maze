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
  label: '8 cubes (2 cubes, 4 planks; all faces swapped)',
  blurb: 'Shuts into six shapes, four planks and two cubes, and the two cubes show none of the same faces.',
  ring: PLANK_RING,
  hinges: DEFAULT_HINGES,
  // Ten cells a face is 5.8 mm a cell with the cubes at 58 mm on A4: about as
  // small as a knife and a pair of eyes can be asked to follow.
  maxCells: 10,
};

/**
 * Eight cubes that shut into two cubes by half turns alone, with a strip of
 * tape inside the object in every shape it takes.
 *
 * The first of three rings of eight that a census of every ring shut into a
 * 2x2x2 turned up beside the one above (`.dev/probe-cube-ring-census.ts`):
 * each has two cubes a hand can fold between, which is the question Conway
 * asked of these objects. Like Conway's own ring it has a pair of hinges in
 * the middle of the cube, and like Conway's it shuts into two more cubes that
 * no fold reaches (`strays`).
 *
 * What it asks of the maze is different from the ring above: two thirds of
 * the squares on show in one cube are on show in the other, so the two cubes
 * share most of a maze and swap a third of it. Four folds from cube to cube,
 * every one a half turn.
 *
 * It cannot be taped lying flat. Its hinges run down the middle of every
 * plank it makes, so it is laid out as two rows of four, one set on the other
 * a row across, and taped there; the strips inside the finished cube are why
 * the tape only has to be reachable where it goes on.
 */
export const HALF_TURN_RING: CubeRingObject = {
  id: 'half-turn-ring',
  label: '8 cubes (2 cubes, 2 planks; a third swapped by half turns)',
  blurb: 'Shuts into two cubes and two planks by half turns, and the two cubes swap a third of their faces.',
  ring: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [3, 1, 1], [2, 1, 1], [1, 1, 1], [0, 1, 1]],
  hinges: [2, 1, 2, 0, 3, 0, 3, 0],
  maxCells: 10,
  tapeReachable: 'layout',
};

/**
 * Eight cubes taped on the plank, which reach a cube only by quarter turns.
 *
 * The same layout as the infinity cube and a different taping, and the motion
 * is not the same at all: each plank is two half turns from one cube, and
 * from one cube to the other is six folds, four of them quarter turns, through
 * the flat diamond `DIAMOND_RING` is taped in and past no plank. The two cubes
 * swap a third of their faces, as the half-turn ring's do, and get there by a
 * motion a hand has to learn separately.
 *
 * Found by the same census. It is taped flat, and each cube shuts with its
 * tape inside.
 */
export const QUARTER_TURN_RING: CubeRingObject = {
  id: 'quarter-turn-ring',
  label: '8 cubes (2 cubes, 2 planks; a third swapped by quarter turns)',
  blurb: 'Taped on the plank like the first, it goes from cube to cube by quarter turns, and the two cubes swap a third of their faces.',
  ring: PLANK_RING,
  hinges: [2, 3, 2, 2, 2, 1, 2, 0],
  maxCells: 10,
  tapeReachable: 'layout',
};

/**
 * Eight cubes taped as a diamond: two cubes with the same faces on show.
 *
 * Laid out flat, the ring is a diamond whose corners meet edge to edge rather
 * than face to face, so it cannot be set down as a shape of its own — it is
 * only where the tape goes on. It shuts into two cubes that show exactly the
 * same squares, put together differently: the same printed squares are the
 * outside of both, and only how they meet changes — the opposite of the
 * infinity cube, where no square is on show in both.
 *
 * Found by the same census, which also says the ring has a second pair of
 * cubes and planks that no fold from the diamond reaches (`strays`): there are
 * two ways to shut it, and the layout chooses one.
 */
export const DIAMOND_RING: CubeRingObject = {
  id: 'diamond-ring',
  label: '8 cubes (2 cubes, 2 planks; no faces swapped)',
  blurb: 'Taped flat as a diamond, it shuts into two cubes that show the same faces, put together differently.',
  ring: [[1, 0, 0], [2, 0, 0], [3, 1, 0], [3, 2, 0], [2, 3, 0], [1, 3, 0], [0, 2, 0], [0, 1, 0]],
  hinges: [2, 0, 1, 0, 2, 0, 1, 0],
  maxCells: 10,
  tapeReachable: 'layout',
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
  label: '12 cubes (1 frame, 1 block, 3 planks; most silhouettes)',
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
  label: '10 cubes (2 frames, 1 plank; fewest cubes for a hole)',
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
  label: '12 cubes (1 frame, 1 plank, 1 block; widest swing in faces shown)',
  blurb: 'Shuts into three shapes, and shows half as much again of itself in one as in another.',
  ring: rectRing(4, 4),
  hinges: [2, 0, 2, 2, 0, 2, 3, 0, 3, 0, 1, 0],
  maxCells: 10,
};

/**
 * Twelve cubes round the 4 by 4 frame that fold round in a loop: frame, block,
 * plank, plank, and back to the frame.
 *
 * The same layout as `SQUARE_FRAME` and the same three silhouettes, taped so
 * that the shapes form a ring instead of a path. From the frame, three folds
 * shut it into a solid 3 by 2 by 2 block; one opens the block into a 2 by 6
 * plank; one turns that plank into the other plank; and three open the second
 * plank back into the frame — eight folds round, and no shape more than four
 * from any other. It is not two flips side by side: the opposite sides of that
 * square turn different arcs of the ring, so a hand goes round it rather than
 * back and forth.
 *
 * Found by building the loop from the block rather than sweeping tapings
 * (`.dev/probe-cycle-hunt.ts`): a strip of tape is placed only when a fold
 * needs it, on that fold's line. Six of the twelve seams are fixed by the
 * loop; of the ways to tape the other six, this one has the fewest open shapes
 * in between — forty, where the rest run to nearly three hundred — so the
 * object has the least play and no stray shape.
 *
 * The genus changes on the way round, frame to block, and the faces on show
 * swing from 48 to 32 of the 72. Folded shut, some strips are pressed between
 * cubes, so like the other rings with a buried strip it is taped where it is
 * laid out, as the frame.
 */
export const FRAME_LOOP: CubeRingObject = {
  id: 'frame-loop',
  label: '12 cubes (1 frame, 1 block, 2 planks; folds round in a loop)',
  blurb: 'Folds from a frame to a block, a plank, another plank and back to the frame, round and round.',
  ring: rectRing(4, 4),
  hinges: [3, 0, 3, 1, 1, 1, 1, 0, 1, 2, 1, 0],
  maxCells: 10,
  tapeReachable: 'layout',
};

/**
 * The objects on offer, fewest cubes first.
 *
 * Every one of them goes round a loop, which is what the page is for: the
 * rings of eight between two cubes and their planks, and the ring of twelve
 * between a frame, a block and two planks. The four rings of eight fold
 * between the same two silhouettes and differ in what the fold does to the
 * surface: every face swapped between the two cubes, a third of them by half
 * turns, a third by quarter turns, or none at all.
 *
 * The label says it in that order — how many pieces, what it shuts into, and
 * the one thing it is here for — so the list reads as a table.
 */
export const CUBE_RING_OBJECTS: readonly CubeRingObject[] = [
  INFINITY_CUBE, HALF_TURN_RING, QUARTER_TURN_RING, DIAMOND_RING, FRAME_LOOP,
];

/**
 * Objects the page used to offer, kept so they can still be built and tested.
 *
 * Their shapes form a path or a tree rather than a loop, so they are no longer
 * listed; a link that names one lands on the default object.
 */
export const ARCHIVED_CUBE_RINGS: readonly CubeRingObject[] = [
  SMALLEST_FRAME, SQUARE_FRAME, FRAME_RING,
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
