/**
 * Absolute millimetre styling for the folding maze's pattern.
 *
 * Built on the rings' styling, which is the same drawing at a different size,
 * and differs only where the size does. A cube's cell is about 20 mm across —
 * twice a ring's — so the lines are drawn heavier in proportion, and the two
 * things the rings have no equivalent of get their own entries: the tape that
 * hinges one cube to the next, and the diagrams that say which cube is which.
 */

import type { RGB } from './face-page-constants.ts';
import { STACK_SHEET_STYLE } from './kinetic-sheet-constants.ts';

export const FOLD_SHEET_STYLE = {
  ...STACK_SHEET_STYLE,

  /** A cell here is twice a ring's, so the walls are drawn to match. */
  wallWidth: 0.7,
  boundaryWidth: 1.4,
  /** Half the rim width, so a rim wall on a cut has its outer edge on the cut. */
  boundaryInset: 0.7,
  markerTextSize: 5,

  /**
   * The tape: where a cube is hinged to the next one round the ring.
   *
   * Drawn as a bar lying just outside the cut line, along the edge the tape
   * goes on, with the number of the cube at the other end of it. Outside,
   * because the model carries no writing — everything printed inside the cut
   * line is maze. It is therefore a mark for the bench rather than for the
   * finished object, which is why the first sheet draws the whole plank as
   * well: by the time the eight cubes are built, these have been cut away.
   */
  tapeColor: [200, 120, 0] as RGB,
  tapeWidth: 1.8,
  tapeLabelSize: 3.0,

  /** The plank diagrams: which cube is which, and which way up. */
  diagramLabelColor: [140, 140, 140] as RGB,
  diagramLabelSize: 3.2,
  diagramNumberColor: [190, 190, 190] as RGB,
  diagramNumberSize: 7,
} as const;

export const FOLD_SHEET_DEFAULTS = {
  /** Glue tab on the cube net. Seven of them close a cube. */
  tabMm: 8,
  /** Clearance between two folded tabs meeting at a corner. */
  tabClearanceMm: 0.6,
  /**
   * How far a crease tick stands off the net, for the one fold of the cross
   * that the outline does not already name. Every other crease runs between
   * two notches in the cut line and needs no mark at all.
   */
  tickMm: 3.5,
  tickWidth: 0.35,
  /**
   * Smallest cube worth printing, with three cells across a face: below this a
   * cell is under a centimetre and the walls are closer together than the
   * knife. A ruling that cannot be printed this size is refused rather than
   * shrunk.
   */
  minEdgeMm: 36,
  /**
   * Room above the net: the title, the line under it, and clear air for the
   * tape marks, which stand off the top of the net and would otherwise be
   * printed through the writing.
   */
  headerMm: 20,
  /** How far a tape bar stands off the edge it marks, and its label beyond it. */
  tapeStandMm: 1.5,
  tapeLabelStandMm: 4.5,
  gapMm: 7,
  /** A cube in the layout diagrams: as large as four views leave room for. */
  diagramEdgeMm: 28,
  /**
   * How small those may be shrunk when the layout is tall rather than long.
   *
   * A frame of ten or twelve cubes is four cells deep and its views are four
   * times as tall as a plank's, so they are shelved two to a row and drawn
   * smaller (`packDiagrams`). This is where that stops: below it the numbering
   * is no longer a diagram anyone can match a cube against, and a layout that
   * needed it would be better given a sheet of its own.
   */
  minDiagramEdgeMm: 14,
} as const;
