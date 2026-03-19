import { describe, it, expect } from 'vitest';
import { cellKey, parseCell, cellIdToKey } from '../types.ts';

describe('cellKey / parseCell', () => {
  it('round-trips', () => {
    const key = cellKey(3, 5, 7);
    expect(key).toBe('3:5:7');
    const cell = parseCell(key);
    expect(cell).toEqual({ faceId: 3, row: 5, col: 7 });
    expect(cellIdToKey(cell)).toBe(key);
  });

  it('handles zero values', () => {
    expect(parseCell(cellKey(0, 0, 0))).toEqual({ faceId: 0, row: 0, col: 0 });
  });
});
