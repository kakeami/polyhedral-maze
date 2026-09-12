/**
 * How the rings move: the timing and the feel of a piece clicking into place.
 *
 * A mechanism like this has no in-between positions — a ring is on a face or it
 * is not — so the animation is not a rotation, it is a *detent*. It winds up a
 * little, whips round accelerating all the way into the stop, and rattles once
 * before it sits. Interpolating smoothly instead would say the opposite of
 * what the object is: that the positions in between mean something.
 *
 * The rings are also deliberately out of step with each other. Equal periods
 * read as one machine with a camshaft; unequal ones read as pieces that happen
 * to share an axle, which is what they are. Periods are spread by the golden
 * ratio so no two rings ever fall into a rhythm, and the phases are scattered
 * so they do not all start together.
 *
 * DOM-free and three-free, so the timing can be tested without a renderer.
 */

import type { Rng } from '../core/prng.ts';

export interface SnapProfile {
  /** How far it winds up backwards first, in fractions of one step. */
  readonly windUp: number;
  /** Fraction of the turn spent winding up. */
  readonly windUpPhase: number;
  /** How far past the detent it carries, before settling back. */
  readonly overshoot: number;
  /** Fraction of the turn spent settling. */
  readonly settlePhase: number;
}

/** The turn a ring makes on its own. */
export const DETENT: SnapProfile = {
  windUp: 0.07,
  windUpPhase: 0.28,
  overshoot: 0.045,
  settlePhase: 0.20,
};

/**
 * The turn a ring makes when a hand lets go of it: no wind-up, because the
 * hand has already done that part, but the same arrival.
 */
export const RELEASE: SnapProfile = {
  windUp: 0,
  windUpPhase: 0,
  overshoot: 0.05,
  settlePhase: 0.34,
};

/**
 * Position along a turn, in steps, for `t` in [0,1].
 *
 * Returns slightly less than 0 early on (the wind-up) and slightly more than 1
 * near the end (the overshoot); it is exactly 0 at t=0 and exactly 1 at t=1.
 */
export function snapEase(t: number, profile: SnapProfile = DETENT): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const { windUp, windUpPhase, overshoot, settlePhase } = profile;

  if (windUpPhase > 0 && t < windUpPhase) {
    const u = t / windUpPhase;
    const eased = 1 - (1 - u) ** 3; // out-cubic: quick away, then holds
    return -windUp * eased;
  }

  const driveEnd = 1 - settlePhase;
  if (t < driveEnd) {
    const u = (t - windUpPhase) / (driveEnd - windUpPhase);
    // In-cubic: still gaining speed when it hits the stop. That is the click.
    return -windUp + (1 + overshoot + windUp) * u ** 3;
  }

  const u = (t - driveEnd) / settlePhase;
  return 1 + overshoot * (1 - u) * Math.exp(-4 * u) * Math.cos(6 * u);
}

export interface RingPlan {
  /** Seconds at rest between turns. */
  readonly dwell: number;
  /** Seconds before this ring's first turn. */
  readonly phase: number;
}

const GOLDEN = 0.6180339887498949;

/**
 * One resting period per ring, spread so that no two share a rhythm.
 *
 * The golden-ratio sequence is the standard way to scatter values that must
 * not land near each other; a plain random draw puts two rings on nearly the
 * same period often enough to notice, and that reads as a mistake.
 */
export function ringPlans(
  rng: Rng,
  count: number,
  options: { minDwell?: number; maxDwell?: number } = {},
): RingPlan[] {
  const minDwell = options.minDwell ?? 1.5;
  const maxDwell = options.maxDwell ?? 4.6;
  const plans: RingPlan[] = [];
  for (let i = 0; i < count; i++) {
    const spread = ((i + 1) * GOLDEN + rng.next() * 0.12) % 1;
    const dwell = minDwell + (maxDwell - minDwell) * spread;
    plans.push({ dwell, phase: rng.next() * dwell });
  }
  return plans;
}

export interface RingDriverOptions {
  readonly rings: number;
  readonly sides: number;
  readonly rng: Rng;
  /** Seconds one turn takes. */
  readonly turnSeconds?: number;
  readonly minDwell?: number;
  readonly maxDwell?: number;
  /** Chance that a turn goes two faces at once instead of one. */
  readonly doubleStepChance?: number;
}

interface RingState {
  offset: number;
  from: number;
  to: number;
  /** Progress through the current turn, or null when at rest. */
  turn: number | null;
  turnProfile: SnapProfile;
  timer: number;
  dwell: number;
  held: boolean;
  /** Continuous position while a hand is holding it, in steps. */
  heldAt: number;
}

