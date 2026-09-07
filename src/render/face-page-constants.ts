/**
 * Visual constants for one-face-per-page output.
 *
 * Unlike `svg-constants.ts` — whose widths are ratios of the net's bounding
 * box — every value here is an absolute millimetre length, because face pages
 * are printed at a fixed physical scale.
 */

export type RGB = [number, number, number];

export const FACE_PAGE_STYLE = {
  // Cut guide: dashed, straight on the piece outline so cutting it gives the
  // piece its exact size. Mostly hidden under the boundary wall, which is why
  // that wall is inset — see `boundaryInset`.
  cutColor: [150, 150, 150] as RGB,
  cutWidth: 0.15,
  cutDash: [1.6, 1.2] as [number, number],

  // Walls
  wallColor: [34, 34, 34] as RGB,
  wallWidth: 0.3,
  boundaryColor: [0, 0, 0] as RGB,
  boundaryWidth: 0.9,
  /**
   * Half the boundary width, so the wall's *outer* edge lands exactly on the
   * cut line: "cut along the outside of the black border" is then exact.
   * Offsetting the guide outward instead would make every piece a millimetre
   * too big on every side, which accumulates badly over a hundred pieces.
   */
  boundaryInset: 0.45,

  // Cell markers
  startColor: [178, 240, 178] as RGB,
  goalColor: [240, 178, 178] as RGB,
  warpColor: [240, 232, 178] as RGB,
  labelColor: [85, 85, 85] as RGB,
  labelInradiusScale: 1.2,

  // Edge labels: which face this edge joins
  edgeLabelColor: [60, 60, 60] as RGB,
  edgeLabelSize: 3.4,
  edgeLabelOffset: 3.6,
  /** Appended to the label of a seam between coplanar faces (butt-join, no fold). */
  flatSeamMark: '~',

  // Locator diagram (whole net in miniature, this piece highlighted)
  locatorColor: [175, 175, 175] as RGB,
  locatorWidth: 0.1,
  locatorHighlight: [55, 55, 55] as RGB,
} as const;
