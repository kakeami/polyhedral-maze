/**
 * The printable pattern for the folding maze.
 *
 * What is worth checking on a pattern is that it folds back into the thing it
 * was cut from: two squares that end up side by side on the page have to be
 * two squares that share an edge on the cube, and the edge they share has to
 * be the same edge. Everything else here — where the tabs go, where the tape
 * is named — follows from that, and is checked for the one thing a drawing can
 * get wrong on its own, which is falling off the sheet.
 */
import { describe, it, expect } from 'vitest';
import { CUBE_RING_OBJECTS, createInfinityCube } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { createCubeRing } from '../kinetic/mechanisms/cube-ring.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { cubeRingDesigns } from '../kinetic/mechanisms/cube-ring-designs.ts';
import { decodeOpenClasses } from '../kinetic/stored-design.ts';
import { FOLD_SHEET_STYLE } from '../../render/fold-sheet-constants.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { pickPrintedEnds, searchAllStates } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { buildFoldSheets, foldNetFaces, faceNumberOf } from '../../render/fold-sheet-model.ts';
import { A4_SHEET } from '../../render/kinetic-sheet-constants.ts';
import type { Vec3 } from '../types.ts';
import { add, cross, dot, scale } from '../vec3.ts';

const mech = createInfinityCube({ cells: 2 });
const surface = buildSurface(mech);
const design = searchAllStates(surface, { rng: createRng(2) }).design;
const ends = pickPrintedEnds(surface, design);
const plan = buildFoldSheets(mech, surface, design, { ends });

/** The four corners of a face of the unit cube, from its frame. */
function corners(normal: Vec3, right: Vec3, up: Vec3): Vec3[] {
  const half = scale(normal, 0.5);
  return [[0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]].map(([r, u]) =>
    add(half, add(scale(right, r!), scale(up, u!))));
}

const key = (v: Vec3) => v.map(x => x.toFixed(3)).join(',');
const edgeOf = (points: Vec3[]) => points.map(key).sort().join('|');

describe('the net of one cube', () => {
  const faces = foldNetFaces(mech, 0);

  it('lays all six faces down, each the right way round', () => {
    expect(faces.length).toBe(6);
    expect(new Set(faces.map(f => f.face)).size).toBe(6);
    for (const face of faces) {
      // Printed side up: right cross up is out of the page, towards the reader,
      // which is what puts the maze on the outside of the finished cube.
      // Rounded through zero: -0 and 0 are the same direction and not the
      // same value.
      expect(cross(face.right, face.up).map(x => Math.round(x) + 0)).toEqual(
        face.normal.map(x => x + 0));
      expect(faceNumberOf(face.normal)).toBe(face.face);
      expect(Math.abs(dot(face.right, face.up))).toBeLessThan(1e-9);
    }
  });

  it('puts squares side by side only where the cube has them side by side', () => {
    let creases = 0;
    for (const a of faces) {
      for (const b of faces) {
        const across = a.col === b.col && a.row === b.row - 1 ? 'up'
          : a.col === b.col - 1 && a.row === b.row ? 'right'
          : null;
        if (!across) continue;
        creases++;
        // The side they meet along, in each one's own frame, is one edge of
        // the cube — the same edge, or the paper would tear as it folded.
        const [ar, au] = [a.right, a.up];
        const [br, bu] = [b.right, b.up];
        const mine = across === 'up'
          ? corners(a.normal, ar, au).filter(v => Math.abs(dot(v, au) - 0.5) < 1e-9)
          : corners(a.normal, ar, au).filter(v => Math.abs(dot(v, ar) - 0.5) < 1e-9);
        const theirs = across === 'up'
          ? corners(b.normal, br, bu).filter(v => Math.abs(dot(v, bu) + 0.5) < 1e-9)
          : corners(b.normal, br, bu).filter(v => Math.abs(dot(v, br) + 0.5) < 1e-9);
        expect(edgeOf(mine)).toBe(edgeOf(theirs));
        expect(a.folds).toContain(across);
      }
    }
    expect(creases).toBe(5); // a net of six squares is a tree
  });

  it('brings both hinges of every cube out on the cut line', () => {
    // Which is what lets the tape be named in the margin instead of across the
    // maze, and is the whole reason the net is turned rather than laid down
    // any old way.
    expect(plan.hingesOffBoundary).toBe(0);
  });
});

