import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { buildSurface } from '../kinetic/surface.ts';
import {
  chooseCutClasses,
  createAllStatesSearch,
  expandCutClasses,
  generateKineticMaze,
  optimizeForStates,
  searchAllStates,
  stateStats,
  treeRate,
} from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';

const smallStack = () => buildSurface(createStack({ sides: 4, layers: 3, cols: 2, rows: 2 }));

describe('expandCutClasses', () => {
  it('returns the minimum unchanged when nothing extra is asked for', () => {
    const surface = smallStack();
    const base = chooseCutClasses(surface, createRng(3));
    const same = expandCutClasses(surface, { rng: createRng(3), base, extra: 0 });
    expect(same).toEqual(base);
  });

  it('adds openings, and never so many that a state gains a loop', () => {
    const surface = smallStack();
    const base = chooseCutClasses(surface, createRng(3));
    const wider = expandCutClasses(surface, { rng: createRng(5), base, extra: 3 });
    expect(wider.length).toBeGreaterThan(base.length);
    expect(new Set(wider).size).toBe(wider.length);

    // The point of the guard: the forced openings still have to leave room for
    // a spanning tree, which is exactly what generateKineticMaze checks.
    expect(() =>
      generateKineticMaze(surface, { rng: createRng(9), openCutClasses: wider }),
    ).not.toThrow();
  });

  it('cannot exceed the cut classes the mechanism has', () => {
    const surface = smallStack();
    const all = expandCutClasses(surface, { rng: createRng(1), extra: 999 });
    expect(all.length).toBeLessThanOrEqual(surface.cutClasses.length);
  });
});

describe('searchAllStates', () => {
  it('makes every state of a small stack a perfect maze', () => {
    const surface = smallStack();
    const result = searchAllStates(surface, { rng: createRng(20260912) });
    expect(result.rate.rate).toBe(1);
    expect(result.rate.perfectStates.length).toBe(surface.stateCount);
    for (let s = 0; s < surface.stateCount; s++) {
      expect(stateStats(surface, result.design, s).perfect).toBe(true);
    }
  });

  it('reports the rate it actually achieved, measured over every state', () => {
    const surface = smallStack();
    const result = searchAllStates(surface, { rng: createRng(4) });
    const measured = treeRate(surface, result.design);
    expect(result.rate.rate).toBeCloseTo(measured.rate, 12);
    expect(result.rate.edgeCountInvariant).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const surface = smallStack();
    const a = searchAllStates(surface, { rng: createRng(77) });
    const b = searchAllStates(surface, { rng: createRng(77) });
    expect([...a.design.open].sort()).toEqual([...b.design.open].sort());
  });

  it('holds on a six-sided stack with an extra seam opening', () => {
    const surface = buildSurface(createStack({ sides: 6, layers: 3, cols: 3, rows: 3 }));
    const cuts = expandCutClasses(surface, { rng: createRng(2), extra: 2 });
    const result = searchAllStates(surface, { rng: createRng(2), openCutClasses: cuts });
    expect(result.rate.rate).toBe(1);
    expect(result.design.openCutClasses.length).toBe(cuts.length);
  });
});

describe('the effort budget', () => {
  it('stops a hopeless search instead of annealing until it gives up', () => {
    // Far more seam openings than the spanning-tree budget can carry, so no
    // design can be perfect everywhere and the search can only fail.
    const surface = buildSurface(createStack({ sides: 6, layers: 3, cols: 3, rows: 3 }));
    const cuts = expandCutClasses(surface, { rng: createRng(3), extra: 99 });

    const stingy = searchAllStates(surface, { rng: createRng(8), openCutClasses: cuts, effort: 1 });
    expect(stingy.rounds).toBe(1);
    expect(stingy.exhausted).toBe(true);
    // It still hands back a real design, measured honestly.
    expect(stingy.rate.rate).toBeLessThan(1);
    expect(stingy.rate.edgeCountInvariant).toBe(true);
  });

  it('spends nothing extra on a search that succeeds', () => {
    const surface = smallStack();
    const cheap = searchAllStates(surface, { rng: createRng(20260912), effort: 1 });
    // A budget of one unit is not enough for a second round, but the first one
    // is always allowed — and for this mechanism the first one is enough.
    expect(cheap.rate.rate).toBe(1);
    expect(cheap.exhausted).toBe(false);
  });

  it('reports how much annealing it did', () => {
    const surface = smallStack();
    const result = optimizeForStates(surface, {
      rng: createRng(5),
      targetStates: [0, 1, 2],
      iterations: 500,
      restarts: 2,
    });
    expect(result.steps).toBeGreaterThan(0);
    expect(result.steps).toBeLessThanOrEqual(500 * 2);
  });
});

describe('stepping the search a round at a time', () => {
  it('finds exactly what the all-at-once version finds', () => {
    const surface = smallStack();
    const whole = searchAllStates(surface, { rng: createRng(4242) });

    const stepped = createAllStatesSearch(surface, { rng: createRng(4242) });
    let rounds = 0;
    while (!stepped.step()) rounds++;
    const piecemeal = stepped.result();

    expect([...piecemeal.design.open].sort()).toEqual([...whole.design.open].sort());
    expect(piecemeal.rate.rate).toBe(whole.rate.rate);
    expect(rounds).toBeLessThanOrEqual(whole.rounds);
  });

  it('has something to report after every round', () => {
    const surface = buildSurface(createStack({ sides: 6, layers: 3, cols: 3, rows: 3 }));
    const cuts = expandCutClasses(surface, { rng: createRng(3), extra: 99 });
    const search = createAllStatesSearch(surface, { rng: createRng(1), openCutClasses: cuts });

    const seen: number[] = [];
    let done = false;
    while (!done) {
      done = search.step();
      const p = search.progress;
      expect(p.rounds).toBeGreaterThan(0);
      expect(p.rounds).toBeLessThanOrEqual(p.maxRounds);
      expect(p.stateCount).toBe(surface.stateCount);
      expect(p.perfectStates).toBeLessThanOrEqual(p.stateCount);
      expect(p.spent).toBeGreaterThan(0);
      seen.push(p.perfectStates);
    }
    // Several rounds, with the sample widening each time — which is exactly
    // the case the progress display exists for, since one round of this size
    // is most of a second on its own.
    expect(seen.length).toBeGreaterThan(1);
    // The best never gets worse as the rounds go by.
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[0]!);
  });

  it('refuses to report a result before it has run', () => {
    const search = createAllStatesSearch(smallStack(), { rng: createRng(1) });
    expect(() => search.result()).toThrow(/has not run/);
  });
});
