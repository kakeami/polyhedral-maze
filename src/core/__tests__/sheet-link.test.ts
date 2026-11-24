/**
 * The QR code on a pattern's first sheet: the way back from the paper to the
 * page.
 *
 * Two things can go wrong with it and neither shows in a type. The symbol can
 * be drawn so that no reader takes it — turned over its diagonal it is a
 * mirror image, and it looks exactly as plausible — so it is held against the
 * library's own drawing of the same link. And something else on the sheet can
 * run into it or into the clear band a reader needs round it, which is a
 * question about how wide a line of notes prints, so the words are measured
 * with the face they are set in.
 *
 * All seven patterns are asked, since each lays out its own first sheet.
 */
import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { buildSurface } from '../kinetic/surface.ts';
import { createRng } from '../prng.ts';
import { generateKineticMaze, pickPrintedEnds } from '../kinetic/maze.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { decodeOpenClasses } from '../kinetic/stored-design.ts';
import { poseDistances } from '../kinetic/fold-path.ts';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { createJoinedPair } from '../kinetic/mechanisms/joined.ts';
import { createGyration } from '../kinetic/mechanisms/gyration.ts';
import { createCubeRing } from '../kinetic/mechanisms/cube-ring.ts';
import { INFINITY_CUBE, cubeRingObject } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { cubeRingDesigns } from '../kinetic/mechanisms/cube-ring-designs.ts';
import { createHalfCubeRing, STAR_CUBE } from '../kinetic/mechanisms/half-cube-ring.ts';
import { halfCubeRingDesign } from '../kinetic/mechanisms/half-cube-ring-designs.ts';
import { createHexRing } from '../kinetic/mechanisms/honeycomb-ring-objects.ts';
import { buildInterchangeWorld, findInterchangeMaze } from '../kinetic/interchange.ts';
import { walkedStates } from '../../ui/interchange-objects.ts';
import { buildStackSheets } from '../../render/stack-sheet-model.ts';
import { buildPairSheets } from '../../render/pair-sheet-model.ts';
import { buildGyrationSheets } from '../../render/gyration-sheet-model.ts';
import { buildFoldSheets } from '../../render/fold-sheet-model.ts';
import { buildHalfCubeSheets } from '../../render/half-cube-sheet-model.ts';
import { buildHoneycombSheets } from '../../render/honeycomb-sheet-model.ts';
import { buildInterchangeSheets } from '../../render/interchange-sheet-model.ts';
import { linkModules, sheetLink } from '../../render/sheet-link.ts';
import { A4_SHEET, SHEET_LINK_STYLE } from '../../render/kinetic-sheet-constants.ts';
import type { PageItem } from '../../render/face-page-model.ts';

// As long as a page makes them: the longest solid's name, every dial off its
// default, a six-figure seed.
const LINK = 'https://example.github.io/polyhedral-maze/turning/'
  + '?mech=cut&cut=rhombicosidodecahedron&cn=2&k=3&seed=987654&effort=8';

type Poly = Extract<PageItem, { kind: 'poly' }>;
type Text = Extract<PageItem, { kind: 'text' }>;

const link = sheetLink(LINK, A4_SHEET);
const boxes = link.items.filter((item): item is Poly => item.kind === 'poly');
const { at: [x0, y0], sizeMm, modules } = link.symbol;
const moduleMm = sizeMm / modules;

/** The modules the drawing makes dark, read back off its boxes. */
function drawn(): Set<string> {
  const dark = new Set<string>();
  for (const box of boxes) {
    const xs = box.pts.map(p => p[0]);
    const ys = box.pts.map(p => p[1]);
    const row = Math.round((Math.min(...ys) - y0) / moduleMm);
    const from = Math.round((Math.min(...xs) - x0) / moduleMm);
    const to = Math.round((Math.max(...xs) - x0) / moduleMm);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(moduleMm, 9);
    for (let col = from; col < to; col++) dark.add(`${row},${col}`);
  }
  return dark;
}

