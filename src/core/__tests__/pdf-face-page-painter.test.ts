/**
 * The face-page painter has no DOM dependency by design, so the real jsPDF
 * output can be exercised here rather than only in a browser.
 */
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  A4_PORTRAIT, buildFacePage, computeFacePageScale,
} from '../../render/face-page-model.ts';
import { frameChromeItems, packFaceSheets } from '../../render/face-sheet-layout.ts';
import { paintFaceSheet, paintItems } from '../../render/pdf-face-page-painter.ts';
import { drawIndexChrome, formatInfo } from '../../render/pdf-chrome.ts';
import { computeMetrics } from '../metrics.ts';
import { computeNetLayout } from '../../render/net-layout.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { getShape } from '../polyhedra/registry.ts';
import type { Vec2 } from '../vec2.ts';

function paintAllFaces(shapeId: string, n: number) {
  const polyhedron = getShape(shapeId)!.factory();
  const mg = new MazeGraph(polyhedron, n, 2);
  mg.build();
  const maze = generate(mg, { algorithm: 'DFS', warp: true, rng: createRng(3) });
  const layout = computeNetLayout(polyhedron);
  const scale = computeFacePageScale(layout, A4_PORTRAIT);
  const sheets = packFaceSheets(layout, scale, A4_PORTRAIT);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  sheets.forEach((sheet, i) => {
    const items = sheet.frames.flatMap(frame => [
      ...frameChromeItems(frame),
      ...buildFacePage(layout, mg, maze, scale, frame.faceId, {
        area: frame.area, locator: frame.locator,
      }).items,
    ]);
    if (i > 0) doc.addPage();
    paintFaceSheet(doc, A4_PORTRAIT, {
      info: shapeId,
      footerLeft: shapeId,
      footerRight: `sheet ${i + 1} / ${sheets.length}`,
    }, items);
  });
  return { doc, sheetCount: sheets.length };
}

describe('paintFaceSheet', () => {
  it.each([
    { shape: 'cube', n: 4 },
    { shape: 'icosahedron', n: 6 },
    { shape: 'truncated-icosahedron', n: 5 },
    { shape: 'square-torus', n: 4 },
  ])('$shape: writes one page per packed sheet', ({ shape, n }) => {
    const { doc, sheetCount } = paintAllFaces(shape, n);
    expect(doc.getNumberOfPages()).toBe(sheetCount);

    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // A well-formed PDF, not a truncated buffer.
    const head = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 8));
    expect(head.startsWith('%PDF-')).toBe(true);
  });
});

describe('drawIndexChrome', () => {
  it('lays out the index sheet without a DOM', () => {
    const polyhedron = getShape('cube')!.factory();
    const mg = new MazeGraph(polyhedron, 4, 2);
    mg.build();
    const maze = generate(mg, { algorithm: 'DFS', warp: true, rng: createRng(1) });
    const params = {
      shape: 'cube', n: 4, k: 2, algorithm: 'DFS' as const,
      seed: 1, warp: true, showSolution: false,
    };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    drawIndexChrome(doc, { pageW: 210, pageH: 297 }, {
      mazeUrl: 'https://example.test/?shape=cube',
      info: formatInfo(params),
      edgeMm: 174,
      modelMm: 300,
      faceCount: 6,
      sheetCount: 4,
    }, params, computeMetrics(maze, mg));

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });
});

// ─── Edge labels stay off the piece ───────────────────────────────

const MM_TO_PT = 72 / 25.4;
/** Helvetica, em above and below the baseline. */
const ASCENT = 0.718, DESCENT = 0.207;

interface TextRun {
  text: string;
  /** Baseline start, page mm, y down. */
  origin: Vec2;
  /** Unit vectors of the text's own frame, page mm, y down. */
  adv: Vec2;
  up: Vec2;
  sizeMm: number;
}

/**
 * Every text run in an uncompressed jsPDF document, read back out of the
 * content stream. Going through the PDF's own `Tm` matrix rather than through
 * what the painter thinks it drew is the point: it is the matrix a viewer
 * obeys, so a sign error in the painter's frame cannot hide behind a matching
 * sign error in the test.
 */
