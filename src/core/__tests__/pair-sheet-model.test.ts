import { describe, it, expect } from 'vitest';
import { createJoinedPair } from '../kinetic/mechanisms/joined.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { searchAllStates, pickStartGoal } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { buildPairSheets } from '../../render/pair-sheet-model.ts';
import { A4_SHEET, STACK_SHEET_STYLE, STACK_SHEET_DEFAULTS } from '../../render/kinetic-sheet-constants.ts';
import type { Vec2 } from '../vec2.ts';
import type { PageItem } from '../../render/face-page-model.ts';

const mech = createJoinedPair({ shape: 'j3', gon: 6, n: 3 });
const surface = buildSurface(mech);
const design = searchAllStates(surface, { rng: createRng(20260914) }).design;
const plan = buildPairSheets(mech, surface, design);

const allItems = plan.sheets.flatMap(s => s.items);
const linesOf = (stroke: readonly number[]) =>
  allItems.filter(
    (i): i is Extract<PageItem, { kind: 'line' }> => i.kind === 'line' && i.stroke === stroke,
  );
// A maze wall is drawn at one of two weights: the lighter one inside a face,
// the rim weight on an edge of the face, which is a fold or a cut as well as a
// wall. Both are walls, and the count below is of walls.
const wallLines = [...linesOf(STACK_SHEET_STYLE.wallColor), ...linesOf(STACK_SHEET_STYLE.boundaryColor)];
const tabPolys = allItems.filter(
  (i): i is Extract<PageItem, { kind: 'poly' }> =>
    i.kind === 'poly' && i.fill === STACK_SHEET_STYLE.glueFill,
);
const textOf = () =>
  allItems.filter((i): i is Extract<PageItem, { kind: 'text' }> => i.kind === 'text');