describe('the QR code', () => {
  it('stands in the top right corner, inside the margins', () => {
    expect(x0 + sizeMm).toBeCloseTo(A4_SHEET.width - A4_SHEET.margin, 9);
    expect(y0).toBeCloseTo(A4_SHEET.margin, 9);
    expect(sizeMm).toBe(SHEET_LINK_STYLE.sizeMm);
    for (const box of boxes) {
      for (const [x, y] of box.pts) {
        expect(x).toBeGreaterThanOrEqual(x0 - 1e-9);
        expect(x).toBeLessThanOrEqual(x0 + sizeMm + 1e-9);
        expect(y).toBeGreaterThanOrEqual(y0 - 1e-9);
        expect(y).toBeLessThanOrEqual(y0 + sizeMm + 1e-9);
      }
    }
  });

  it('is the symbol the library draws for the same link, the same way round', async () => {
    // The library's own renderer, asked for a path: a row is `M col row+0.5`,
    // then runs `h length` with gaps `m gap 0` between them.
    const svg = await QRCode.toString(LINK, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    const path = /stroke="#000000" d="([^"]+)"/.exec(svg)?.[1] ?? '';
    const theirs = new Set<string>();
    let col = 0;
    let row = 0;
    for (const [, command, first, second] of path.matchAll(/([Mmh])([\d.]+)(?: ([\d.]+))?/g)) {
      if (command === 'M') { col = Number(first); row = Number(second) - 0.5; }
      if (command === 'm') col += Number(first);
      if (command === 'h') {
        for (let i = 0; i < Number(first); i++) theirs.add(`${row},${col + i}`);
        col += Number(first);
      }
    }
    expect(theirs.size).toBeGreaterThan(modules * modules / 4);
    expect([...drawn()].sort()).toEqual([...theirs].sort());
  });

  it('has its three finders at the corners a reader looks in, and none at the fourth', () => {
    const dark = drawn();
    const finderAt = (row: number, col: number): boolean => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          if (dark.has(`${row + r},${col + c}`) !== (ring !== 2)) return false;
        }
      }
      return true;
    };
    expect(finderAt(0, 0)).toBe(true);
    expect(finderAt(0, modules - 7)).toBe(true);
    expect(finderAt(modules - 7, 0)).toBe(true);
    expect(finderAt(modules - 7, modules - 7)).toBe(false);
  });

  it('keeps a module a phone reads easily, for as long a link as a page makes', () => {
    expect(linkModules(LINK).size).toBe(modules);
    expect(moduleMm).toBeGreaterThan(0.5);
  });

  it('says under it what it is for', () => {
    const words = link.items.filter((item): item is Text => item.kind === 'text');
    expect(words.map(item => item.text)).toEqual([SHEET_LINK_STYLE.caption]);
    expect(words[0]!.at[1]).toBeGreaterThan(y0 + sizeMm + SHEET_LINK_STYLE.quietModules * moduleMm);
    expect(words[0]!.at[1]).toBeLessThan(link.keepClear.bottom);
  });
});

// ─── On each pattern ──────────────────────────────────────────────

type Sheets = { sheets: { items: PageItem[] }[] };
type Build = (url?: string) => Sheets;

function stack(): Build {
  const mech = createStack({ sides: 6, layers: 4, cols: 3, rows: 3 });
  const surface = buildSurface(mech);
  const design = generateKineticMaze(surface, { rng: createRng(20260912) });
  return url => buildStackSheets(mech, surface, design, { url });
}

function pair(shape: string, gon: number, n: number): Build {
  const mech = createJoinedPair({ shape, gon, n });
  const surface = buildSurface(mech);
  const design = generateKineticMaze(surface, { rng: createRng(20260914) });
  return url => buildPairSheets(mech, surface, design, { url });
}

function cut(shape: string, n: number): Build {
  const mech = createGyration({ shape, n });
  const surface = buildSurface(mech);
  const design = generateKineticMaze(surface, { rng: createRng(20260917) });
  return url => buildGyrationSheets(mech, surface, design, { url });
}

function cubes(id: string, cells: number): Build {
  const object = cubeRingObject(id);
  const mech = createCubeRing(object, { cells });
  const surface = buildSurface(mech, { maxStates: mech.states.length });
  const design = {
    open: decodeOpenClasses(cubeRingDesigns(object.id, cells)[0]!), openCutClasses: [], targetState: 0,
  };
  const ends = pickPrintedEnds(surface, design);
  return url => buildFoldSheets(mech, surface, design, { ends, url });
}

function halfCubes(): Build {
  const mech = createHalfCubeRing(STAR_CUBE, { cells: 3 });
  const surface = buildSurface(mech, { maxStates: mech.states.length });
  const design = {
    open: decodeOpenClasses(halfCubeRingDesign(STAR_CUBE.id, 3, 42)!), openCutClasses: [], targetState: 0,
  };
  return url => buildHalfCubeSheets(mech, surface, design, { url });
}

function prisms(): Build {
  const mech = createHexRing({ cells: 2 });
  const surface = buildSurface(mech, { maxStates: mech.states.length });
  const design = contractedSearch(surface, {
    rng: createRng(42), iterations: 40000, maxRounds: 40, restarts: 2,
  }).design;
  const ends = pickPrintedEnds(surface, design);
  return url => buildHoneycombSheets(mech, surface, design, { ends, url });
}

