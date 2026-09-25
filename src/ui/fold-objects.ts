/**
 * What the folding page offers: rings of cubes, and — kept, no longer listed —
 * a ring of prisms.
 *
 * Two mechanisms, one page, because to a visitor they are one object with a
 * different solid in it — a closed ring of hinged pieces, folded by hand, with
 * a maze that is perfect in every shape it takes. The panel asks the same
 * questions of both (which object, how finely ruled, which maze, which shape)
 * and the 3D view drives both from `Mechanism` alone, so all this has to do is
 * hand over the right catalogue and build the right mechanism.
 *
 * What is *not* shared is the printed pattern, which is two files for the same
 * reason: a ring of cubes prints from `fold-sheet-model.ts`, which knows a
 * cube's 24 nets and draws the object in four views, and a ring of prisms from
 * `honeycomb-sheet-model.ts`, which unfolds its piece like any other solid
 * (`piece-net-model.ts`) and draws the layout from above. Both print one piece
 * a sheet with a sheet of notes in front, so the panel only has to name which
 * comes out.
 */

import {
  CUBE_RING_OBJECTS, DEFAULT_CUBE_RING, cubeRingRulings,
} from '../core/kinetic/mechanisms/cube-ring-objects.ts';
import { createCubeRing } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { CubeRingMechanism, CubeRingObject } from '../core/kinetic/mechanisms/cube-ring.ts';
import { honeycombRingRulings } from '../core/kinetic/mechanisms/honeycomb-ring-objects.ts';
import { createHoneycombRing } from '../core/kinetic/mechanisms/honeycomb-ring.ts';
import type {
  HoneycombRingMechanism, HoneycombRingObject,
} from '../core/kinetic/mechanisms/honeycomb-ring.ts';

/** An object the page can offer, whichever mechanism it belongs to. */
export type FoldObject = CubeRingObject | HoneycombRingObject;
export type FoldMechanism = CubeRingMechanism | HoneycombRingMechanism;

/** What the panel needs of an object: a name, a label and a line about it. */
export interface FoldObjectSummary {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
}

/**
 * The objects the page offers: the rings of cubes whose shapes go round a loop.
 *
 * The ring of six hexagonal prisms is no longer among them — its blocks go
 * round a loop too, but that loop is two independent flips side by side, and
 * the ring itself hangs off it — so it stays in `HONEYCOMB_RING_OBJECTS`, built
 * and tested but not listed. Everything below still knows how to build and
 * print a ring of prisms, which is what keeping it means.
 */
export const FOLD_OBJECTS: readonly FoldObject[] = [...CUBE_RING_OBJECTS];

export const DEFAULT_FOLD_OBJECT: FoldObject = DEFAULT_CUBE_RING;

/** Whether this one is a ring of prisms: the design cache and the pattern ask. */
export function isPrismRing(object: FoldObject): object is HoneycombRingObject {
  return 'honeycomb' in object;
}

/**
 * Whether this mechanism is a ring of cubes, which is what has a pattern.
 *
 * On the mechanism rather than on the object, because narrowing the object
 * narrows nothing about what holds it: the pattern needs the *mechanism*.
 */
export function isCubeRingMechanism(mech: FoldMechanism): mech is CubeRingMechanism {
  return !isPrismRing(mech.object);
}

/** The object of that name, or the default if a link names one that is gone. */
export function foldObject(id: string): FoldObject {
  return FOLD_OBJECTS.find(object => object.id === id) ?? DEFAULT_FOLD_OBJECT;
}

/** Cells across a face: what an object can be ruled into, coarsest to finest. */
export function foldRulings(object: FoldObject): number[] {
  return isPrismRing(object) ? honeycombRingRulings(object) : cubeRingRulings(object);
}

export function createFoldMechanism(
  object: FoldObject,
  options: { cells: number },
): FoldMechanism {
  return isPrismRing(object)
    ? createHoneycombRing(object, options)
    : createCubeRing(object, options);
}
