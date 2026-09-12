import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { buildSurface } from '../kinetic/surface.ts';
import {
  costOverStates,
  generateKineticMaze,
  optimizeForStates,
  stateStats,
  treeRate,
} from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';

const small = createStack({ sides: 6, layers: 3, cols: 3, rows: 3 });
const smallSurface = buildSurface(small);
const allSmallStates = Array.from({ length: smallSurface.stateCount }, (_, i) => i);

describe('optimizing for several states at once', () => {
  it('makes a chosen handful of states perfect together', () => {
    const targets = [0, 5, 11, 17, 23, 29];
    const result = optimizeForStates(smallSurface, {
      rng: createRng(3),
      targetStates: targets,
      iterations: 20000,
      restarts: 4,
    });
    expect(result.cost).toBe(0);
    for (const s of targets) {
      expect(stateStats(smallSurface, result.design, s).perfect).toBe(true);
    }
  });

  it('can make every state of the mechanism a perfect maze', () => {
    const result = optimizeForStates(smallSurface, {
      rng: createRng(11),
      targetStates: allSmallStates,
      iterations: 3000,
      restarts: 2,
    });
    expect(result.cost).toBe(0);
    const rate = treeRate(smallSurface, result.design);
    expect(rate.rate).toBe(1);
    expect(rate.perfectStates.length).toBe(smallSurface.stateCount);
  });

  it('still spends exactly N-1 passages, in every state', () => {
    const result = optimizeForStates(smallSurface, {
      rng: createRng(11),
      targetStates: allSmallStates,
      iterations: 3000,
      restarts: 2,
    });
    const rate = treeRate(smallSurface, result.design);
    expect(rate.edgeCountInvariant).toBe(true);
    for (const n of rate.edgeCounts) expect(n).toBe(smallSurface.cellCount - 1);
  });

  it('leaves the openings alone, since they set the budget', () => {
    const cuts = [smallSurface.cutClasses[0]!, smallSurface.cutClasses[3]!];
    const result = optimizeForStates(smallSurface, {
      rng: createRng(4),
      targetStates: [0, 7],
      openCutClasses: cuts,
      iterations: 5000,
      restarts: 2,
    });
    expect([...result.design.openCutClasses].sort((a, b) => a - b)).toEqual(
      [...cuts].sort((a, b) => a - b),
    );
  });

  it('produces a maze that really does change as the object is turned', () => {
    // An all-states design could have been a cheat: make every layer's pattern
    // repeat every face, and turning a ring would map the drawing onto itself.
    // It does not — the passages that survive a one-face turn are no more than
    // for an ordinary design.
    const result = optimizeForStates(smallSurface, {
      rng: createRng(11),
      targetStates: allSmallStates,
      iterations: 3000,
      restarts: 2,
    });
    const cellsPerLayer = small.sides * small.rows * small.cols;
    const classOfPair = new Map<string, number>();
    for (const e of smallSurface.internalEdges) {
      classOfPair.set(`${Math.min(e.a, e.b)}:${Math.max(e.a, e.b)}`, e.classId);
    }
    const turned = (cell: number): number => {
      const layer = Math.floor(cell / cellsPerLayer);
      const local = cell - layer * cellsPerLayer;
      const face = Math.floor(local / (small.rows * small.cols));
      const rest = local % (small.rows * small.cols);
      return small.cellIndex(
        layer,
        (face + 1) % small.sides,
        Math.floor(rest / small.cols),
        rest % small.cols,
      );
    };
    let open = 0;
    let fixed = 0;
    for (const e of smallSurface.internalEdges) {
      if (!result.design.open.has(e.classId)) continue;
      open++;
      const a = turned(e.a);
      const b = turned(e.b);
      const cls = classOfPair.get(`${Math.min(a, b)}:${Math.max(a, b)}`);
      if (cls !== undefined && result.design.open.has(cls)) fixed++;
    }
    expect(fixed).toBeLessThan(open * 0.9);
  });

  it('rejects an empty or out-of-range target list', () => {
    expect(() =>
      optimizeForStates(smallSurface, { rng: createRng(1), targetStates: [] }),
    ).toThrow();
    expect(() =>
      optimizeForStates(smallSurface, {
        rng: createRng(1),
        targetStates: [smallSurface.stateCount],
      }),
    ).toThrow();
  });

  it('is deterministic for a fixed seed', () => {
    const run = () =>
      optimizeForStates(smallSurface, {
        rng: createRng(99),
        targetStates: [0, 2, 4],
        iterations: 4000,
        restarts: 2,
      });
    const a = run();
    const b = run();
    expect(a.cost).toBe(b.cost);
    expect([...a.design.open].sort((x, y) => x - y)).toEqual(
      [...b.design.open].sort((x, y) => x - y),
    );
  });
});

describe('costOverStates', () => {
  it('is zero exactly when every listed state is a perfect maze', () => {
    const design = generateKineticMaze(smallSurface, { rng: createRng(20260912) });
    const perfect = treeRate(smallSurface, design).perfectStates;
    expect(costOverStates(smallSurface, design, perfect)).toBe(0);
    const imperfect = allSmallStates.filter(s => !perfect.includes(s));
    expect(costOverStates(smallSurface, design, imperfect)).toBeGreaterThan(0);
  });
});

describe('a bigger stack, all states at once', () => {
  it('holds for 216 configurations of a 6-gon in 4 layers', () => {
    const mech = createStack({ sides: 6, layers: 4, cols: 3, rows: 3 });
    const surface = buildSurface(mech);
    const all = Array.from({ length: surface.stateCount }, (_, i) => i);
    const result = optimizeForStates(surface, {
      rng: createRng(11),
      targetStates: all,
      iterations: 3000,
      restarts: 2,
    });
    expect(result.cost).toBe(0);
    expect(treeRate(surface, result.design).rate).toBe(1);
  });
});