function readTextRuns(doc: jsPDF, pageH: number): TextRun[] {
  const num = String.raw`-?[\d.]+(?:e[-+]?\d+)?`;
  const runs: TextRun[] = [];
  for (const [, block] of doc.output().matchAll(/BT\n([\s\S]*?)ET/g)) {
    const tj = /\((.*)\) Tj/.exec(block);
    const tf = new RegExp(String.raw`\/F\d+ (${num}) Tf`).exec(block);
    if (!tj || !tf) continue;
    const tm = new RegExp(
      String.raw`(${num}) (${num}) (${num}) (${num}) (${num}) (${num}) Tm`).exec(block);
    const td = new RegExp(String.raw`(${num}) (${num}) Td`).exec(block);
    const [a, b, c, d, e, f] = tm
      ? tm.slice(1).map(Number) as [number, number, number, number, number, number]
      : [1, 0, 0, 1, Number(td![1]), Number(td![2])];
    runs.push({
      text: tj[1]!,
      // The stream is in points with y up; the page model is in mm with y down.
      origin: [e / MM_TO_PT, pageH - f / MM_TO_PT],
      adv: [a, -b],
      up: [c, -d],
      sizeMm: Number(tf[1]) / MM_TO_PT,
    });
  }
  return runs;
}

/** The four corners of a run's glyph box, page mm. */
function inkCorners(run: TextRun, width: number): Vec2[] {
  const corners: Vec2[] = [];
  for (const along of [0, width]) {
    for (const across of [-DESCENT * run.sizeMm, ASCENT * run.sizeMm]) {
      corners.push([
        run.origin[0] + run.adv[0] * along + run.up[0] * across,
        run.origin[1] + run.adv[1] * along + run.up[1] * across,
      ]);
    }
  }
  return corners;
}

/**
 * How far `p` lies outside a convex polygon, in mm — negative inside. Positive
 * for every glyph corner is exactly the property an edge label needs: it is
 * cut away with the waste rather than printed on the model.
 */
function clearanceOutside(poly: Vec2[], p: Vec2): number {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!, b = poly[(i + 1) % n]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const orient = area > 0 ? 1 : -1;
  // Convex, so the point is outside exactly when it is outside some edge's
  // halfplane — take the largest such excursion, not the smallest.
  let out = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!, b = poly[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // Distance along the inward normal: negative outside this edge's halfplane.
    const inward = ((p[0] - a[0]) * -dy + (p[1] - a[1]) * dx) * orient / len;
    if (-inward > out) out = -inward;
  }
  return out;
}

function paintOneFace(shapeId: string, n: number, faceId: number) {
  const polyhedron = getShape(shapeId)!.factory();
  const mg = new MazeGraph(polyhedron, n, 3);
  mg.build();
  const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(42) });
  const layout = computeNetLayout(polyhedron);
  const scale = computeFacePageScale(layout, A4_PORTRAIT);
  const page = buildFacePage(layout, mg, maze, scale, faceId, {});
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  paintFaceSheet(doc, A4_PORTRAIT, {
    info: shapeId, footerLeft: shapeId, footerRight: '',
  }, page.items);

  // The dashed lines are the cut guide, pushed in edge order, so their start
  // points are the piece outline.
  const outline = page.items
    .filter(it => it.kind === 'line' && it.dash !== undefined)
    .map(it => (it as { a: Vec2 }).a);
  const labels = new Set(
    page.items.filter(it => it.kind === 'text' && !it.bold).map(it => (it as { text: string }).text));

  return { doc, outline, labels, texts: readTextRuns(doc, A4_PORTRAIT.pageH) };
}

