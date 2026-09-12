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
  /** Maze walls. */
  wallColor: [17, 17, 17] as RGB,
  wallWidth: 0.5,

  /** Cut outline of a piece: dashed, and the piece's exact size. */
  cutColor: [150, 150, 150] as RGB,
  cutWidth: 0.25,
  cutDash: [1.6, 1.2] as [number, number],

  /** Score lines: where the band folds into the prism's edges. */
  foldColor: [120, 160, 200] as RGB,
  foldWidth: 0.2,
  foldDash: [0.8, 1.2] as [number, number],

  /** Glue areas: tabs on the band and on the bulkheads. */
  glueColor: [150, 150, 150] as RGB,
  glueWidth: 0.25,

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

export const A4_SHEET = { width: 210, height: 297, margin: 10 } as const;
