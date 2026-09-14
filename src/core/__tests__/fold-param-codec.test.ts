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
  INFINITY_CUBE_RULINGS, infinityCubeDesigns,
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
      maze: 2, pose: 4, showSolution: true, fold: false, style: 'obsidian',
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

  it('asks the shelf what it may ask for', () => {
    // A link cannot name a ruling there are no mazes at, nor a maze past the
    // end of the ones shipped at that ruling: the page would have nothing to
    // draw, and quietly showing something else beats an empty screen.
    expect(INFINITY_CUBE_RULINGS).toContain(nearestRuling(99));
    for (const cells of INFINITY_CUBE_RULINGS) {
      const shelf = infinityCubeDesigns(cells).length;
      expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, cells, maze: 99 }).maze).toBe(shelf);
      expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, cells, maze: 0 }).maze).toBe(1);
    }
  });

  it('brings a pose back into the six the object has', () => {
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, pose: 40 }).pose).toBe(FOLD_LIMITS.poses - 1);
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, pose: -3 }).pose).toBe(0);
  });

  it('ignores nonsense rather than breaking on it', () => {
    const wild = decodeFoldParams('?n=abc&maze=&pose=NaN&style=gilded&fold=maybe');
    expect(wild).toEqual({ ...DEFAULT_FOLD_PARAMS, fold: false });
  });
});
