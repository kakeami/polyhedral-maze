import { describe, it, expect } from 'vitest';
import type { Vec3 } from '../types.ts';
import { followStep } from '../../render/follow-view.ts';
import type { FollowSettings } from '../../render/follow-view.ts';
import { FOLD_SCENE } from '../../render/fold-scene-constants.ts';
import { createRng } from '../prng.ts';

const settings: FollowSettings = {
  rate: FOLD_SCENE.followRate,
  maxSpeed: FOLD_SCENE.followMaxSpeed,
  accel: FOLD_SCENE.followAccel,
  maxTilt: FOLD_SCENE.followMaxTilt,
  levelFull: FOLD_SCENE.followLevelFull,
};
const dt = 1 / 60;

/** A unit direction from a bearing round the vertical and a height above the level, in degrees. */
function direction(bearing: number, elevation: number): Vec3 {
  const b = (bearing * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(b), Math.sin(e), Math.cos(e) * Math.cos(b)];
}

const bearingOf = (v: Vec3): number => Math.atan2(v[0], v[2]);
const angleBetween = (a: Vec3, b: Vec3): number =>
  Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/** The view followed for a while: every place it stood, and how it ended. */
function run(from: Vec3, aim: Vec3, seconds: number) {
  const stood: Vec3[] = [from];
  let eye = from;
  let pace = 0;
  let remaining = Infinity;
  const paces: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const step = followStep(eye, aim, pace, dt, settings);
    eye = step.eye;
    pace = step.pace;
    remaining = step.remaining;
    stood.push(eye);
    paces.push(pace);
  }
  return { stood, eye, remaining, paces };
}

describe('a view coming round to a point', () => {
  it('goes round the object and not over the top of it', () => {
    // From one side to the far side at the same height: the short way is over
    // the pole, and an upright view carried over the pole flips.
    const { stood, eye } = run(direction(0, 60), direction(180, 60), 6);
    for (const at of stood) expect(at[1]).toBeLessThanOrEqual(Math.sin(Math.PI / 3) + 1e-9);
    expect(angleBetween(eye, direction(180, 60))).toBeLessThan(0.01);
  });

  it('never turns the picture faster than it is allowed', () => {
    const rng = createRng(7);
    for (let trial = 0; trial < 200; trial++) {
      const from = direction(rng.next() * 360, rng.next() * 160 - 80);
      const aim = direction(rng.next() * 360, rng.next() * 180 - 90);
      const { stood } = run(from, aim, 5);
      const highest = Math.max(Math.abs(from[1]), settings.maxTilt);
      for (let i = 1; i < stood.length; i++) {
        let turned = bearingOf(stood[i]!) - bearingOf(stood[i - 1]!);
        turned -= Math.PI * 2 * Math.round(turned / (Math.PI * 2));
        expect(Math.abs(turned)).toBeLessThanOrEqual(settings.maxSpeed * dt + 1e-9);
        // And never nearer the pole than where it started or the limit.
        expect(Math.abs(stood[i]![1])).toBeLessThanOrEqual(highest + 1e-9);
      }
    }
  });

  it('sets off from rest and eases in', () => {
    const { paces, remaining } = run(direction(0, 10), direction(170, 10), 6);
    expect(paces[0]).toBeLessThanOrEqual(settings.accel * dt + 1e-9);
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i]! - paces[i - 1]!).toBeLessThanOrEqual(settings.accel * dt + 1e-9);
    }
    expect(Math.max(...paces)).toBeCloseTo(settings.maxSpeed, 6);
    expect(paces.at(-1)).toBeLessThan(0.01);
    expect(remaining).toBeLessThan(0.001);
  });

  it('leaves the bearing alone when the face looks straight up', () => {
    // From above, one side is as good as another: the view rises where it
    // stands, as far as it is allowed, and does not go round.
    const from = direction(40, 10);
    const { eye } = run(from, [0, 1, 0], 6);
    expect(bearingOf(eye)).toBeCloseTo(bearingOf(from), 9);
    expect(eye[1]).toBeCloseTo(settings.maxTilt, 3);
  });

  it('is there already when it is there', () => {
    const at = direction(120, 20);
    const step = followStep(at, at, 0, dt, settings);
    expect(step.remaining).toBeLessThan(1e-9);
    expect(step.pace).toBe(0);
    expect(step.eye).toEqual(at);
  });
});
