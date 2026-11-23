/**
 * The printable pattern for the interchange maze.
 *
 * The cubes and how they fold up are the folding maze's, and
 * `fold-sheets.test.ts` holds them to the solid. What is this pattern's own
 * is what is printed beside the walls — a start, a goal and a symbol on every
 * station, each once, each on its own cube and clear of every wall — and what
 * the first sheet says, which has to be the rule of this maze and must not be
 * the folding maze's promise that every shape is a perfect one.
 */
import { describe, it, expect } from 'vitest';
import { buildSurface } from '../kinetic/surface.ts';
import { poseDistances } from '../kinetic/fold-path.ts';
import { createCubeRing } from '../kinetic/mechanisms/cube-ring.ts';
import { INFINITY_CUBE } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { buildInterchangeWorld, findInterchangeMaze } from '../kinetic/interchange.ts';
import { walkedStates } from '../../ui/interchange-objects.ts';
import { STATION_SYMBOLS, stationGlyph } from '../../render/interchange-geometry.ts';
import { buildInterchangeSheets, interchangeNotes } from '../../render/interchange-sheet-model.ts';
import { FOLD_SHEET_STYLE } from '../../render/fold-sheet-constants.ts';
import { A4_SHEET } from '../../render/kinetic-sheet-constants.ts';
import type { PageItem } from '../../render/face-page-model.ts';

function made(cells: number, stations: number, folds: number, seed: number) {
  const mech = createCubeRing(INFINITY_CUBE, { cells });
  const surface = buildSurface(mech, { maxStates: mech.states.length });
  const world = buildInterchangeWorld(surface, walkedStates(mech), poseDistances(mech.foldGraph()));
  const { maze } = findInterchangeMaze(world, { stations, folds, seed });
  return { mech, world, maze, plan: buildInterchangeSheets(mech, world, maze) };
}

const { mech, world, maze, plan } = made(3, 5, 2, 42);

type Line = Extract<PageItem, { kind: 'line' }>;
const sameColour = (a: readonly number[], b: readonly number[]): boolean =>
  a.every((x, i) => x === b[i]);
const symbolLines = (items: readonly PageItem[]): Line[] =>
  items.filter((item): item is Line =>
    item.kind === 'line' && sameColour(item.stroke, FOLD_SHEET_STYLE.glyphColor));
const written = (items: readonly PageItem[]): string[] =>
  items.flatMap(item => (item.kind === 'text' ? [item.text] : []));
const pieceOf = (cell: number): number => mech.cells[cell]!.piece;
const strokesOf = (station: number): number =>
  stationGlyph(mech.cells[maze.stations[station]!]!, station).length / 2;

describe('the sheets', () => {
  it('is one sheet of notes and one for each cube', () => {
    expect(plan.sheets.length).toBe(mech.pieceCount + 1);
    expect(plan.sheets[0]!.piece).toBeNull();
    expect(plan.sheets.slice(1).map(sheet => sheet.piece)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(plan.hingesOffBoundary).toBe(0);
  });

  it('keeps everything on the paper, at a coarse ruling and a fine one, few stations and many', () => {
    for (const other of [plan, made(2, 2, 1, 1).plan, made(6, 12, 3, 7).plan]) {
      for (const sheet of other.sheets) {
        for (const item of sheet.items) {
          const points = item.kind === 'poly' ? item.pts
            : item.kind === 'line' ? [item.a, item.b]
            : [item.at];
          for (const [x, y] of points) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(A4_SHEET.width);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(A4_SHEET.height);
          }
        }
      }
    }
  });
});

