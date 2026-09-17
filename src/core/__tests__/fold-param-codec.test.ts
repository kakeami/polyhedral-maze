import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FOLD_PARAMS,
  FOLD_LIMITS,
  clampFoldParams,
  decodeFoldParams,
  encodeFoldParams,
  nearestRuling,
} from '../../ui/fold-param-codec.ts';
import { cubeRingDesign } from '../kinetic/mechanisms/cube-ring-designs.ts';
import {
  CUBE_RING_OBJECTS, DEFAULT_CUBE_RING, FRAME_RING, cubeRingRulings,
} from '../kinetic/mechanisms/cube-ring-objects.ts';

describe('the folding maze in a URL', () => {
  it('says nothing when nothing has changed', () => {
    expect(encodeFoldParams(DEFAULT_FOLD_PARAMS)).toBe('');
    expect(decodeFoldParams('')).toEqual(DEFAULT_FOLD_PARAMS);
  });

  it('round-trips what someone was looking at', () => {
    const params = clampFoldParams({
      ...DEFAULT_FOLD_PARAMS,
      cells: cubeRingRulings(DEFAULT_CUBE_RING).at(-1)!,
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

  it('carries which object it is, and opens on the default when it cannot', () => {
    const other = clampFoldParams({ ...DEFAULT_FOLD_PARAMS, object: FRAME_RING.id });
    expect(encodeFoldParams(other)).toContain(`object=${FRAME_RING.id}`);
    expect(decodeFoldParams(encodeFoldParams(other)).object).toBe(FRAME_RING.id);
    // A link to an object this page no longer has opens on the one it does.
    expect(decodeFoldParams('?object=a-ring-of-forty').object).toBe(DEFAULT_CUBE_RING.id);
    expect(CUBE_RING_OBJECTS.map(object => object.id)).toContain(DEFAULT_CUBE_RING.id);
  });

  it('asks the object what rulings it may ask for', () => {
    // A link cannot name a ruling the page does not offer — it would have
    // nothing to draw, and quietly showing a neighbouring one beats an empty
    // screen. A *seed* it can name freely: any of them is a maze, found here
    // if it is not one of the few that ship with the page.
    expect(cubeRingRulings(DEFAULT_CUBE_RING)).toContain(nearestRuling(DEFAULT_CUBE_RING, 99));
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
    expect(cubeRingDesign(DEFAULT_CUBE_RING.id, 4, 3)).not.toBeNull();
  });

  it('leaves the pose to the object, but never below zero', () => {
    // How many shapes there are is worked out from the taping rather than
    // written down here, so a pose beyond the end is brought into range where
    // the object is built. What a URL can settle on its own is the floor.
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, pose: 40 }).pose).toBe(40);
    expect(clampFoldParams({ ...DEFAULT_FOLD_PARAMS, pose: -3 }).pose).toBe(0);
  });

  it('ignores nonsense rather than breaking on it', () => {
    const wild = decodeFoldParams('?n=abc&seed=&pose=NaN&style=gilded&fold=maybe');
    expect(wild).toEqual({ ...DEFAULT_FOLD_PARAMS, fold: false });
  });
});
