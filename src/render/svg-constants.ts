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
  faceIdColor: '#bbb',
  faceIdSizeRatio: 0.015,

  // Glue tabs
  glueTabColor: '#e0e0e0',
  glueTabInset: 0.5,
} as const;