describe('edge labels', () => {
  it.each([
    { shape: 'rhombicuboctahedron', n: 9, faceId: 5 },
    { shape: 'square-torus', n: 9, faceId: 20 },
    { shape: 'truncated-cube', n: 9, faceId: 11 },
    { shape: 'icosahedron', n: 6, faceId: 0 },
  ])('$shape face $faceId: no label touches the piece', ({ shape, n, faceId }) => {
    const { doc, outline, labels, texts } = paintOneFace(shape, n, faceId);
    const runs = texts.filter(r => labels.has(r.text));
    expect(runs.length).toBe(labels.size);

    for (const run of runs) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(run.sizeMm * MM_TO_PT);
      for (const corner of inkCorners(run, doc.getTextWidth(run.text))) {
        // 1 mm of slack: the descent box of a digits-only label is empty ink.
        expect(clearanceOutside(outline, corner)).toBeGreaterThan(1);
      }
    }
  });

  it('turns a label without displacing it off the edge midpoint', () => {
    // jsPDF's own `align`/`baseline` shift along the page axes before rotating,
    // which used to throw rotated labels half their width towards the piece.
    const { outline, labels, texts } = paintOneFace('rhombicuboctahedron', 9, 5);
    const runs = texts.filter(r => labels.has(r.text));
    const upright = runs.filter(r => Math.abs(r.up[1]) > 0.5);
    const turned = runs.filter(r => Math.abs(r.up[0]) > 0.5);
    expect(upright.length).toBe(2);
    expect(turned.length).toBe(2);

    const gap = (run: TextRun) => Math.min(
      ...inkCorners(run, run.text.length * 1.87).map(c => clearanceOutside(outline, c)));
    // A turned label must clear the cut line by as much as an upright one.
    for (const run of turned) {
      expect(gap(run)).toBeGreaterThan(Math.min(...upright.map(gap)) - 0.1);
    }
  });
});

// ─── The rule under a face number ─────────────────────────────────

/** Every `m … l … S` segment in the document, page mm, y down. */
function strokedSegments(doc: jsPDF, pageH: number): [Vec2, Vec2][] {
  const num = String.raw`-?[\d.]+`;
  const re = new RegExp(String.raw`(${num}) (${num}) m\n(${num}) (${num}) l\nS`, 'g');
  return [...doc.output().matchAll(re)].map(m => {
    const [x1, y1, x2, y2] = m.slice(1).map(Number) as [number, number, number, number];
    return [
      [x1 / MM_TO_PT, pageH - y1 / MM_TO_PT],
      [x2 / MM_TO_PT, pageH - y2 / MM_TO_PT],
    ] as [Vec2, Vec2];
  });
}

function paintLabel(angle: number, underline: boolean) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const at: Vec2 = [100, 100];
  const size = 4;
  paintItems(doc, [{
    kind: 'text', at, text: '69', size, color: [0, 0, 0], angle, underline,
  }]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size * MM_TO_PT);
  return {
    at, size,
    width: doc.getTextWidth('69'),
    rise: size * (1.5 - doc.getLineHeightFactor()),
    segments: strokedSegments(doc, A4_PORTRAIT.pageH),
  };
}

describe('underlined labels', () => {
  it('draws no rule unless one is asked for', () => {
    expect(paintLabel(0, false).segments.length).toBe(0);
  });

  it.each([0, 90, -90, -37])('at %s°: rules the foot of the text, in its own frame', angle => {
    const { at, size, width, rise, segments } = paintLabel(angle, true);
    expect(segments.length).toBe(1);

    // The text's own frame on a y-down page, as the painter builds it.
    const rad = (angle * Math.PI) / 180;
    const adv: Vec2 = [Math.cos(rad), -Math.sin(rad)];
    const down: Vec2 = [Math.sin(rad), Math.cos(rad)];

    const [a, b] = segments[0]!;
    const along: Vec2 = [b[0] - a[0], b[1] - a[1]];
    // Parallel to the text, and exactly as long as it. Tolerances are loose
    // by a micron: these came back out of the PDF's own rounded numbers.
    expect(along[0] * down[0] + along[1] * down[1]).toBeCloseTo(0, 3);
    expect(along[0] * adv[0] + along[1] * adv[1]).toBeCloseTo(width, 3);

    const mid: Vec2 = [(a[0] + b[0]) / 2 - at[0], (a[1] + b[1]) / 2 - at[1]];
    // Centred under the anchor...
    expect(mid[0] * adv[0] + mid[1] * adv[1]).toBeCloseTo(0, 3);
    // ...and below the baseline, but no further down than the descent box, so
    // an underlined edge label clears the piece by as much as a bare one.
    const belowBaseline = mid[0] * down[0] + mid[1] * down[1] - rise;
    expect(belowBaseline).toBeGreaterThan(0);
    expect(belowBaseline).toBeLessThan(DESCENT * size);
  });
});
