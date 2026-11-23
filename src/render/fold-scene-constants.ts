/**
 * Values for the folding 3D view that are not the visual preset's business.
 *
 * The preset decides what the object is made of; these decide how it moves —
 * how long a fold takes, how long it rests in a pose before folding on, and
 * how long it leaves a visitor alone after they have asked for something.
 */
export const FOLD_SCENE = {
  /**
   * How long one fold takes.
   *
   * Slow enough to be followed — the whole point of the page is that a visitor
   * can see which cubes went where — and fast enough that a four-fold journey
   * between two poses is over in three seconds.
   */
  foldSeconds: 0.75,
  /**
   * How long it holds a pose before folding to the next one by itself.
   *
   * Long enough to read the maze on the face in front of you, short enough
   * that a visitor who has not touched anything sees the object fold within a
   * few seconds of arriving — which is the one thing this page has to say.
   */
  dwellSeconds: 3.5,
  /**
   * How long it leaves the visitor alone after they have asked for a pose, a
   * ruling or a maze. The same seven seconds the rings give on the other page.
   */
  pauseAfterAskingSeconds: 7,
  /**
   * A route played across poses (`playRoute`): how fast the point walks, in
   * cube sides a second, and the least and the most one walk may take. Brisk
   * enough that a route of four walks and three folds is over in half a
   * minute, slow enough that the eye can stay on the point.
   */
  walkSpeed: 1.6,
  walkSecondsMin: 1.2,
  walkSecondsMax: 7,
  /** How long the point stands on a mark before the object folds under it. */
  routeRestSeconds: 0.7,
  /** How long the finished route is left on show before it starts again. */
  routeEndSeconds: 3.5,
  /** The point that walks, in cube sides. */
  walkerRadius: 0.055,
  /** A symbol drawn on a cell, as a multiple of a wall's width. */
  decalWidth: 1.3,
  /**
   * How the view follows the point (`follow-view.ts`): how fast the last of a
   * turn is taken up (per second, as a rate of decay), the most it turns
   * (radians a second) and how fast it picks that up, how much it leans from
   * the face's normal towards the point's bearing from the middle, how near
   * straight up or down it may look, and how far from vertical a face has to
   * be for the side it is seen from to matter in full. And how long a hand on
   * the view keeps it after letting go.
   */
  followRate: 3.5,
  followMaxSpeed: 2.8,
  followAccel: 8,
  followRadial: 0.35,
  followMaxTilt: 0.9,
  followLevelFull: 0.5,
  handsOffSeconds: 2.5,
  /**
   * Before a line is traced the view comes round to where it starts: near
   * enough is this many radians, it holds there this long before the point
   * sets off, and it is given this long at most to get there.
   */
  routeAimedWithin: 0.12,
  routeReadySeconds: 0.4,
  routeTurnSecondsMax: 4,
} as const;