/**
 * The rings' clock. Piece 0 never turns: it is the one the others are measured
 * against, so turning it would only turn the whole object.
 */
export class RingDriver {
  private readonly sides: number;
  private readonly rng: Rng;
  private readonly turnSeconds: number;
  private readonly doubleStepChance: number;
  private readonly rings: RingState[] = [];
  private paused = 0;
  private auto = true;

  constructor(options: RingDriverOptions) {
    this.sides = options.sides;
    this.rng = options.rng;
    this.turnSeconds = options.turnSeconds ?? 0.46;
    this.doubleStepChance = options.doubleStepChance ?? 0.22;

    const plans = ringPlans(options.rng, options.rings, {
      ...(options.minDwell === undefined ? {} : { minDwell: options.minDwell }),
      ...(options.maxDwell === undefined ? {} : { maxDwell: options.maxDwell }),
    });
    for (let i = 0; i < options.rings; i++) {
      const plan = plans[i]!;
      this.rings.push({
        offset: 0, from: 0, to: 0, turn: null, turnProfile: DETENT,
        timer: plan.phase, dwell: plan.dwell, held: false, heldAt: 0,
      });
    }
  }

  get ringCount(): number {
    return this.rings.length;
  }

  /** True while nothing is moving — the only time the maze has a state. */
  get atRest(): boolean {
    return this.rings.every(r => r.turn === null && !r.held);
  }

  /** Whole-face offsets of each ring, as the mechanism counts them. */
  offsets(): number[] {
    return this.rings.map(r => ((r.offset % this.sides) + this.sides) % this.sides);
  }

  /** Where each ring is right now, in steps — fractional mid-turn. */
  angle(ring: number): number {
    const r = this.rings[ring];
    if (!r) return 0;
    if (r.held) return r.heldAt;
    if (r.turn === null) return r.offset;
    return r.from + (r.to - r.from) * snapEase(r.turn, r.turnProfile);
  }

  /** Holds off the automatic turns — after a hand has been on the object. */
  pauseFor(seconds: number): void {
    this.paused = Math.max(this.paused, seconds);
  }

  /**
   * Whether the rings turn by themselves.
   *
   * Switching it off stops new turns from starting; it does not freeze a ring
   * half way round, and it does not stop a hand from turning one. Those are
   * different questions, and answering them together would leave a ring
   * stranded between two faces, which is a position the object cannot be in.
   */
  setAuto(on: boolean): void {
    this.auto = on;
  }

  get isPaused(): boolean {
    return this.paused > 0;
  }

  beginDrag(ring: number): void {
    const r = this.rings[ring];
    if (!r || ring === 0) return;
    r.held = true;
    r.heldAt = this.angle(ring);
    r.turn = null;
  }

  dragTo(ring: number, steps: number): void {
    const r = this.rings[ring];
    if (!r || !r.held) return;
    r.heldAt = steps;
  }

  /** Lets go: the ring falls into the nearest detent and stays there a while. */
  endDrag(ring: number): void {
    const r = this.rings[ring];
    if (!r || !r.held) return;
    r.held = false;
    r.from = r.heldAt;
    r.to = Math.round(r.heldAt);
    r.turnProfile = RELEASE;
    r.turn = r.from === r.to ? null : 0;
    if (r.turn === null) r.offset = r.to;
    r.timer = r.dwell;
  }

  /**
   * Advances every ring by `dt` seconds.
   * Returns the rings that came to rest on this tick — when one does, the
   * object has a new state and the route through it has to be found again.
   */
  advance(dt: number): number[] {
    if (this.paused > 0) this.paused = Math.max(0, this.paused - dt);
    const settled: number[] = [];

    for (let i = 1; i < this.rings.length; i++) {
      const r = this.rings[i]!;
      if (r.held) continue;

      if (r.turn !== null) {
        r.turn += dt / this.turnSeconds;
        if (r.turn >= 1) {
          r.turn = null;
          r.offset = r.to;
          r.timer = r.dwell * (0.85 + this.rng.next() * 0.3);
          settled.push(i);
        }
        continue;
      }

      if (!this.auto || this.paused > 0) continue;
      r.timer -= dt;
      if (r.timer > 0) continue;
      const direction = this.rng.next() < 0.5 ? -1 : 1;
      const steps = this.rng.next() < this.doubleStepChance ? 2 : 1;
      r.from = r.offset;
      r.to = r.offset + direction * steps;
      r.turnProfile = DETENT;
      r.turn = 0;
    }
    return settled;
  }
}
