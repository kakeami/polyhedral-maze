import { describe, it, expect } from 'vitest';
import { createRng } from '../prng.ts';
import { DETENT, RELEASE, RingDriver, ringPlans, snapEase } from '../../render/snap-motion.ts';

describe('snapEase', () => {
  it('starts and ends exactly on a detent', () => {
    expect(snapEase(0)).toBe(0);
    expect(snapEase(1)).toBe(1);
    expect(snapEase(-0.5)).toBe(0);
    expect(snapEase(1.5)).toBe(1);
  });

  it('winds up backwards before it goes', () => {
    const back = snapEase(DETENT.windUpPhase * 0.9);
    expect(back).toBeLessThan(0);
    expect(back).toBeGreaterThanOrEqual(-DETENT.windUp);
  });

  it('is still gaining speed when it reaches the stop', () => {
    // The click: the last slice of the drive covers more ground than the first.
    const driveStart = DETENT.windUpPhase;
    const driveEnd = 1 - DETENT.settlePhase;
    const span = driveEnd - driveStart;
    const first = snapEase(driveStart + span * 0.2) - snapEase(driveStart);
    const last = snapEase(driveEnd) - snapEase(driveEnd - span * 0.2);
    expect(last).toBeGreaterThan(first * 3);
  });

  it('carries past the detent and settles back', () => {
    const peak = snapEase(1 - DETENT.settlePhase);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeCloseTo(1 + DETENT.overshoot, 9);
    expect(snapEase(0.999)).toBeCloseTo(1, 3);
  });

  it('has no wind-up when a hand has already provided it', () => {
    expect(snapEase(0.05, RELEASE)).toBeGreaterThan(0);
    expect(snapEase(1, RELEASE)).toBe(1);
  });

  it('is continuous across the phase boundaries', () => {
    const eps = 1e-6;
    for (const t of [DETENT.windUpPhase, 1 - DETENT.settlePhase]) {
      // Loose on purpose: the curve is at its fastest right at the stop, so
      // even a 2e-6 step across the boundary moves it by a few parts in a
      // million. What would show as a jump is orders of magnitude bigger.
      expect(snapEase(t + eps)).toBeCloseTo(snapEase(t - eps), 4);
    }
  });
});

describe('ringPlans', () => {
  it('gives no two rings the same rhythm', () => {
    const plans = ringPlans(createRng(5), 6);
    const dwells = plans.map(p => p.dwell).sort((a, b) => a - b);
    for (let i = 1; i < dwells.length; i++) {
      expect(dwells[i]! - dwells[i - 1]!).toBeGreaterThan(0.1);
    }
  });

  it('scatters the first turn inside each ring own period', () => {
    for (const plan of ringPlans(createRng(11), 5)) {
      expect(plan.phase).toBeGreaterThanOrEqual(0);
      expect(plan.phase).toBeLessThanOrEqual(plan.dwell);
    }
  });
});

describe('RingDriver', () => {
  const driver = () => new RingDriver({ rings: 4, sides: 6, rng: createRng(2026) });

  it('holds the bottom ring still', () => {
    const d = driver();
    for (let i = 0; i < 2000; i++) d.advance(1 / 60);
    expect(d.angle(0)).toBe(0);
    expect(d.offsets()[0]).toBe(0);
  });

  it('turns the others, and always onto a whole face', () => {
    const d = driver();
    let settles = 0;
    for (let i = 0; i < 3600; i++) settles += d.advance(1 / 60).length;
    expect(settles).toBeGreaterThan(10);
    for (const offset of d.offsets()) {
      expect(Number.isInteger(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(6);
    }
  });

  it('does not let the rings fall into step', () => {
    const d = driver();
    const settleTimes: number[][] = [[], [], [], []];
    let t = 0;
    for (let i = 0; i < 7200; i++) {
      t += 1 / 60;
      for (const ring of d.advance(1 / 60)) settleTimes[ring]!.push(t);
    }
    const counts = settleTimes.slice(1).map(list => list.length);
    expect(Math.min(...counts)).toBeGreaterThan(0);
    // Different periods mean different numbers of turns over the same minute.
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('reports rest only between turns', () => {
    const d = driver();
    let sawMotion = false;
    let sawRest = false;
    for (let i = 0; i < 1200; i++) {
      d.advance(1 / 60);
      if (d.atRest) sawRest = true; else sawMotion = true;
    }
    expect(sawMotion && sawRest).toBe(true);
  });

  it('lets a hand take a ring and drops it onto the nearest face', () => {
    const d = driver();
    d.beginDrag(2);
    expect(d.atRest).toBe(false);
    d.dragTo(2, 1.7);
    expect(d.angle(2)).toBeCloseTo(1.7, 9);
    d.endDrag(2);
    for (let i = 0; i < 120; i++) d.advance(1 / 60);
    expect(d.offsets()[2]).toBe(2);
  });

  it('keeps its hands off for a while after being touched', () => {
    const d = driver();
    d.pauseFor(10);
    expect(d.isPaused).toBe(true);
    const before = d.offsets();
    for (let i = 0; i < 300; i++) d.advance(1 / 60);
    expect(d.offsets()).toEqual(before);
    for (let i = 0; i < 600; i++) d.advance(1 / 60);
    expect(d.isPaused).toBe(false);
  });
});

describe('RingDriver when the rings are not turning themselves', () => {
  it('starts no turns of its own', () => {
    const d = new RingDriver({ rings: 4, sides: 6, rng: createRng(2026) });
    d.setAuto(false);
    for (let i = 0; i < 3600; i++) expect(d.advance(1 / 60)).toEqual([]);
    expect(d.atRest).toBe(true);
  });

  it('still lets a hand turn one, and still lands it on a face', () => {
    const d = new RingDriver({ rings: 4, sides: 6, rng: createRng(2026) });
    d.setAuto(false);
    d.beginDrag(1);
    d.dragTo(1, -0.6);
    d.endDrag(1);
    let settled = false;
    for (let i = 0; i < 240; i++) settled ||= d.advance(1 / 60).includes(1);
    expect(settled).toBe(true);
    expect(d.offsets()[1]).toBe(5); // -1 of six faces
    // And the others stayed exactly where they were.
    expect(d.offsets()[2]).toBe(0);
    expect(d.offsets()[3]).toBe(0);
  });
});
