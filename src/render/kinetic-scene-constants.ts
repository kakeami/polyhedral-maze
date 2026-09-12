/**
 * Values for the kinetic 3D view that are not the visual preset's business.
 *
 * The preset decides what the object is made of; these decide what it *is* —
 * how far apart the rings sit, how the route fades while the mechanism is
 * moving, how long it leaves a visitor alone after being touched.
 */
export const KINETIC_SCENE = {
  /**
   * Gap between rings, as a fraction of a ring's height. The rings are closed
   * at both ends, so this is what makes a stack of tins read as a stack rather
   * than as one barrel with lines drawn around it. There is no dowel drawn:
   * the real object turns on one, but on screen a rod through the middle reads
   * as a spike stuck through the maze.
   */
  ringGap: 0.035,
  /** The route dims to this while any ring is turning. */
  solutionFadedOpacity: 0.12,
  /** Fade rate, in units of "fraction of the way there per second". */
  solutionFadeRate: 7,
  /** How long the rings leave the visitor alone after being touched. */
  pauseAfterTouchSeconds: 7,
} as const;