function interchange(cells: number, stations: number, folds: number, seed: number): Build {
  const mech = createCubeRing(INFINITY_CUBE, { cells });
  const surface = buildSurface(mech, { maxStates: mech.states.length });
  const world = buildInterchangeWorld(surface, walkedStates(mech), poseDistances(mech.foldGraph()));
  const { maze } = findInterchangeMaze(world, { stations, folds, seed });
  return url => buildInterchangeSheets(mech, world, maze, { url });
}

const PATTERNS: [string, () => Build][] = [
  ['the rings on a dowel', stack],
  ['the glued pair', () => pair('j3', 6, 3)],
  ['the glued pair with the longest name', () => pair('j5', 10, 2)],
  ['the cut solid', () => cut('icosahedron', 2)],
  ['the cut solid with the longest name', () => cut('rhombicosidodecahedron', 1)],
  ['the ring of cubes', () => cubes('infinity-cube', 2)],
  ['the ring of twelve cubes', () => cubes('frame-loop', 2)],
  ['the ring of half cubes', halfCubes],
  ['the ring of prisms', prisms],
  ['the interchange maze', () => interchange(3, 5, 2, 42)],
  ['the interchange maze with every symbol in its key', () => interchange(6, 12, 3, 7)],
];

const MM_TO_PT = 72 / 25.4;
const face = new jsPDF({ unit: 'mm', format: 'a4' });

/** The box an item prints in — generous for words, which are what could reach. */
function extent(item: PageItem): { left: number; right: number; top: number; bottom: number } {
  if (item.kind === 'text') {
    face.setFont('helvetica', item.bold ? 'bold' : 'normal');
    face.setFontSize(item.size * MM_TO_PT);
    const width = face.getTextWidth(item.text);
    // Turned, it could lie any way: a square of its own length about its anchor.
    const back = item.angle ? width : item.align === 'left' ? 0 : width / 2;
    const forward = item.angle ? width : item.align === 'left' ? width : width / 2;
    const tall = item.angle ? width : item.size;
    return {
      left: item.at[0] - back, right: item.at[0] + forward,
      top: item.at[1] - tall, bottom: item.at[1] + tall,
    };
  }
  const points = item.kind === 'line' ? [item.a, item.b] : item.pts;
  const half = (item.width ?? 0) / 2;
  return {
    left: Math.min(...points.map(p => p[0])) - half,
    right: Math.max(...points.map(p => p[0])) + half,
    top: Math.min(...points.map(p => p[1])) - half,
    bottom: Math.max(...points.map(p => p[1])) + half,
  };
}

describe.each(PATTERNS)('on %s', (_name, make) => {
  const build = make();
  const linked = build(LINK);
  const bare = build();
  const mine = new Set(link.items.map(item => JSON.stringify(item)));
  const isLink = (item: PageItem): boolean => mine.has(JSON.stringify(item));

  it('is on the first sheet and on no other', () => {
    expect(linked.sheets[0]!.items.filter(isLink).length).toBe(link.items.length);
    for (const sheet of linked.sheets.slice(1)) {
      expect(sheet.items.some(isLink)).toBe(false);
    }
  });

  it('is left off a pattern that is given no link', () => {
    for (const sheet of bare.sheets) {
      expect(sheet.items.some(item => item.kind === 'text' && item.text === SHEET_LINK_STYLE.caption))
        .toBe(false);
    }
  });

  it('moves nothing: the sheets are what they are without it, and it is beside them', () => {
    expect(linked.sheets.length).toBe(bare.sheets.length);
    expect(linked.sheets[0]!.items.filter(item => !isLink(item))).toEqual(bare.sheets[0]!.items);
    expect(linked.sheets.slice(1)).toEqual(bare.sheets.slice(1));
  });

  it('has the corner to itself, quiet zone and caption and all', () => {
    const { left, bottom } = link.keepClear;
    const others = linked.sheets[0]!.items.filter(item => !isLink(item));
    expect(others.length).toBeGreaterThan(0);
    for (const item of others) {
      const box = extent(item);
      const reaches = box.right > left && box.top < bottom;
      if (reaches) {
        throw new Error(`reaches the link: ${JSON.stringify(item).slice(0, 160)} `
          + `(to x ${box.right.toFixed(1)} from y ${box.top.toFixed(1)}; `
          + `the link keeps x > ${left.toFixed(1)}, y < ${bottom.toFixed(1)})`);
      }
    }
  });

  it('keeps everything on the paper', () => {
    for (const item of linked.sheets[0]!.items) {
      const box = extent(item);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(A4_SHEET.width);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(A4_SHEET.height);
    }
  });
});
