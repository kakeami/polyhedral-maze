/**
 * How a view comes round to a point on the surface of something it orbits.
 *
 * The view looks at a fixed middle from a fixed distance, upright, so where
 * it stands is a bearing round the vertical and a height above the level. It
 * is moved in those two — never along the shortest arc between where it is
 * and where it should be. The shortest arc from one side of an object to the
 * other goes over the top, and an upright view carried over the top turns
 * half round about its own line of sight as it passes: the picture flips, in
 * one frame if the arc goes exactly through the pole. Round the side is
 * longer and is what a hand on the view would do.
 *
 * Two more things a hand would do. It does not snatch: the turn picks up
 * speed and has a most it can have, and only then eases in. And it does not
 * chase a bearing that means nothing: a face that looks straight up can be
 * seen from above from any side, so the nearer the aim is to vertical the
 * less the bearing is moved.
 *
 * DOM-free and three-free, like `snap-motion.ts`, so that it can be tested.
 */

import type { Vec3 } from '../core/types.ts';

export interface FollowSettings {
  /** How fast the last of a turn is taken up, per second (a rate of decay). */
  readonly rate: number;
  /** The most the view turns, radians a second. */
  readonly maxSpeed: number;
  /** How fast it picks that speed up, radians a second squared. */
  readonly accel: number;
  /** How near straight up or down it may be aimed, as the vertical part of a unit direction. */
  readonly maxTilt: number;
  /**
   * How far from vertical an aim has to be for its bearing to count in full,
   * as the level part of a unit direction. Below it the bearing is moved in
   * proportion.
   */
  readonly levelFull: number;
}

export interface FollowStep {
  /** Where the view now stands: a unit direction from the middle, y up. */
  readonly eye: Vec3;
  /** How fast it turned to get there, radians a second: handed back in next time. */
  readonly pace: number;
  /** How much of the turn is left, radians. */
  readonly remaining: number;
}

/**
 * One frame of the turn.
 *
 * `eye` is where the view stands and `aim` where it should, both unit
 * directions from the middle with y up; `pace` is the speed the last step
 * came back with (0 from rest).
 */
export function followStep(
  eye: Vec3,
  aim: Vec3,
  pace: number,
  dt: number,
  settings: FollowSettings,
): FollowStep {
  const bearingOf = (v: Vec3): number => Math.atan2(v[0], v[2]);
  const heightOf = (v: Vec3): number => Math.acos(Math.max(-1, Math.min(1, v[1])));

  const bearing = bearingOf(eye);
  const height = heightOf(eye);
  const highest = Math.acos(Math.max(-1, Math.min(1, settings.maxTilt)));
  const wantHeight = Math.max(highest, Math.min(Math.PI - highest, heightOf(aim)));
  const level = Math.hypot(aim[0], aim[2]);
  const weight = settings.levelFull > 0 ? Math.min(1, level / settings.levelFull) : 1;

  let turn = bearingOf(aim) - bearing;
  turn -= Math.PI * 2 * Math.round(turn / (Math.PI * 2));
  turn *= weight;
  const rise = wantHeight - height;

  // The two taken together as one turn. The bearing is counted whole, not by
  // how far it moves the eye: seen from high up a change of bearing moves the
  // eye little and spins the picture all the same, and it is the picture
  // whose speed is being kept down.
  const reach = Math.hypot(turn, rise);
  if (reach < 1e-9 || dt <= 0) return { eye, pace: 0, remaining: reach };

  const wanted = reach * (1 - Math.exp(-settings.rate * dt));
  const allowed = Math.min(settings.maxSpeed, pace + settings.accel * dt) * dt;
  const step = Math.min(wanted, allowed);
  const share = step / reach;

  const nextBearing = bearing + turn * share;
  const nextHeight = Math.max(1e-3, Math.min(Math.PI - 1e-3, height + rise * share));
  return {
    eye: [
      Math.sin(nextHeight) * Math.sin(nextBearing),
      Math.cos(nextHeight),
      Math.sin(nextHeight) * Math.cos(nextBearing),
    ],
    pace: step / dt,
    remaining: reach - step,
  };
}
