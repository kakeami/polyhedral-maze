/**
 * Absolute millimetre styling for the kinetic pieces.
 *
 * Like `face-page-constants.ts` and unlike `svg-constants.ts`, every value is a
 * real length: a kinetic piece is printed at a fixed scale because it has to
 * fit a wooden dowel of a fixed diameter. The drawing is far smaller than a
 * face page — a cell is a centimetre, not a tenth of a piece — so the lines are
 * lighter here.
 */

import type { RGB } from './face-page-constants.ts';

export const STACK_SHEET_STYLE = {
  /** Maze walls inside a face. */
  wallColor: [17, 17, 17] as RGB,
  wallWidth: 0.5,

  /**
   * Maze walls on an edge of a face — the rim of the finished piece.
   *
   * Heavier than an interior wall, as on the net PDF, because it is not the
   * same thing: an interior wall is a line the solver may not cross, a rim
   * wall is also a fold or a cut the builder has to find. Twice the interior
   * weight — nearer the net PDF's 1.6 than the face pages' 3, because a
   * kinetic cell is a centimetre where a face page's is three, and a rim as
   * bold as a face page's would be a fifth of the cell it borders.
   */
  boundaryColor: [0, 0, 0] as RGB,
  boundaryWidth: 1,
  /**
   * Half the rim width, so a rim wall on a *cut* edge has its outer edge
   * exactly on the cut line — "cut along the outside of the black border" is
   * then true, and the piece comes out its stated size rather than a
   * millimetre over on every side. Rim walls on folds are not inset: the paper
   * carries on there and the wall belongs astride the crease.
   */
  boundaryInset: 0.5,

  /**
   * Blank paper. A piece is filled with it before anything is drawn on it, so
   * that a glue tab reaching across the piece laid out beside it in the net
   * goes under that piece rather than over its maze — the net PDF's own answer
   * to the same problem.
   */
  paperColor: [255, 255, 255] as RGB,

  /** Cut outline of a piece: dashed, and the piece's exact size. */
  cutColor: [150, 150, 150] as RGB,
  cutWidth: 0.25,
  cutDash: [1.6, 1.2] as [number, number],

  /**
   * Fold marks: the bulkhead's edges, and the ticks that stand for a band's
   * creases.
   *
   * No fold is ever drawn *across* a piece that carries maze. The line would
   * have to run through every passage that crosses it, and a line across an
   * opening reads as a wall — which is why the net PDF of a solid draws no
   * crease at all, and why a band's creases are marked outside the cut guide
   * instead. A bulkhead carries no maze, so its edges are drawn in full.
   */
  foldColor: [120, 160, 200] as RGB,
  foldWidth: 0.2,
  foldDash: [0.8, 1.2] as [number, number],
  /** How far a crease tick stands off the band, and how heavy it is drawn. */
  creaseTickMm: 2.5,
  creaseTickWidth: 0.3,

  /**
   * Glue areas: tabs on the band, the halves and the bulkheads.
   *
   * A pale fill and no outline at all, exactly as on the net PDF. An outlined
   * tab has to say which of its two long sides is the cut and which is the
   * fold and cannot; a filled one shows its own silhouette, and where a tab
   * falls against a neighbouring piece in the net the piece is simply drawn
   * over it.
   */
  glueFill: [224, 224, 224] as RGB,

  startColor: [178, 240, 178] as RGB,
  goalColor: [240, 178, 178] as RGB,
  markerTextColor: [40, 40, 40] as RGB,
  markerTextSize: 3.2,

  titleColor: [0, 0, 0] as RGB,
  titleSize: 4.6,
  labelColor: [85, 85, 85] as RGB,
  labelSize: 3.4,
  noteColor: [110, 110, 110] as RGB,
  noteSize: 2.9,
  noteLeading: 4.0,
} as const;

export const STACK_SHEET_DEFAULTS = {
  /** One maze cell. 10 mm puts a 6-gon of 3 columns a face at a 60 mm barrel. */
  cellMm: 10,
  /**
   * Smallest cell worth printing. Below this the walls are closer together
   * than a craft knife is wide, and the band cannot be cut by hand at all —
   * which is the only way these are made. A barrel that needs cells smaller
   * than this does not get a smaller drawing, it gets turned down.
   */
  minCellMm: 5,
  /** A 6 mm wooden dowel is the common hardware-shop size. */
  dowelMm: 6,
  /** Slack so the layers turn freely rather than binding on the dowel. */
  dowelClearanceMm: 0.8,
  /** Glue tab that closes the band into a ring. */
  bandTabMm: 8,
  /** Tabs that hold a bulkhead inside the band. */
  bulkheadTabMm: 7,
  /** Taper on the band's single glue tab, which has no neighbour to foul. */
  tabTaperMm: 2,
  /** Clearance between two folded bulkhead tabs meeting at a corner. */
  tabClearanceMm: 0.6,
  /**
   * How much smaller a bulkhead is than the band it sits in. Two thicknesses of
   * thin card: without it the disc is exactly as wide as the ring and will not
   * go in.
   */
  bulkheadInsetMm: 0.6,
  /** Gap between pieces on a sheet. */
  gapMm: 8,
} as const;

/** The page a pattern is laid out on, in millimetres. */
export interface SheetBox {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}

export const A4_SHEET: SheetBox = { width: 210, height: 297, margin: 10 };
