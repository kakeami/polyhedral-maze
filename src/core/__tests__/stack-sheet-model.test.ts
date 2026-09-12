import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { generateKineticMaze } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { buildStackSheets, bulkheadTabQuads } from '../../render/stack-sheet-model.ts';
import { A4_SHEET, STACK_SHEET_STYLE } from '../../render/kinetic-sheet-constants.ts';
import type { Vec2 } from '../vec2.ts';
import type { PageItem } from '../../render/face-page-model.ts';

const mech = createStack({ sides: 6, layers: 4, cols: 3, rows: 3 });
const surface = buildSurface(mech);
const design = generateKineticMaze(surface, { rng: createRng(20260912) });
const plan = buildStackSheets(mech, surface, design);

const allItems = plan.sheets.flatMap(s => s.items);
const wallLines = allItems.filter(
  (i): i is Extract<PageItem, { kind: 'line' }> =>
    i.kind === 'line' && i.stroke === STACK_SHEET_STYLE.wallColor,
);

describe('stack sheets', () => {
  it('draws a band for every ring plus two bulkheads each', () => {
    expect(plan.bulkheadCount).toBe(mech.layers * 2);
    expect(plan.sheets.length).toBeGreaterThan(1);
    const labels = allItems.filter(i => i.kind === 'text').map(i => i.text);
    for (let layer = 0; layer < mech.layers; layer++) {
      expect(labels.some(t => t.startsWith(`Ring ${layer + 1}`))).toBe(true);
    }
  });

  it('reports the finished size', () => {
    // 6-gon, 3 cells a face at 10 mm: the edge is 30 mm, so the barrel is 60 mm
    // across and 4 rings of 30 mm tall.
    expect(plan.barrelWidthMm).toBeCloseTo(60, 6);
    expect(plan.barrelHeightMm).toBeCloseTo(120, 6);
  });

  it('draws exactly one wall per closed edge of the surface', () => {
    // Every grid edge is drawn once: the bottom and left of each cell, plus the
    // top of the top row. Count the closed ones straight off the design.
    let closed = 0;
    for (let layer = 0; layer < mech.layers; layer++) {
      for (let face = 0; face < mech.sides; face++) {
        for (let col = 0; col < mech.cols; col++) {
          for (let row = 0; row < mech.rows; row++) {
            const cell = mech.cellIndex(layer, face, row, col);
            const isOpen = (side: number) =>
              design.open.has(surface.classOf[surface.sideStart[cell]! + side]!);
            if (!isOpen(0)) closed++;
            if (!isOpen(3)) closed++;
            if (row === mech.rows - 1 && !isOpen(2)) closed++;
          }
        }
      }
    }
    expect(wallLines.length).toBe(closed);
  });

  it('walls the free rims all the way round', () => {
    const cell = 10;
    const columns = mech.sides * mech.cols;
    // The bottom of ring 1 and the top of the last ring are the maze boundary:
    // every column there must carry a wall, or the maze leaks out of the object.
    for (const [layer, side] of [[0, 0], [mech.layers - 1, 2]] as const) {
      let walls = 0;
      for (let face = 0; face < mech.sides; face++) {
        for (let col = 0; col < mech.cols; col++) {
          const row = side === 0 ? 0 : mech.rows - 1;
          const index = mech.cellIndex(layer, face, row, col);
          if (!design.open.has(surface.classOf[surface.sideStart[index]! + side]!)) walls++;
        }
      }
      expect(walls).toBe(columns);
    }
    expect(columns * cell).toBe(180);
  });

  it('puts the rim walls where they belong on the page, not just in the count', () => {
    // Group horizontal wall segments by the line they sit on. Exactly two of
    // those lines — the bottom of ring 1 and the top of the last ring — must be
    // walled for the band's whole 180 mm width; a flipped axis or an off-by-one
    // at the seam would break that even though the wall count still matched.
    const byY = new Map<string, number>();
    for (const line of wallLines) {
      if (Math.abs(line.a[1] - line.b[1]) > 1e-9) continue;
      const key = line.a[1].toFixed(4);
      byY.set(key, (byY.get(key) ?? 0) + Math.abs(line.b[0] - line.a[0]));
    }
    const full = [...byY.values()].filter(total => Math.abs(total - 180) < 1e-6);
    expect(full.length).toBe(2);
  });

  it('keeps every mark inside the printable area', () => {
    const { margin, width, height } = A4_SHEET;
    const points: Vec2[] = [];
    for (const sheet of plan.sheets) {
      for (const item of sheet.items) {
        if (item.kind === 'line') points.push(item.a, item.b);
        else if (item.kind === 'poly') points.push(...item.pts);
        else points.push(item.at);
      }
    }
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(margin - 0.01);
      expect(x).toBeLessThanOrEqual(width - margin + 0.01);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(height - margin + 0.01);
    }
  });

  it('refuses a band too wide for the sheet, and says how small the cells must be', () => {
    const wide = createStack({ sides: 10, layers: 3, cols: 3, rows: 3 });
    const wideSurface = buildSurface(wide, { maxStates: 200 });
    const wideDesign = generateKineticMaze(wideSurface, { rng: createRng(1) });
    expect(() => buildStackSheets(wide, wideSurface, wideDesign)).toThrow(/at most/);
    expect(() =>
      buildStackSheets(wide, wideSurface, wideDesign, { cellMm: 6 }),
    ).not.toThrow();
  });
});

describe('bulkhead tabs', () => {
  const hexagon: Vec2[] = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return [30 * Math.cos(a), 30 * Math.sin(a)];
  });

  const segments = (quad: Vec2[]): [Vec2, Vec2][] => [
    [quad[0]!, quad[1]!],
    [quad[1]!, quad[2]!],
    [quad[2]!, quad[3]!],
  ];

  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const intersects = (p: [Vec2, Vec2], q: [Vec2, Vec2]) => {
    const d1 = cross(p[0], p[1], q[0]);
    const d2 = cross(p[0], p[1], q[1]);
    const d3 = cross(q[0], q[1], p[0]);
    const d4 = cross(q[0], q[1], p[1]);
    const eps = 1e-9;
    return (
      ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
      ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))
    );
  };

  it('stands the tabs outside the disc, not inside it', () => {
    const quads = bulkheadTabQuads(hexagon, 7);
    for (const quad of quads) {
      for (const p of [quad[1]!, quad[2]!]) {
        expect(Math.hypot(p[0], p[1])).toBeGreaterThan(30 * Math.cos(Math.PI / 6));
      }
    }
  });

  it('cuts the tabs back far enough that neighbours never overlap', () => {
    for (const tabHeight of [4, 7, 10]) {
      for (const sides of [4, 5, 6, 8]) {
        const points: Vec2[] = Array.from({ length: sides }, (_, i) => {
          const a = (i / sides) * Math.PI * 2;
          return [30 * Math.cos(a), 30 * Math.sin(a)];
        });
        const quads = bulkheadTabQuads(points, tabHeight);
        for (let i = 0; i < quads.length; i++) {
          for (let j = i + 1; j < quads.length; j++) {
            for (const p of segments(quads[i]!)) {
              for (const q of segments(quads[j]!)) {
                expect(intersects(p, q)).toBe(false);
              }
            }
          }
        }
      }
    }
  });
});
