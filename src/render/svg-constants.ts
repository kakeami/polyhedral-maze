/** Visual constants for SVG net rendering. All ratio values are relative to layout.width. */
export const SVG_STYLE = {
  // Layout
  tabWidthRatio: 0.025,
  marginRatio: 0.03,

  // Outline
  outlineColor: '#dddddd',
  outlineWidthRatio: 0.002,
  outlineDashRatios: [0.006, 0.004] as const,
  outlineOffsetRatio: 0.003,

  // Inset for boundary walls on flush cut edges (keeps butted faces' walls apart)
  flushWallInsetRatio: 0.004,

  // Cell markers
  startColor: '#b2f0b2',
  goalColor: '#f0b2b2',
  warpColor: '#f0e8b2',

  // Walls
  wallColor: '#222',
  wallWidthRatio: 0.0025,

  // Boundary walls
  boundaryColor: '#000',
  boundaryWidthRatio: 0.004,

  // Solution path
  solutionColor: '#ee3333',
  solutionWidthRatio: 0.003,
  solutionOpacity: 0.8,
  solutionDashRatios: [0.001, 0.004] as const,

  // Labels
  labelColor: '#555555',
  labelInradiusScale: 1.2,

  // Face ids. Sized from the face's own inscribed radius rather than from the
  // net's width, so a 120-face net numbers its faces as boldly as a cube does.
  // Drawn *over* the maze inside a white halo: under it, a dense maze at a
  // hundred walls per face swallowed the number whole, and a fill pale enough
  // not to compete with the walls was too pale to read at all. The halo knocks
  // out only a thin ring following the glyph, so the maze survives around it.
  faceIdColor: '#8f8f8f',
  faceIdHaloColor: '#ffffff',
  /** Total halo stroke width in ems; half of it lands outside the glyph. */
  faceIdHaloWidth: 0.18,
  /** Font size as a fraction of the face's inradius. */
  faceIdInradiusScale: 0.95,
  /** Cap on the text width, as a multiple of the inradius (2 = the incircle). */
  faceIdMaxWidthRatio: 1.7,
  /** Digit advance width in ems — Arial/Helvetica figures are tabular. */
  faceIdDigitAdvance: 0.556,
  /**
   * A net is read from every side, so an unmarked 6 and 9 are the same glyph.
   * Every face id is underlined: the rule is always at the foot of the number.
   * Offsets and widths are in ems of the face id's font size.
   */
  faceIdUnderlineDrop: 0.52,
  faceIdUnderlineWidth: 0.09,
  faceIdUnderlineOverhang: 1.06,

  // Glue tabs
  glueTabColor: '#e0e0e0',
  glueTabInset: 0.5,
} as const;
