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
   * How much a pose twice as far away is worth choosing, when it folds on its
   * own: the weight is 1/distance to this power. Two keeps most journeys to
   * one fold without ever shutting the far poses out.
   */
  nearnessBias: 2,
} as const;
