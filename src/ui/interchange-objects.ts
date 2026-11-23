/**
 * What the interchange page offers, and which of an object's shapes are
 * walked in.
 *
 * The same rings of cubes as the folding page, and for now one of them: the
 * maze here is a different printing from the folding maze — no shape is a
 * perfect maze on its own — and it has been worked out on the infinity cube
 * first.
 *
 * Which shapes are walked in is the older of the two rules a ring has been
 * read by: a solid block or one layer thick (`boxOrLayer`). A hand stops at
 * the shapes halfway between two of those as well — a plank with one end
 * folded back over it — and a fold on a mark passes through them; a mark on
 * show before and after is on show there too. Walking in them as well would
 * let a finger go round without taking a step, on two thirds of the surface:
 * cube, hook, plank, the other hook, and back to the cube, all on one mark.
 */

import { INFINITY_CUBE, cubeRingRulings } from '../core/kinetic/mechanisms/cube-ring-objects.ts';
import { boxOrLayer } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { CubeRingMechanism, CubeRingObject } from '../core/kinetic/mechanisms/cube-ring.ts';

export const INTERCHANGE_OBJECT: CubeRingObject = INFINITY_CUBE;

/** Cells across a face, coarsest to finest. */
export function interchangeRulings(): number[] {
  return cubeRingRulings(INTERCHANGE_OBJECT);
}

/** The shapes that are walked in, as states of the mechanism. */
export function walkedStates(mech: CubeRingMechanism): number[] {
  const states: number[] = [];
  mech.poses.forEach((pose, state) => {
    if (boxOrLayer(pose.span, mech.pieceCount)) states.push(state);
  });
  return states;
}
