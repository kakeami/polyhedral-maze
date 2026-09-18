/**
 * The printable pattern for a ring of prisms.
 *
 * The pattern has one job beyond drawing the maze: say what is taped to what,
 * and say it somewhere that is cut away rather than printed on the model. So
 * what is checked is that every hinge came out on a *cut line* of its net
 * (an edge inside the net is a fold, and a label there would be on the
 * finished piece), that every label names the piece the ring order says it
 * should, and that nothing falls off the sheet.
 *
 * The maze itself is checked where it is made (`kinetic-honeycomb-ring.test.ts`);
 * here it only has to arrive on the paper.
 */
import { describe, it, expect } from 'vitest';
import { HEX_RING, createHexRing } from '../kinetic/mechanisms/honeycomb-ring-objects.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { pickPrintedEnds, treeRate } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { buildHoneycombSheets } from '../../render/honeycomb-sheet-model.ts';
import { createHoneycombRing, prismStrip } from '../kinetic/mechanisms/honeycomb-ring.ts';
import { A4_SHEET, STACK_SHEET_DEFAULTS } from '../../render/kinetic-sheet-constants.ts';
import { FOLD_SHEET_STYLE } from '../../render/fold-sheet-constants.ts';

const mech = createHexRing({ cells: 3 });
const surface = buildSurface(mech, { maxStates: mech.states.length });
const design = contractedSearch(surface, {
  rng: createRng(42), iterations: 40000, maxRounds: 40, restarts: 2,
}).design;
const ends = pickPrintedEnds(surface, design);
const plan = buildHoneycombSheets(mech, surface, design, { ends });

const texts = (sheet: { items: readonly unknown[] }): string[] =>
  sheet.items.filter((item): item is { kind: 'text'; text: string } =>
    (item as { kind: string }).kind === 'text').map(item => item.text);