describe('the sheets', () => {
  it('is one sheet of notes and one for each cube', () => {
    expect(plan.sheets.length).toBe(mech.pieceCount + 1);
    expect(plan.sheets[0]!.piece).toBeNull();
    expect(plan.sheets.slice(1).map(s => s.piece)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('prints as large a cube as the sheet takes, and says how large', () => {
    expect(plan.edgeMm).toBeGreaterThanOrEqual(55);
    expect(plan.edgeMm).toBeLessThanOrEqual(63);
    expect(plan.cellMm).toBeCloseTo(plan.edgeMm / mech.cellsPerFace, 9);
  });

  it('keeps everything on the paper, tabs and tape marks included', () => {
    for (const sheet of plan.sheets) {
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
  });

  it('prints both marks of both markers, and nothing else in writing', () => {
    const letters = plan.sheets
      .slice(1)
      .flatMap(sheet => sheet.items)
      .filter(item => item.kind === 'text' && (item.text === 'S' || item.text === 'G'))
      .map(item => (item.kind === 'text' ? item.text : ''));
    expect(letters.sort().join('')).toBe('GGSS');

    // And each of them on the cube whose cell carries it — a cube can carry
    // more than one, since nothing says the four cells are on four cubes.
    const perPiece = 6 * mech.cellsPerFace * mech.cellsPerFace;
    const wanted = new Map<number, string[]>();
    const note = (cell: number, letter: string) => {
      const piece = Math.floor(cell / perPiece);
      wanted.set(piece, [...(wanted.get(piece) ?? []), letter].sort());
    };
    for (const cell of ends.start) note(cell, 'S');
    for (const cell of ends.goal) note(cell, 'G');
    for (const sheet of plan.sheets.slice(1)) {
      const here = sheet.items
        .filter(item => item.kind === 'text' && (item.text === 'S' || item.text === 'G'))
        .map(item => (item.kind === 'text' ? item.text : ''))
        .sort();
      expect(here).toEqual(wanted.get(sheet.piece!) ?? []);
    }
  });

  it('names the tape on both halves of each hinge, twice a cube', () => {
    for (const sheet of plan.sheets.slice(1)) {
      const labels = sheet.items
        .filter(item => item.kind === 'text' && item.text.startsWith('tape to cube'))
        .map(item => (item.kind === 'text' ? item.text : ''));
      // Two hinges a cube, and each comes out at two places on the boundary.
      expect(labels.length).toBe(4);
      expect(new Set(labels).size).toBe(2);
    }
  });
});

describe('the sheet that says how the cubes go together', () => {
  const orange = (colour: readonly number[] | undefined): boolean =>
    !!colour && colour.every((x, i) => x === FOLD_SHEET_STYLE.tapeColor[i]);

  for (const object of CUBE_RING_OBJECTS) {
    const ring = createCubeRing(object, { cells: 2 });
    const skin = buildSurface(ring, { maxStates: ring.states.length });
    const stored = cubeRingDesigns(object.id, 2)[0]!;
    const sheets = buildFoldSheets(ring, skin, { open: decodeOpenClasses(stored) });
    const first = sheets.sheets[0]!.items;
    const notes = first
      .filter(item => item.kind === 'text')
      .map(item => (item.kind === 'text' ? item.text : ''))
      .join(' ');

    it(`${object.id}: is one sheet of notes and one for each cube`, () => {
      expect(sheets.sheets.length).toBe(ring.pieceCount + 1);
      expect(sheets.sheets[0]!.piece).toBeNull();
      expect(sheets.hingesOffBoundary).toBe(0);
    });

    it(`${object.id}: draws every cube of the shape it draws`, () => {
      // Every cube is numbered where it is drawn, and every cube is drawn:
      // a builder holding cube seven has to be able to find it. From above
      // and from below a flat ring is there twice over, and a side view adds
      // whichever cubes look that way.
      const numbered = first
        .filter(item => item.kind === 'text' && /^\d+$/.test(item.text))
        .map(item => Number(item.kind === 'text' ? item.text : '0'));
      expect(new Set(numbered).size).toBe(ring.pieceCount);
      expect(numbered.length).toBeGreaterThanOrEqual(2 * ring.pieceCount);
    });

    it(`${object.id}: marks every strip of tape, or says to tape it in order`, () => {
      // A strip is marked by a bar along the edge it lies on, or — where it
      // runs down a corner, which is a point rather than a line from above —
      // by a dot. What it must never be is half-marked: either the shape
      // drawn can be taped as it lies, and then every strip is on the page,
      // or it cannot, and the notes say how it is taped instead.
      const marks = first.filter(item =>
        (item.kind === 'line' && orange(item.stroke))
        || (item.kind === 'poly' && orange(item.fill))).length;
      if (marks > 0) {
        expect(marks).toBe(ring.tapeSeams().length);
        expect(notes).toContain('as the views below show');
      } else {
        expect(notes).toContain('in ring order');
        expect(notes).toContain('cannot be taped lying flat');
      }
    });

    it(`${object.id}: keeps everything on the paper`, () => {
      for (const sheet of sheets.sheets) {
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
    });
  }
});

describe('a ring whose tape cannot go on where it lies', () => {
  // Not an object the page offers — it shuts sixteen ways and all sixteen look
  // the same, which is not worth building — but it is the case the assembly
  // sheet has to be honest about, and nothing in the catalogue is it. Eight of
  // its ten hinges run down the corners of a staircase, and in every shape it
  // takes, at least one cube is lying against the face a strip would have to
  // be pressed onto. So there is nowhere to lay it out and tape it, and the
  // notes have to say the other true thing.
  const stair = createCubeRing({
    id: 'stair-ring',
    label: 'Ten cubes on a staircase',
    blurb: '',
    ring: [
      [0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 2, 0], [1, 3, 0],
      [2, 3, 0], [2, 2, 0], [2, 1, 0], [1, 1, 0], [1, 0, 0],
    ],
    hinges: [0, 2, 3, 2, 3, 2, 0, 1, 0, 1],
    maxCells: 10,
  }, { cells: 2 });
  const skin = buildSurface(stair, { maxStates: stair.states.length });
  const sheets = buildFoldSheets(stair, skin, contractedSearch(skin, { rng: createRng(1) }).design);
  const first = sheets.sheets[0]!.items;

  it('says to tape it in ring order, and marks no tape at all', () => {
    const notes = first
      .filter(item => item.kind === 'text')
      .map(item => (item.kind === 'text' ? item.text : ''))
      .join(' ');
    expect(notes).toContain('in ring order');
    expect(notes).toContain('cannot be taped lying flat');
    const marks = first.filter(item =>
      (item.kind === 'line' && item.stroke[0] === FOLD_SHEET_STYLE.tapeColor[0]
        && item.stroke[1] === FOLD_SHEET_STYLE.tapeColor[1])
      || (item.kind === 'poly' && item.fill?.[0] === FOLD_SHEET_STYLE.tapeColor[0]
        && item.fill?.[1] === FOLD_SHEET_STYLE.tapeColor[1]));
    expect(marks.length).toBe(0);
  });

  it('still draws every cube, so the finished ring can be checked against it', () => {
    const numbered = first
      .filter(item => item.kind === 'text' && /^\d+$/.test(item.text))
      .map(item => Number(item.kind === 'text' ? item.text : '0'));
    expect(new Set(numbered).size).toBe(stair.pieceCount);
  });
});