describe('what is printed on the cubes beside the walls', () => {
  it('is one S and one G, each on the cube whose cell carries it', () => {
    for (const sheet of plan.sheets.slice(1)) {
      const here = written(sheet.items).filter(text => text === 'S' || text === 'G').sort();
      const wanted = [
        ...(pieceOf(maze.goal) === sheet.piece ? ['G'] : []),
        ...(pieceOf(maze.start) === sheet.piece ? ['S'] : []),
      ];
      expect(here).toEqual(wanted);
    }
  });

  it('is a symbol on every station, on its own cube, and nothing else in that colour', () => {
    expect(maze.stations.length).toBeGreaterThan(1);
    for (const sheet of plan.sheets.slice(1)) {
      let wanted = 0;
      maze.stations.forEach((cell, station) => {
        if (pieceOf(cell) === sheet.piece) wanted += strokesOf(station);
      });
      expect(symbolLines(sheet.items).length).toBe(wanted);
    }
  });

  it('keeps a symbol clear of every wall, so that a square is not read as four of them', () => {
    const clear = plan.cellMm * 0.1;
    const black = (item: PageItem): item is Line => item.kind === 'line'
      && (sameColour(item.stroke, FOLD_SHEET_STYLE.wallColor)
        || sameColour(item.stroke, FOLD_SHEET_STYLE.boundaryColor));
    const distance = (p: readonly [number, number], wall: Line): number => {
      const [ax, ay] = wall.a;
      const [bx, by] = wall.b;
      const length2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = length2 === 0 ? 0
        : Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / length2));
      return Math.hypot(p[0] - (ax + t * (bx - ax)), p[1] - (ay + t * (by - ay)));
    };
    let measured = 0;
    for (const sheet of plan.sheets.slice(1)) {
      const walls = sheet.items.filter(black);
      for (const stroke of symbolLines(sheet.items)) {
        for (const end of [stroke.a, stroke.b]) {
          for (const wall of walls) expect(distance(end, wall)).toBeGreaterThan(clear);
          measured++;
        }
      }
    }
    expect(measured).toBeGreaterThan(0);
  });

  it('draws a symbol heavier on a larger cell, and never finer than prints', () => {
    const widths = (from: { plan: typeof plan }): Set<number> =>
      new Set(from.plan.sheets.slice(1).flatMap(sheet => symbolLines(sheet.items)).map(line => line.width));
    const coarse = [...widths(made(2, 2, 1, 1))];
    const fine = [...widths(made(6, 12, 3, 7))];
    expect(coarse).toHaveLength(1);
    expect(fine).toHaveLength(1);
    expect(coarse[0]!).toBeGreaterThan(fine[0]!);
    expect(fine[0]!).toBeGreaterThanOrEqual(FOLD_SHEET_STYLE.glyphMinWidth);
    expect(coarse[0]!).toBeLessThanOrEqual(FOLD_SHEET_STYLE.glyphMaxWidth);
  });
});

describe('the sheet that says how it is played', () => {
  const notes = plan.sheets[0]!.items;
  const text = written(notes).join(' ').replace(/\s+/g, ' ');

  it('is headed as this maze and not as the folding one', () => {
    expect(written(notes)[0]).toBe('Interchange maze — eight cubes taped into a ring');
    expect(text).not.toContain('Folding maze');
  });

  it('says the rule: walk in the shape it is in, fold on a mark and nowhere else', () => {
    expect(text).toContain('On a mark — the S, the G or a symbol — and nowhere else');
    expect(text).toContain('keeps the mark outside, the finger staying on it');
    expect(text).toContain('exactly one way from S to G');
  });

  it('does not promise a perfect maze in any shape', () => {
    expect(text).not.toContain('perfect');
    expect(text).toContain('A part of a shape with no mark in it cannot be entered in that shape.');
  });

  it('says which shapes are walked in and which are only folded through', () => {
    expect(text).toContain('The ring shuts into ten shapes');
    expect(text).toContain(
      'walked in six of them, the four planks and the two cubes; the four hooks are only folded through.',
    );
  });

  it('still says how the cubes are taped, and marks the tape', () => {
    expect(text).toContain('hinge them with clear tape along the orange bars');
    const bars = notes.filter(item =>
      item.kind === 'line' && sameColour(item.stroke, FOLD_SHEET_STYLE.tapeColor));
    expect(bars.length).toBe(mech.pieceCount);
  });

  it('shows the symbols of this maze, as many as it has stations, above the drawings', () => {
    const firstView = notes.find(item => item.kind === 'text' && item.text === 'From above');
    const top = firstView && firstView.kind === 'text' ? firstView.at[1] : 0;
    const key = symbolLines(notes).filter(line => line.a[1] < top && line.b[1] < top);
    let wanted = 0;
    maze.stations.forEach((_, station) => {
      for (const stroke of STATION_SYMBOLS[station]!.strokes) wanted += stroke.length - 1;
    });
    expect(key.length).toBe(wanted);
    // And clear of the words that introduce them.
    const label = notes.find(item => item.kind === 'text' && item.text.startsWith('The symbols'));
    expect(label).toBeDefined();
    const left = Math.min(...key.flatMap(line => [line.a[0], line.b[0]]));
    expect(left).toBeGreaterThan(A4_SHEET.margin + 30);
  });

  it('says only what is true of the maze in hand', () => {
    const say = (m: { folds: number; offRoute: number; stations: number[] }): string =>
      interchangeNotes(mech, world, m).sentences.join(' ');
    expect(say({ folds: 2, offRoute: 1, stations: [1, 2] })).toContain('Not every symbol is on the way.');
    expect(say({ folds: 2, offRoute: 0, stations: [1, 2] })).not.toContain('Not every symbol');
    expect(say({ folds: 2, offRoute: 1, stations: [1, 2] })).toContain('and it crosses shapes');
    expect(say({ folds: 0, offRoute: 1, stations: [1, 2] })).not.toContain('crosses shapes');
    expect(interchangeNotes(mech, world, { folds: 1, offRoute: 0, stations: [1] }).key?.label)
      .toBe('The symbol on this one:');
  });
});
