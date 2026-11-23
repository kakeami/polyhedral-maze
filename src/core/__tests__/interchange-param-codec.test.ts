import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INTERCHANGE_PARAMS, INTERCHANGE_LIMITS, clampInterchangeParams,
  decodeInterchangeParams, encodeInterchangeParams, nearestRuling,
} from '../../ui/interchange-param-codec.ts';
import { interchangeRulings } from '../../ui/interchange-objects.ts';

describe('the interchange maze in a URL', () => {
  it('says nothing when nothing has changed', () => {
    expect(encodeInterchangeParams(DEFAULT_INTERCHANGE_PARAMS)).toBe('');
    expect(decodeInterchangeParams('')).toEqual(DEFAULT_INTERCHANGE_PARAMS);
  });

  it('round-trips what someone was looking at', () => {
    const params = clampInterchangeParams({
      ...DEFAULT_INTERCHANGE_PARAMS,
      cells: interchangeRulings().at(-1)!, stations: 9, folds: 4, seed: 8675309,
      pose: 3, showSolution: true, autoRotate: false, style: 'obsidian',
    });
    expect(decodeInterchangeParams(encodeInterchangeParams(params))).toEqual(params);
  });

  it('carries the two things the maze is asked for', () => {
    const encoded = encodeInterchangeParams({ ...DEFAULT_INTERCHANGE_PARAMS, stations: 7, folds: 3 });
    expect(encoded).toContain('stations=7');
    expect(encoded).toContain('folds=3');
  });

  it('brings a link back inside what the page offers', () => {
    const { minStations, maxStations, minFolds, maxFolds, maxSeed } = INTERCHANGE_LIMITS;
    const wild = decodeInterchangeParams('?n=99&stations=500&folds=-3&seed=1e12&pose=-4');
    expect(interchangeRulings()).toContain(wild.cells);
    expect(wild.stations).toBe(maxStations);
    expect(wild.folds).toBe(minFolds);
    expect(wild.seed).toBe(maxSeed);
    expect(wild.pose).toBe(0);
    expect(decodeInterchangeParams('?stations=0&folds=40').stations).toBe(minStations);
    expect(decodeInterchangeParams('?stations=0&folds=40').folds).toBe(maxFolds);
    expect(interchangeRulings()).toContain(nearestRuling(0));
    // A parameter that is there and empty names nothing.
    expect(decodeInterchangeParams('?seed=').seed).toBe(DEFAULT_INTERCHANGE_PARAMS.seed);
  });
});
