/**
 * Values for the kinetic 3D view that are not the visual preset's business.
 *
 * The preset decides what the object is made of; these decide what it *is* —
 * how far apart the rings sit, how thick the dowel is, how the route fades
 * while the mechanism is moving.
 */
export const KINETIC_SCENE = {
  /** Gap between rings, as a fraction of a ring's height. */
  ringGap: 0.035,
  /** Dowel thickness, as a fraction of the barrel's radius. */
  dowelRadiusRatio: 0.07,
  /** How far the dowel runs past the stack, as a multiple of its height. */
  dowelOverhang: 1.12,
  dowelColor: 0x8a6a44,
  dowelRoughness: 0.85,
  /** The route dims to this while any ring is turning. */
  solutionFadedOpacity: 0.12,
  /** Fade rate, in units of "fraction of the way there per second". */
  solutionFadeRate: 7,
  /** How long the rings leave the visitor alone after being touched. */
  pauseAfterTouchSeconds: 7,
} as const;
