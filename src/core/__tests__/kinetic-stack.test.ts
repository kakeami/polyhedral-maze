import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { buildSurface } from '../kinetic/surface.ts';
import type { KineticSurface } from '../kinetic/surface.ts';
import {
  chooseCutClasses,
  generateKineticMaze,
  searchDesign,
  stateStats,
  treeRate,
} from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';

const SIDES = 6;
const LAYERS = 4;
const COLS = 3;
const ROWS = 3;

const mech = createStack({ sides: SIDES, layers: LAYERS, cols: COLS, rows: ROWS });
const surface: KineticSurface = buildSurface(mech);

const CELLS = SIDES * LAYERS * COLS * ROWS;
const STATES = SIDES ** (LAYERS - 1);

describe('stack mechanism', () => {
  it('covers the lateral surface with one cell grid per layer', () => {
    expect(mech.cells.length).toBe(CELLS);
    expect(mech.pieceCount).toBe(LAYERS);
    for (const cell of mech.cells) expect(cell.corners.length).toBe(4);
  });

  it('holds the bottom layer fixed, so states are relative turns only', () => {
    expect(mech.states.length).toBe(STATES);
    expect(mech.stateOffsets(0)).toEqual([0, 0, 0, 0]);
    for (let i = 0; i < STATES; i++) expect(mech.stateOffsets(i)[0]).toBe(0);
    const labels = new Set(Array.from({ length: STATES }, (_, i) => mech.stateLabel(i)));
    expect(labels.size).toBe(STATES);
  });

  it('indexes cells by layer/face/row/col', () => {
    expect(mech.cellIndex(0, 0, 0, 0)).toBe(0);
    expect(mech.cellIndex(LAYERS - 1, SIDES - 1, ROWS - 1, COLS - 1)).toBe(CELLS - 1);
    expect(() => mech.cellIndex(LAYERS, 0, 0, 0)).toThrow();
  });
});

describe('stack surface', () => {
  it('welds every state without a segment shared by three cells', () => {
    // buildSurface throws on a bad weld, so reaching here is the assertion;
    // the counts below pin down that the welds are the intended ones.
    expect(surface.cellCount).toBe(CELLS);
    expect(surface.stateCount).toBe(STATES);
    expect(surface.sideCount).toBe(CELLS * 4);
  });

  it('splits sides into rim, internal and cut classes', () => {
    const kinds = surface.classKind.reduce<Record<string, number>>((acc, k) => {
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    // Free rims: top and bottom of the tube, one side per cell column.
    expect(kinds['rim']).toBe(2 * SIDES * COLS);
    // One cut class per (cut circle x column), shared by both layers it joins.
    expect(kinds['cut']).toBe(COLS * (LAYERS - 1));
    expect(surface.cutClasses.length).toBe(COLS * (LAYERS - 1));
    for (const c of surface.cutClasses) {
      expect(surface.classSides[c]!.length).toBe(2 * SIDES);
    }
    // Walls inside a layer: a band of SIDES*COLS columns by ROWS rows, wrapped.
    const perLayer = SIDES * COLS * (2 * ROWS - 1);
    expect(kinds['internal']).toBe(perLayer * LAYERS);
    expect(surface.internalEdges.length).toBe(perLayer * LAYERS);
  });

  it('has the same adjacency count in every state', () => {
    const counts = surface.adjByState.map(a => a.length);
    const expected = SIDES * COLS * (2 * ROWS - 1) * LAYERS + SIDES * COLS * (LAYERS - 1);
    for (const n of counts) expect(n).toBe(expected);
  });
});

describe('kinetic maze on the stack', () => {
  const design = generateKineticMaze(surface, { rng: createRng(20260912) });

  it('opens the fewest cut classes that join the layers: one per cut circle', () => {
    expect(design.openCutClasses.length).toBe(LAYERS - 1);
    expect(chooseCutClasses(surface, createRng(1)).length).toBe(LAYERS - 1);
  });

  it('makes the target state a perfect maze', () => {
    const stats = stateStats(surface, design, design.targetState);
    expect(stats.perfect).toBe(true);
    expect(stats.components).toBe(1);
    expect(stats.cycles).toBe(0);
    expect(stats.edges).toBe(CELLS - 1);
  });

  it('keeps the passage count constant across every state (edge invariance)', () => {
    const rate = treeRate(surface, design);
    expect(rate.edgeCountInvariant).toBe(true);
    for (const n of rate.edgeCounts) expect(n).toBe(CELLS - 1);
  });

  it('turns "connected" into "perfect maze" in every state', () => {
    // With exactly N-1 passages, a state is a spanning tree iff it is connected,
    // so components and cycles must move together.
    for (let s = 0; s < surface.stateCount; s++) {
      const stats = stateStats(surface, design, s);
      expect(stats.components).toBe(stats.cycles + 1);
      expect(stats.perfect).toBe(stats.components === 1);
    }
  });

  it('measures difficulty as the share of states that are perfect', () => {
    const rate = treeRate(surface, design);
    expect(rate.perfectStates).toContain(design.targetState);
    expect(rate.rate).toBeGreaterThan(0);
    expect(rate.rate).toBeLessThan(1);
    expect(rate.rate).toBeCloseTo(rate.perfectStates.length / STATES, 12);
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateKineticMaze(surface, { rng: createRng(42) });
    const b = generateKineticMaze(surface, { rng: createRng(42) });
    expect([...a.open].sort((x, y) => x - y)).toEqual([...b.open].sort((x, y) => x - y));
  });
});

describe('design search', () => {
  it('finds a harder design than a single draw', () => {
    const hard = searchDesign(surface, { rng: createRng(5), attempts: 12, targetRate: 0 });
    expect(hard.treeRate.perfectStates).toContain(hard.design.targetState);
    expect(hard.treeRate.edgeCountInvariant).toBe(true);
    // 12 draws should beat the median draw; assert it is at least not worse
    // than the plain generator on the same seed.
    const plain = treeRate(surface, generateKineticMaze(surface, { rng: createRng(5) }));
    expect(hard.treeRate.rate).toBeLessThanOrEqual(plain.rate);
  });

  it('can aim for an easy design instead', () => {
    const easy = searchDesign(surface, { rng: createRng(5), attempts: 12, targetRate: 1 });
    const hard = searchDesign(surface, { rng: createRng(5), attempts: 12, targetRate: 0 });
    expect(easy.treeRate.rate).toBeGreaterThan(hard.treeRate.rate);
  });
});

describe('other stack sizes', () => {
  const cases = [
    { sides: 4, layers: 3, cols: 3, rows: 3 },
    { sides: 5, layers: 4, cols: 2, rows: 2 },
    { sides: 8, layers: 3, cols: 2, rows: 2 },
  ];
  it.each(cases)('holds the invariants for a $sides-gon of $layers layers', opts => {
    const m = createStack(opts);
    const s = buildSurface(m);
    const d = generateKineticMaze(s, { rng: createRng(7) });
    const rate = treeRate(s, d);
    expect(s.cellCount).toBe(opts.sides * opts.layers * opts.cols * opts.rows);
    expect(rate.edgeCountInvariant).toBe(true);
    expect(rate.edgeCounts[0]).toBe(s.cellCount - 1);
    expect(rate.perfectStates).toContain(0);
  });

  it('rejects degenerate stacks', () => {
    expect(() => createStack({ sides: 2 })).toThrow();
    expect(() => createStack({ layers: 1 })).toThrow();
    expect(() => createStack({ cols: 0 })).toThrow();
  });
});