describe('the pattern for six hexagonal prisms', () => {
  it('is a sheet of notes and a sheet a piece', () => {
    expect(plan.sheets.length).toBe(mech.pieceCount + 1);
    expect(plan.perfectStates).toBe(surface.stateCount);
    expect(treeRate(surface, design).perfect).toBe(surface.stateCount);
  });

  it('brings every hinge out on a cut line, so no label is left on the model', () => {
    // Twelve of them: two a piece, six pieces. A hinge inside the net would be
    // a fold, and the label would be printed on the finished prism.
    expect(plan.hingesOffBoundary).toBe(0);
  });

  it('prints the piece as large as a sheet holds, and refuses a cell a knife cannot follow', () => {
    // The net is turned to suit the paper, which is worth a quarter of the size
    expect(plan.edgeMm).toBeGreaterThan(40);
    expect(plan.cellMm).toBeCloseTo(plan.edgeMm / 3, 6);
    expect(plan.cellMm).toBeGreaterThan(STACK_SHEET_DEFAULTS.minCellMm);
    // and at the finest ruling the object offers it is still above that floor,
    // which is what `maxCells` is for
    const finest = createHexRing({ cells: HEX_RING.maxCells });
    const fineSurface = buildSurface(finest, { maxStates: finest.states.length });
    const fineDesign = contractedSearch(fineSurface, {
      rng: createRng(1), iterations: 40000, maxRounds: 40, restarts: 2,
    }).design;
    const fine = buildHoneycombSheets(finest, fineSurface, fineDesign);
    expect(fine.cellMm).toBeGreaterThanOrEqual(STACK_SHEET_DEFAULTS.minCellMm);
    // one finer would be under it: the pattern says so by refusing to draw
    expect(() => buildHoneycombSheets(
      createHexRing({ cells: HEX_RING.maxCells + 3 }),
      fineSurface,
      fineDesign,
    )).toThrow(/knife|cells of/);
  });

  it('names, on each piece, the pieces the ring order joins it to', () => {
    const seams = mech.tapeSeams();
    for (let piece = 0; piece < mech.pieceCount; piece++) {
      const neighbours = seams
        .filter(seam => seam.pieces.includes(piece))
        .map(seam => seam.pieces[0] === piece ? seam.pieces[1] : seam.pieces[0]);
      expect(neighbours.length).toBe(2);
      const said = texts(plan.sheets[piece + 1]!);
      expect(said.some(text => text.startsWith(`Piece ${piece + 1} of 6`))).toBe(true);
      for (const to of neighbours) {
        // both copies of each hinge edge carry the label
        expect(said.filter(text => text === `tape to piece ${to + 1}`).length)
          .toBeGreaterThanOrEqual(1);
      }
      // and it never names a piece the ring does not join it to
      const named = said
        .filter(text => text.startsWith('tape to piece '))
        .map(text => Number(text.slice('tape to piece '.length)) - 1);
      expect(new Set(named)).toEqual(new Set(neighbours));
    }
  });

  it('draws the layout with every strip of tape on it', () => {
    expect(plan.tapeDrawn).toBe(true);
    const notes = plan.sheets[0]!;
    // the pieces are numbered on the drawing, one to a piece
    const said = texts(notes);
    for (let piece = 1; piece <= mech.pieceCount; piece++) {
      expect(said).toContain(String(piece));
    }
    // and each strip is a bar or a dot in the tape colour
    const tapeItems = notes.items.filter(item => {
      const at = item as { kind: string; stroke?: number[]; fill?: number[] };
      const colour = at.kind === 'line' ? at.stroke : at.fill;
      return colour?.join(',') === FOLD_SHEET_STYLE.tapeColor.join(',');
    });
    expect(tapeItems.length).toBe(mech.tapeSeams().length);
  });

  it('says what the object does, in words, before it is built', () => {
    const said = texts(plan.sheets[0]!).join(' ');
    expect(said).toContain('a ring with a hole through it');
    expect(said).toContain('one strip of tape pinched');
    expect(said).toContain('S to G');
    for (const pose of mech.poses) expect(said).toContain(pose.label);
  });

  it('keeps everything on the paper', () => {
    for (const sheet of plan.sheets) {
      for (const item of sheet.items) {
        const points = item.kind === 'poly' ? item.pts
          : item.kind === 'line' ? [item.a, item.b]
            : [item.at];
        for (const [x, y] of points) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(A4_SHEET.width);
          expect(y).toBeLessThanOrEqual(A4_SHEET.height);
        }
      }
    }
  });

  it('refuses a layout whose hinges cannot be named on a cut line', () => {
    // Six triangular prisms in a strip two layers deep: a real object, and one
    // whose nets leave two of its twelve taped edges *inside* the net, where a
    // label would be printed on the finished piece. Half a marking is worse
    // than none — a bar left off leaves a builder guessing which edge to tape
    // — so the pattern says so instead of drawing it.
    const strip = createHoneycombRing({
      id: 'strip-fixture',
      label: 'A strip of six',
      blurb: '',
      honeycomb: 'triprism',
      ring: prismStrip(3),
      hinges: [1, 0, 1, 3, 0, 1],
      maxCells: 6,
    }, { cells: 3 });
    const stripSurface = buildSurface(strip, { maxStates: strip.states.length });
    const stripDesign = contractedSearch(stripSurface, {
      rng: createRng(1), iterations: 40000, maxRounds: 40, restarts: 2,
    }).design;
    expect(() => buildHoneycombSheets(strip, stripSurface, stripDesign))
      .toThrow(/come out inside a net/);
  });

  it('prints both cells of each marker, and only those', () => {
    const letters = plan.sheets.flatMap(sheet => texts(sheet)).filter(t => t === 'S' || t === 'G');
    expect(letters.filter(t => t === 'S').length).toBe(ends.start.length);
    expect(letters.filter(t => t === 'G').length).toBe(ends.goal.length);
    expect(ends.start.length).toBe(2);
    expect(ends.goal.length).toBe(2);
  });
});
