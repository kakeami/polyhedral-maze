import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KINETIC_PARAMS,
  KINETIC_LIMITS,
  cellCount,
  clampKineticParams,
  decodeKineticParams,
  encodeKineticParams,
  harderEffort,
  isMaxEffort,
  maxCols,
  maxLayers,
  maxRows,
  stateCount,
} from '../../ui/kinetic-param-codec.ts';

describe('kinetic params in a URL', () => {
  it('says nothing when nothing has changed', () => {
    expect(encodeKineticParams(DEFAULT_KINETIC_PARAMS)).toBe('');
    expect(decodeKineticParams('')).toEqual(DEFAULT_KINETIC_PARAMS);
  });

  it('round-trips a mechanism someone chose', () => {
    const params = clampKineticParams({
      ...DEFAULT_KINETIC_PARAMS,
      sides: 8, layers: 3, cols: 4, rows: 2, k: 2, seed: 1234, showSolution: false,
      motion: false, style: 'obsidian',
    });
    expect(decodeKineticParams(encodeKineticParams(params))).toEqual(params);
  });

  it('keeps the switches that default to on', () => {
    const off = {
      ...DEFAULT_KINETIC_PARAMS, showSolution: false, motion: false, autoRotate: false,
    };
    const encoded = encodeKineticParams(off);
    expect(encoded).toContain('solution=0');
    expect(encoded).toContain('motion=0');
    expect(encoded).toContain('rotate=0');
    expect(decodeKineticParams(encoded)).toEqual(off);
  });

  it('tells the view drift apart from the mechanism turning', () => {
    const still = decodeKineticParams('?rotate=0');
    expect(still.autoRotate).toBe(false);
    expect(still.motion).toBe(true);
    const held = decodeKineticParams('?motion=0');
    expect(held.motion).toBe(false);
    expect(held.autoRotate).toBe(true);
  });

  it('falls back on nonsense rather than building nothing', () => {
    const params = decodeKineticParams('?sides=abc&rings=-4&cols=99&seed=zzz&style=gold');
    // A value that is not a number at all is not a request for the smallest
    // mechanism — it is no request, so the default stands.
    expect(params.sides).toBe(DEFAULT_KINETIC_PARAMS.sides);
    // A number outside the range *is* a request, and gets pulled to the edge.
    expect(params.layers).toBe(KINETIC_LIMITS.layers.min);
    expect(params.cols).toBe(maxCols(params));
    expect(params.style).toBe(DEFAULT_KINETIC_PARAMS.style);
    expect(params.seed).toBe(DEFAULT_KINETIC_PARAMS.seed);
  });
});

describe('the limits that keep a rebuild quick', () => {
  it('never lets the states run past the budget', () => {
    for (let sides = KINETIC_LIMITS.sides.min; sides <= KINETIC_LIMITS.sides.max; sides++) {
      const layers = maxLayers(sides);
      expect(stateCount(sides, layers)).toBeLessThanOrEqual(KINETIC_LIMITS.maxStates);
      expect(layers).toBeGreaterThanOrEqual(KINETIC_LIMITS.layers.min);
      // And it really is the most it could allow.
      if (layers < KINETIC_LIMITS.layers.max) {
        expect(stateCount(sides, layers + 1)).toBeGreaterThan(KINETIC_LIMITS.maxStates);
      }
    }
  });

  it('never lets the cells run past the budget', () => {
    for (let sides = 3; sides <= 12; sides++) {
      for (let layers = 2; layers <= maxLayers(sides); layers++) {
        for (let rows = 1; rows <= 6; rows++) {
          for (let cols = 1; cols <= 6; cols++) {
            const p = clampKineticParams({ ...DEFAULT_KINETIC_PARAMS, sides, layers, cols, rows });
            expect(cellCount(p)).toBeLessThanOrEqual(KINETIC_LIMITS.maxCells);
            expect(stateCount(p.sides, p.layers)).toBeLessThanOrEqual(KINETIC_LIMITS.maxStates);
          }
        }
      }
    }
  });

  it('gives up the grid before it gives up the mechanism', () => {
    // 12 sides and 3 rings is a lot of barrel; the ruling gets coarser, but the
    // object the visitor asked for is still the object they get.
    const p = clampKineticParams({ ...DEFAULT_KINETIC_PARAMS, sides: 12, layers: 3, cols: 6, rows: 6 });
    expect(p.sides).toBe(12);
    expect(p.layers).toBe(3);
    expect(p.cols * p.rows).toBeLessThan(36);
  });

  it('agrees with itself about what still fits', () => {
    const base = { sides: 6, layers: 4, cols: 3, rows: 3 };
    expect(maxCols({ ...base })).toBe(Math.min(6, Math.floor(720 / (6 * 4 * 3))));
    expect(maxRows({ ...base })).toBe(Math.min(6, Math.floor(720 / (6 * 4 * 3))));
  });
});

describe('search effort', () => {
  it('stays out of the URL until it is not the default', () => {
    expect(encodeKineticParams(DEFAULT_KINETIC_PARAMS)).not.toContain('effort');
    const harder = { ...DEFAULT_KINETIC_PARAMS, effort: 4 };
    expect(encodeKineticParams(harder)).toContain('effort=4');
    expect(decodeKineticParams(encodeKineticParams(harder))).toEqual(harder);
  });

  it('climbs the ladder and stops at the top', () => {
    expect(harderEffort(1)).toBe(2);
    expect(harderEffort(2)).toBe(4);
    expect(harderEffort(8)).toBe(8);
    expect(isMaxEffort(8)).toBe(true);
    expect(isMaxEffort(1)).toBe(false);
  });

  it('snaps a value from a hand-edited URL onto the ladder', () => {
    expect(decodeKineticParams('?effort=3').effort).toBe(2);
    expect(decodeKineticParams('?effort=999').effort).toBe(8);
    expect(decodeKineticParams('?effort=nonsense').effort).toBe(1);
  });
});
