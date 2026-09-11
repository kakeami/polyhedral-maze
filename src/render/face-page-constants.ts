/**
 * Visual constants for the printed pieces and the panels that hold them.
 *
 * Unlike `svg-constants.ts` — whose widths are ratios of the net's bounding
 * box — every value here is an absolute millimetre length, because face pages
 * are printed at a fixed physical scale.
 */

export type RGB = [number, number, number];

/**
 * Line weights are set for a piece printed at ~113 mm to the edge, which is a
 * far bigger drawing than the whole-net sheet: at the net's proportions the
 * same lines come out spidery on a page this size. Cut guide, wall and
 * boundary keep their 1 : 2 : 6 ratio to each other.
 */
export const FACE_PAGE_STYLE = {
  // Cut guide: dashed, straight on the piece outline so cutting it gives the
  // piece its exact size. Mostly hidden under the boundary wall, which is why
  // that wall is inset — see `boundaryInset`.
  cutColor: [150, 150, 150] as RGB,
  cutWidth: 0.3,
  cutDash: [1.6, 1.2] as [number, number],

  // Walls
  wallColor: [34, 34, 34] as RGB,
  wallWidth: 0.6,
  boundaryColor: [0, 0, 0] as RGB,
  boundaryWidth: 1.8,
  /**
   * Half the boundary width, so the wall's *outer* edge lands exactly on the
   * cut line: "cut along the outside of the black border" is then exact.
   * Offsetting the guide outward instead would make every piece a millimetre
   * too big on every side, which accumulates badly over a hundred pieces.
   */
  boundaryInset: 0.9,

  // Cell markers
  startColor: [178, 240, 178] as RGB,
  goalColor: [240, 178, 178] as RGB,
  warpColor: [240, 232, 178] as RGB,
  labelColor: [85, 85, 85] as RGB,
  labelInradiusScale: 1.2,

  // Edge labels: which face this edge joins
  edgeLabelColor: [60, 60, 60] as RGB,
  edgeLabelSize: 3.4,
  /** Far enough out that the label's rule cannot be read as part of the cut line. */
  edgeLabelOffset: 4.2,
  /** Appended to the label of a seam between coplanar faces (butt-join, no fold). */
  flatSeamMark: '~',

  // Locator diagram (whole net in miniature, this piece highlighted)
  locatorColor: [175, 175, 175] as RGB,
  locatorWidth: 0.1,
  locatorHighlight: [55, 55, 55] as RGB,
  /** Face ids in the locator, so the diagram reads as a map and not just a blob. */
  locatorLabelColor: [110, 110, 110] as RGB,
  /** On the filled face, where a grey number would disappear. */
  locatorLabelHighlightColor: [255, 255, 255] as RGB,
  locatorLabelScale: 0.95,
  locatorLabelMaxWidthRatio: 1.7,
  /**
   * Below this (mm of font size, ≈ 3.4 pt) a number is ink, not information:
   * a net of a hundred faces simply has no room for one in a 52 mm diagram,
   * and the full-size index sheet is where you look it up instead.
   */
  locatorLabelMinSize: 1.2,
} as const;

/**
 * Panels — several pieces to a sheet.
 *
 * Nothing here changes the printed size of a piece; these are the millimetres
 * of paper around it. The rule that frames a panel is solid and light so that
 * it reads as a page border and never as the dashed cut guide, and the gutter
 * keeps two cut lines a comfortable distance apart even though their panels
 * touch.
 */
export const FACE_SHEET_STYLE = {
  /** Top strip for the one-line print warning. */
  noteBand: 5,
  /** Bottom strip for the footer line. */
  footerBand: 7,
  /**
   * Gap between panels. With the label ring inside each panel this leaves
   * ~21 mm of paper between neighbouring cut lines — enough that cutting one
   * piece out does not endanger the next.
   */
  gutter: 5,
  frameColor: [170, 170, 170] as RGB,
  frameWidth: 0.25,
  /** Padding between a panel's rule and what sits in its header. */
  framePad: 2.5,

  /**
   * Header band: title on the left, locator on the right. It grows with the
   * panel so a big piece gets a big diagram, within these bounds — the upper
   * one matching the header of the full-page layout.
   */
  headerRatio: 0.14,
  headerMax: 30,
  /**
   * Floors for the header, tried in this order: the packer keeps the most
   * generous one that does not cost a sheet. A short piece would otherwise be
   * given a header sized for its own small body, and its locator would shrink
   * to a speck — but only the *last* row of panels on a sheet is ever short of
   * room, so most of the time the roomier header is free.
   */
  headerMinChoices: [18, 16, 14, 12],
  /** A panel narrower than this is widened so its header still holds both. */
  minFrameW: 48,

  titleColor: [34, 34, 34] as RGB,
  titleRatio: 0.32,
  titleMin: 2.8,
  titleMax: 4.6,

  locatorMaxW: 52,
  locatorWidthRatio: 0.45,
} as const;
