/**
 * The rings of prisms on offer, and how each one is taped.
 *
 * An object is a honeycomb, a layout and a taping (`honeycomb-ring.ts` does the
 * rest), and none of the three is a preference. Of the tapings that shut into
 * anything worth holding, most cannot be folded from one shape to another at
 * all — on these honeycombs far fewer than on the cubic one, because a fold
 * needs two coaxial hinges and prisms do not hand those out. So these are
 * found by search, offline, and written down: `.dev/probe-honeycomb-objects.ts`
 * sweeps the tapings of a layout *through this code*, and
 * `.dev/probe-honeycomb-reach.ts` is the independent sweep that found them
 * first.
 *
 * The notation is one digit a seam, in ring order: which edge of the shared
 * face the tape crosses, numbered as that face's own loop numbers them.
 *
 * What these objects are *for*, next to the four rings of cubes:
 *
 * - **the genus changes with six pieces.** Ten cubes is the fewest that can
 *   manage it and that was proved exhaustively
 *   (`.dev/2026-09-17-genus-change.md`); six hexagonal prisms do it, because a
 *   hexagon's neighbours ring it without a gap and six of them already
 *   surround a hole.
 * - **the fold is not a right angle.** A hexagonal prism turns by a third of a
 *   turn about a vertical edge, and no ring of cubes turns by anything but a
 *   quarter.
 * - **burying a face is not one price.** A hexagonal prism carries six times
 *   as many cells on a hexagon as on a square, so shutting one buries six
 *   times the maze — 384 cells on show in one pose against 240 in another,
 *   two fifths of the object, where the cube rings swing by an eighth.
 */

import type { HoneycombRingObject } from './honeycomb-ring.ts';
import { createHoneycombRing, hexPrismHole } from './honeycomb-ring.ts';
import type { HoneycombRingMechanism, HoneycombRingOptions } from './honeycomb-ring.ts';

/**
 * Six hexagonal prisms round a hole, taped so that it opens into blocks.
 *
 * The reference layout already has a hole through it, so the reference pose is
 * a torus and the maze is printed on a genus-1 surface; folded shut it is two
 * layers of three with no hole at all, which is a sphere. The *same printed
 * pattern* has to be a perfect maze on both, which is what the twelve-cube
 * ring does with twice the pieces.
 *
 * Five states over four silhouettes, no strays, three folds from any shape to
 * any other. One of the blocks is a triangle two layers deep, and it is the
 * one the object cannot avoid: every route to the fourth block goes through
 * it. It is also the shape that buries the most — 30 of the 48 faces on show
 * against 34 for the other blocks and 36 for the ring — and the one where a
 * strip of tape is pinched between four prisms, which is what
 * `honeycombRingShape` has to say about where a tape rule belongs.
 *
 * Of the 4096 tapings of this layout, 512 fold at all and every one of those
 * changes genus — the hole is in the layout, so anything that can be folded
 * out of it changes genus by definition. This one is the best of them by the
 * measure the cube rings were chosen on, and by the one that settled it there:
 * silhouettes rather than states.
 */
export const HEX_RING: HoneycombRingObject = {
  id: 'hex-ring',
  label: '6 hexagonal prisms · 1 ring, 4 blocks · fewest pieces for a hole',
  blurb: 'A ring with a hole through it, and the four blocks it shuts into.',
  honeycomb: 'hexprism',
  ring: hexPrismHole(),
  hinges: [2, 0, 1, 2, 2, 1],
  // A sheet holds one piece and the pattern prints it as large as it can: a
  // prism of 42.9 mm a side, with the net turned to suit the paper (measured,
  // `.dev/probe-honeycomb-sheets.ts`). Eight cells across a face is then
  // 5.4 mm a cell, and nine would be 4.8 — under the 5 mm a craft knife can
  // follow, which is where the pattern refuses to print at all.
  maxCells: 8,
};

/**
 * The objects on offer.
 *
 * One, for now. A ring of six triangular prisms was built here as well — the
 * six wedges of a hexagonal prism, folding by a sixth of a turn into a block,
 * which is a motion no ring of cubes has — and it was dropped: two states is
 * all that layout can reach (every hinge sits round the one lattice vertex, so
 * the only line two of them can share is the central edge and the six wedges
 * bury it), the two shapes are a plate and a lump, and on screen it was
 * broken. The layout is still here as `prismHexagon`, with what it measured,
 * because it is the shape a triangular prism honeycomb most wants to be asked
 * for and the answer is worth having written down.
 */
export const HONEYCOMB_RING_OBJECTS: readonly HoneycombRingObject[] = [HEX_RING];

export const DEFAULT_HONEYCOMB_RING = HEX_RING;

/** The object of that name, or the default if a link names one that is gone. */
export function honeycombRingObject(id: string): HoneycombRingObject {
  return HONEYCOMB_RING_OBJECTS.find(object => object.id === id) ?? DEFAULT_HONEYCOMB_RING;
}

/** Cells across a face: what an object can be ruled into, coarsest to finest. */
export function honeycombRingRulings(object: HoneycombRingObject): number[] {
  const rulings: number[] = [];
  for (let cells = 2; cells <= object.maxCells; cells++) rulings.push(cells);
  return rulings;
}

/** The hexagonal-prism ring, by name — most of what asks wants that one. */
export function createHexRing(options: HoneycombRingOptions = {}): HoneycombRingMechanism {
  return createHoneycombRing(HEX_RING, options);
}