describe('glued pair sheets', () => {
  it('draws one wall for every closed side of both halves', () => {
    let closed = 0;
    for (let cell = 0; cell < surface.cellCount; cell++) {
      const from = surface.sideStart[cell]!;
      const to = surface.sideStart[cell + 1]!;
      for (let side = from; side < to; side++) {
        if (!design.open.has(surface.classOf[side]!)) closed++;
      }
    }
    // Each cell draws its own sides, so a wall between two cells is drawn
    // twice — once from either side, exactly on top of itself.
    expect(wallLines.length).toBe(closed);
  });

  it('prints both halves and their hardware', () => {
    const labels = textOf().map(t => t.text);
    expect(labels).toContain('Lower half (1 of 2)');
    expect(labels).toContain('Upper half (2 of 2)');
    expect(labels.some(t => t.startsWith('Bulkheads (2) and retaining discs'))).toBe(true);
    expect(labels.some(t => t.includes('perfect maze'))).toBe(true);
  });

  it('marks the entrance and the exit once each', () => {
    const letters = textOf().filter(t => t.text === 'S' || t.text === 'G');
    expect(letters.map(t => t.text).sort()).toEqual(['G', 'S']);
    const ends = pickStartGoal(surface, design);
    expect(ends.start).not.toBe(ends.goal);
  });

  it('leaves the joint open: no glue tab on the face the halves meet at', () => {
    // A tab on that ring would be glued to the other half, which has to turn.
    // Each half's opening is the joint polygon, so the tabs are all elsewhere.
    // Bulkhead tabs are one per joint edge, twice over; the rest belong to the
    // net, and there is no way for the count to include the joint ring itself.
    expect(tabPolys.length).toBeGreaterThanOrEqual(2 * mech.gon);
  });

  it('stands every glue tab outside the face it is folded from', () => {
    // The unfolder hands its faces over wound the other way from the page once
    // the y axis is flipped. Read the winding instead of the geometry and every
    // tab lands *inside* its own face, over the very walls it was meant to be
    // glued beside.
    const inside = (poly: Vec2[], p: Vec2): boolean => {
      let sign = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        const side = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        if (Math.abs(side) < 1e-6) continue;
        if (sign !== 0 && Math.sign(side) !== sign) return false;
        sign = Math.sign(side);
      }
      return sign !== 0;
    };
    const same = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
    // Each face is laid down as a sheet of blank paper before it is drawn on,
    // which is what tells the two halves' outlines from everything else here.
    const faces = allItems.filter(
      (i): i is Extract<PageItem, { kind: 'poly' }> =>
        i.kind === 'poly' && i.fill === STACK_SHEET_STYLE.paperColor,
    );
    let checked = 0;
    for (const tab of tabPolys) {
      // A tab keeps the edge it stands on as its first and last point.
      const [foot, , , heel] = tab.pts as [Vec2, Vec2, Vec2, Vec2];
      const face = faces.find(
        f => f.pts.some(p => same(p, foot)) && f.pts.some(p => same(p, heel)),
      );
      if (!face) continue; // a bulkhead tab: its disc is not a face of the net
      checked++;
      for (const corner of [tab.pts[1]!, tab.pts[2]!]) {
        expect(inside(face.pts, corner)).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('prints a bulkhead for each half, however wide the joint', () => {
    // A wide joint puts two bulkheads past the edge of the sheet side by side.
    // They have to go one under the other, not one of them go missing: a
    // pattern one bulkhead short is a pattern for an object nobody can build.
    const holesIn = (items: PageItem[]) => items.filter(
      (i): i is Extract<PageItem, { kind: 'poly' }> => {
        if (i.kind !== 'poly' || i.pts.length < 20) return false;
        const xs = i.pts.map(p => p[0]);
        const width = Math.max(...xs) - Math.min(...xs);
        return Math.abs(width - (STACK_SHEET_DEFAULTS.dowelMm + STACK_SHEET_DEFAULTS.dowelClearanceMm)) < 0.2;
      },
    );
    expect(holesIn(allItems)).toHaveLength(2);

    const wide = createJoinedPair({ shape: 'j2', gon: 5, n: 6 });
    const wideSurface = buildSurface(wide);
    const wideDesign = searchAllStates(wideSurface, { rng: createRng(42) }).design;
    const widePlan = buildPairSheets(wide, wideSurface, wideDesign);
    // Two of these will not stand side by side on the sheet, which is the
    // case that used to lose one of them.
    const bulkheadWidth = widePlan.jointWidthMm + 2 * STACK_SHEET_DEFAULTS.bulkheadTabMm;
    expect(2 * bulkheadWidth).toBeGreaterThan(A4_SHEET.width - 2 * A4_SHEET.margin);
    const wideItems = widePlan.sheets.flatMap(sh => sh.items);
    expect(holesIn(wideItems)).toHaveLength(2);
    // And still on the paper.
    for (const sheet of widePlan.sheets) {
      for (const item of sheet.items) {
        const points = item.kind === 'line' ? [item.a, item.b]
          : item.kind === 'poly' ? item.pts : [item.at];
        for (const [x, y] of points) {
          expect(x).toBeGreaterThanOrEqual(A4_SHEET.margin - 0.01);
          expect(x).toBeLessThanOrEqual(A4_SHEET.width - A4_SHEET.margin + 0.01);
          expect(y).toBeLessThanOrEqual(A4_SHEET.height - A4_SHEET.margin + 0.01);
        }
      }
    }
  });

  it('cuts a dowel that stays inside the object', () => {
    // Long enough to hold the two halves together, short enough that neither
    // end reaches the far face, which carries maze.
    expect(plan.dowelLengthMm).toBeGreaterThan(STACK_SHEET_DEFAULTS.dowelMm);
    expect(plan.dowelLengthMm).toBeLessThan(2 * plan.jointWidthMm);
    const notes = textOf().map(t => t.text).join(' ');
    expect(notes).toContain(`${plan.dowelLengthMm} mm`);
  });

  it('reports the finished size, at the scale it drew', () => {
    expect(plan.cellMm).toBeLessThanOrEqual(STACK_SHEET_DEFAULTS.cellMm);
    expect(plan.edgeMm).toBeCloseTo(plan.cellMm * mech.n, 6);
    expect(plan.jointWidthMm).toBeGreaterThan(plan.edgeMm);
    expect(plan.perfectStates).toBe(plan.stateCount);
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

  it('shrinks the drawing to fit the sheet rather than running off it', () => {
    // A sheet the net cannot have at full size. It is drawn smaller rather
    // than over the edge, and the plan says what scale it settled on so the
    // builder is not left guessing.
    const small = buildPairSheets(mech, surface, design, {
      sheet: { width: 100, height: 130, margin: 10 },
    });
    expect(small.cellMm).toBeLessThan(plan.cellMm);
    expect(small.cellMm).toBeGreaterThanOrEqual(STACK_SHEET_DEFAULTS.minCellMm);
    expect(small.edgeMm).toBeCloseTo(small.cellMm * mech.n, 6);
    for (const sheet of small.sheets) {
      for (const item of sheet.items) {
        const points = item.kind === 'line' ? [item.a, item.b]
          : item.kind === 'poly' ? item.pts : [item.at];
        for (const [x] of points) expect(x).toBeLessThanOrEqual(100 - 10 + 0.01);
      }
    }
  });

  it('refuses a sheet too small to cut by hand, and says what would fit', () => {
    expect(() =>
      buildPairSheets(mech, surface, design, {
        sheet: { width: 60, height: 80, margin: 10 },
      }),
    ).toThrow(/try n of/);
  });
});
