/**
 * The motion of the folding ring: that there is a way from every pose to every
 * other, that each fold lands where it claims to, and that the way round is
 * not a free choice.
 *
 * The last of those is the one worth stating. A fold turns an arc half a turn
 * about a line, and half a turn one way lands in the same place as half a turn
 * the other; but of the two, on this object, exactly one goes through the rest
 * of the object every time. An animation that picked either would be wrong
 * half the time, and it would be wrong in the way that is hardest to see in a
 * screenshot and most obvious in motion.
 */
import { describe, it, expect } from 'vitest';
import {
  createInfinityCube, PLANK_RING,
} from '../kinetic/mechanisms/infinity-cube.ts';
import {
  buildFoldGraph, chooseNextPose, foldPath, poseDistances, stateDuringFold, sweepIsClear,
} from '../kinetic/fold-path.ts';
import { applyPlacement } from '../kinetic/types.ts';
import type { KineticState } from '../kinetic/types.ts';
import type { Vec3 } from '../types.ts';
import { createRng } from '../prng.ts';

const mech = createInfinityCube({ cells: 1 });
const graph = buildFoldGraph(mech);

/** Four corners of a cube, enough to pin a placement down to a rigid motion. */
const PROBES: Vec3[] = [[0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5]];

function sameState(a: KineticState, b: KineticState): boolean {
  for (let piece = 0; piece < a.length; piece++) {
    for (const corner of PROBES) {
      const one = applyPlacement(a[piece]!, corner);
      const other = applyPlacement(b[piece]!, corner);
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(one[axis]! - other[axis]!) > 1e-6) return false;
      }
    }
  }
  return true;
}

describe('the shapes the ring can take', () => {
  it('has more of them than it has poses', () => {
    // The six poses are the shapes a hand stops at; the rest are the ring
    // closed but splayed open, which it goes through on the way.
    expect(graph.shapes.length).toBe(24);
    expect(mech.states.length).toBe(6);
    expect(new Set(graph.poseAt).size).toBe(6);
  });

  it('moves one unbroken arc at a time, and leaves the rest alone', () => {
    for (let shape = 0; shape < graph.shapes.length; shape++) {
      for (const { step } of graph.folds[shape]!) {
        const moving = new Set(step.pieces);
        expect(moving.size).toBeGreaterThan(0);
        expect(moving.size).toBeLessThan(mech.pieceCount);
        let breaks = 0;
        for (let i = 0; i < mech.pieceCount; i++) {
          if (moving.has(i) !== moving.has((i + 1) % mech.pieceCount)) breaks++;
        }
        expect(breaks).toBe(2); // one arc, so two ends
        const halfway = stateDuringFold(step, 0.5);
        for (let piece = 0; piece < mech.pieceCount; piece++) {
          if (moving.has(piece)) continue;
          expect(halfway[piece]).toBe(step.from[piece]);
        }
      }
    }
  });
});

describe('a fold', () => {
  it('ends exactly where it says it will', () => {
    for (const list of graph.folds) {
      for (const { step } of list) {
        expect(sameState(stateDuringFold(step, 0), step.from)).toBe(true);
        expect(sameState(stateDuringFold(step, 1), step.to)).toBe(true);
      }
    }
  });

  it('goes the one way round that misses the object', () => {
    let blocked = 0;
    let total = 0;
    for (const list of graph.folds) {
      for (const { step } of list) {
        total++;
        expect(sweepIsClear(step, mech)).toBe(true);
        const otherWay = {
          ...step,
          angle: step.angle - Math.sign(step.angle) * 2 * Math.PI,
        };
        if (!sweepIsClear(otherWay, mech)) blocked++;
      }
    }
    // Not "usually": every one of them. Half a turn about a line on the
    // outside of the object sweeps the arc through where the object is, unless
    // it is swung away from it.
    expect(total).toBe(96);
    expect(blocked).toBe(total);
  });
});

describe('getting from one pose to another', () => {
  it('can always be done, in four folds or fewer', () => {
    for (let from = 0; from < mech.states.length; from++) {
      for (let to = 0; to < mech.states.length; to++) {
        const path = foldPath(graph, from, to);
        expect(path).not.toBeNull();
        expect(path!.length).toBeLessThanOrEqual(4);
        if (from === to) expect(path!.length).toBe(0);
        else expect(path!.length).toBeGreaterThan(0);
      }
    }
  });

  it('joins its folds up, and arrives at the pose asked for', () => {
    const path = foldPath(graph, 0, 5)!;
    expect(path.length).toBeGreaterThan(0);
    expect(sameState(path[0]!.from, mech.states[0]!)).toBe(true);
    for (let i = 1; i < path.length; i++) {
      expect(sameState(path[i - 1]!.to, path[i]!.from)).toBe(true);
    }
    expect(sameState(path[path.length - 1]!.to, mech.states[5]!)).toBe(true);
  });

  it('cannot, on a taping whose crossing seams are not in line', () => {
    // The taping this project first recommended. It shuts into the same six
    // poses and folds between only three of them: the rest are on the far side
    // of a move the tape does not allow.
    const stuck = createInfinityCube({
      cells: 1, ring: PLANK_RING, hinges: '32021200'.split('').map(Number),
    });
    const stuckGraph = buildFoldGraph(stuck);
    let unreachable = 0;
    for (let from = 0; from < stuck.states.length; from++) {
      for (let to = 0; to < stuck.states.length; to++) {
        if (foldPath(stuckGraph, from, to) === null) unreachable++;
      }
    }
    expect(unreachable).toBe(18);
  });
});

describe('folding on its own', () => {
  const distances = poseDistances(graph);

  it('knows how far apart the poses are, and agrees with the paths', () => {
    for (let from = 0; from < mech.states.length; from++) {
      expect(distances[from]![from]).toBe(0);
      for (let to = 0; to < mech.states.length; to++) {
        expect(distances[from]![to]).toBe(foldPath(graph, from, to)!.length);
      }
    }
  });

  it('mostly takes a single fold, and still visits every pose', () => {
    // The two halves of the point. Short journeys are what makes an object
    // left to itself legible; but of the fifteen pairs only four are a single
    // fold apart and those four do not join all six poses, so a rule that only
    // ever took the nearest would strand it in three of them for ever.
    const rng = createRng(4);
    const visits = new Array(mech.states.length).fill(0);
    const lengths: number[] = [];
    let at = 0;
    let cameFrom = -1;
    for (let step = 0; step < 2000; step++) {
      const next = chooseNextPose({
        distances, from: at, cameFrom, random: () => rng.next(),
      })!;
      expect(next).not.toBe(at);
      visits[next]++;
      lengths.push(distances[at]![next]!);
      cameFrom = at;
      at = next;
    }
    for (const seen of visits) expect(seen).toBeGreaterThan(50);
    const single = lengths.filter(n => n === 1).length / lengths.length;
    expect(single).toBeGreaterThan(0.5);
    expect(Math.max(...lengths)).toBeGreaterThan(1); // the far ones do come up
  });

  it('turns back much less often than it goes on', () => {
    const rng = createRng(11);
    let back = 0;
    let at = 1;
    let cameFrom = 0;
    for (let step = 0; step < 2000; step++) {
      const next = chooseNextPose({
        distances, from: at, cameFrom, random: () => rng.next(),
      })!;
      if (next === cameFrom) back++;
      cameFrom = at;
      at = next;
    }
    expect(back / 2000).toBeLessThan(0.25);
  });
});
