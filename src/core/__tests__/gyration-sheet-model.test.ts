import { describe, it, expect } from 'vitest';
import { createGyration, GYRATIONS } from '../kinetic/mechanisms/gyration.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { expandCutClasses, pickStartGoal } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { buildGyrationSheets } from '../../render/gyration-sheet-model.ts';
import {
  A4_SHEET,
  STACK_SHEET_STYLE,
  STACK_SHEET_DEFAULTS,
} from '../../render/kinetic-sheet-constants.ts';
import type { PageItem } from '../../render/face-page-model.ts';
import { jsPDF } from 'jspdf';

function sheetsFor(shape: string, n: number, seed = 20260917) {
  const mech = createGyration({ shape, n });
  const surface = buildSurface(mech);
  const rng = createRng(seed);
  const design = contractedSearch(surface, {
    rng,
    openCutClasses: expandCutClasses(surface, { rng, extra: 0 }),
    maxRounds: 48,
  }).design;
  return { mech, surface, design, plan: buildGyrationSheets(mech, surface, design) };
}

const two = sheetsFor('cuboctahedron', 3);
const three = sheetsFor('icosahedron', 2);

const itemsOf = (plan: { sheets: { items: PageItem[] }[] }) => plan.sheets.flatMap(s => s.items);
const textOf = (plan: { sheets: { items: PageItem[] }[] }) =>
  itemsOf(plan).filter((i): i is Extract<PageItem, { kind: 'text' }> => i.kind === 'text');

describe('cut-solid sheets', () => {
  it('draws one wall for every closed side of every piece', () => {
    const { surface, design, plan } = two;
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
    const walls = itemsOf(plan).filter(
      (i): i is Extract<PageItem, { kind: 'line' }> => i.kind === 'line' &&
        (i.stroke === STACK_SHEET_STYLE.wallColor || i.stroke === STACK_SHEET_STYLE.boundaryColor),
    );
    expect(walls).toHaveLength(closed);
  });

  it('prints every piece, and its hardware once per cut', () => {
    const labels = textOf(three.plan).map(t => t.text);
    expect(labels).toContain('Bottom piece (1 of 3) — 5 faces');
    expect(labels).toContain('Middle piece (2 of 3) — 10 faces');
    expect(labels).toContain('Top piece (3 of 3) — 5 faces');
    // Two cuts: two headings of two bulkheads each, and four discs.
    expect(labels.filter(t => t.startsWith('Bulkheads (2)'))).toHaveLength(2);
    expect(labels.some(t => t.startsWith('Retaining discs (4)'))).toBe(true);
    expect(three.plan.dowelLengthsMm).toHaveLength(2);

    const pairLabels = textOf(two.plan).map(t => t.text);
    expect(pairLabels).toContain('Lower piece (1 of 2) — 7 faces');
    expect(pairLabels).toContain('Upper piece (2 of 2) — 7 faces');
    expect(pairLabels.filter(t => t.startsWith('Bulkheads (2)'))).toHaveLength(1);
    expect(two.plan.dowelLengthsMm).toHaveLength(1);
  });

  it('marks the entrance and the exit once each', () => {
    const letters = textOf(two.plan).filter(t => t.text === 'S' || t.text === 'G');
    expect(letters.map(t => t.text).sort()).toEqual(['G', 'S']);
    const ends = pickStartGoal(two.surface, two.design);
    expect(ends.start).not.toBe(ends.goal);
  });

  it('keeps every line of the sheet on the paper', () => {
    for (const plan of [two.plan, three.plan]) {
      for (const sheet of plan.sheets) {
        for (const item of sheet.items) {
          const points = item.kind === 'line' ? [item.a, item.b]
            : item.kind === 'poly' ? item.pts : [item.at];
          for (const [x, y] of points) {
            expect(x).toBeGreaterThanOrEqual(A4_SHEET.margin - 0.01);
            expect(x).toBeLessThanOrEqual(A4_SHEET.width - A4_SHEET.margin + 0.01);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(A4_SHEET.height - A4_SHEET.margin + 0.01);
          }
        }
      }
    }
  });

  it('keeps every line of writing inside the margins too', () => {
    // Nothing wraps text here: a note written one word too long runs off the
    // right-hand edge and is simply lost — which is how the assembly step that
    // named the second cut went missing the first time. Measured with the very
    // font the painter sets, rather than by counting characters, because the
    // line that overflowed was only a few millimetres over.
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const usable = A4_SHEET.width - 2 * A4_SHEET.margin;
    for (const plan of [two.plan, three.plan]) {
      for (const line of textOf(plan)) {
        if (line.align !== 'left') continue; // a letter on a cell, centred on it
        doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
        doc.setFontSize(line.size * (72 / 25.4));
        expect(doc.getTextWidth(line.text)).toBeLessThanOrEqual(usable);
      }
    }
  });

  it('prints every piece at the one scale, or they would not meet', () => {
    // A piece drawn to its own sheet would come out a different size from its
    // neighbour, and the cut would not line up.
    expect(three.plan.cellMm).toBeGreaterThanOrEqual(STACK_SHEET_DEFAULTS.minCellMm);
    expect(three.plan.edgeMm).toBeCloseTo(three.plan.cellMm * three.mech.n, 6);
  });

  it('says so rather than printing a pattern too small to cut', () => {
    expect(() => sheetsFor('rhombicosidodecahedron', 4)).toThrow(/under the 5 mm/);
  });

  it('prints a pattern for every cut on offer at its default ruling', () => {
    for (const choice of GYRATIONS) {
      const plan = sheetsFor(choice.shape, 2).plan;
      expect(plan.sheets.length).toBeGreaterThan(0);
      expect(plan.cellMm).toBeGreaterThanOrEqual(STACK_SHEET_DEFAULTS.minCellMm);
    }
  });
});
