import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FOLD_PARAMS,
  FOLD_LIMITS,
  clampFoldParams,
  decodeFoldParams,
  encodeFoldParams,
  nearestRuling,
} from '../../ui/fold-param-codec.ts';
import {
  INFINITY_CUBE_RULINGS, infinityCubeDesign,
} from '../kinetic/mechanisms/infinity-cube-designs.ts';

describe('the folding maze in a URL', () => {
  it('says nothing when nothing has changed', () => {
    expect(encodeFoldParams(DEFAULT_FOLD_PARAMS)).toBe('');
    expect(decodeFoldParams('')).toEqual(DEFAULT_FOLD_PARAMS);
  });

  it('round-trips what someone was looking at', () => {
    const params = clampFoldParams({
      ...DEFAULT_FOLD_PARAMS,
      cells: INFINITY_CUBE_RULINGS[INFINITY_CUBE_RULINGS.length - 1]!,
      seed: 8675309, pose: 4, showSolution: true, fold: false, style: 'obsidian',
    });
    expect(decodeFoldParams(encodeFoldParams(params))).toEqual(params);
  });

  it('keeps the switches that default to on', () => {
    const off = { ...DEFAULT_FOLD_PARAMS, fold: false, autoRotate: false };
    const encoded = encodeFoldParams(off);
    expect(encoded).toContain('fold=0');
    expect(encoded).toContain('rotate=0');
    expect(decodeFoldParams(encoded)).toEqual(off);
  });

  it('asks the object what rulings it may ask for', () => {
    // A link cannot name a ruling the page does not offer — it would have
    // nothing to draw, and quietly showing a neighbouring one beats an empty
    // screen. A *seed* it can name freely: any of them is a maze, found here
    // if it is not one of the few that ship with the page.
    expect(INFINITY_CUBE_RULINGS).toContain(nearestRuling(99));
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, seed: 1e9 }).seed)
      .toBe(FOLD_LIMITS.maxSeed);
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, seed: -5 }).seed).toBe(0);
  });

  it('opens a link written before mazes had seeds', () => {
    // `maze=3` meant "the third of the six shipped at this ruling". The shelf
    // is now the first few seeds, so the number still lands on a maze at the
    // ruling the link asked for — and on one that needs no search.
    const old = decodeFoldParams('?n=4&maze=3');
    expect(old.cells).toBe(4);
    expect(old.seed).toBe(3);
    expect(infinityCubeDesign(4, 3)).not.toBeNull();
  });

  it('brings a pose back into the six the object has', () => {
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, pose: 40 }).pose).toBe(FOLD_LIMITS.poses - 1);
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, pose: -3 }).pose).toBe(0);
  });

  it('ignores nonsense rather than breaking on it', () => {
    const wild = decodeFoldParams('?n=abc&seed=&pose=NaN&style=gilded&fold=maybe');
    expect(wild).toEqual({ ...DEFAULT_FOLD_PARAMS, fold: false });
  });
});
