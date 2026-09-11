/**
 * Packing pieces several to a sheet must not cost anything: the piece is the
 * same size it was on a page of its own, it stays inside its own panel with
 * the locator diagram that belongs to it, and no two pieces end up sharing
 * paper.
 */
import { describe, it, expect } from 'vitest';
import {
  A4_PORTRAIT,
  buildFacePage,
  computeFacePageScale,
  faceFootprint,
  faceToPageTransform,
  type PageItem,
  type Rect,
} from '../../render/face-page-model.ts';
import {
  frameChromeItems,
  packFaceSheets,
  sheetArea,
  type FramePlacement,
} from '../../render/face-sheet-layout.ts';
import { FACE_SHEET_STYLE } from '../../render/face-page-constants.ts';
import { computeNetLayout } from '../../render/net-layout.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { getShape } from '../polyhedra/registry.ts';
import type { Vec2 } from '../vec2.ts';

function build(shapeId: string, n = 4) {
  const polyhedron = getShape(shapeId)!.factory();
  const mg = new MazeGraph(polyhedron, n, 2);
  mg.build();
  const maze = generate(mg, { algorithm: 'DFS', warp: false, rng: createRng(5) });
  const layout = computeNetLayout(polyhedron);
  const scale = computeFacePageScale(layout, A4_PORTRAIT);
  const sheets = packFaceSheets(layout, scale, A4_PORTRAIT);
  return { polyhedron, mg, maze, layout, scale, sheets };
}

const SHAPES_UNDER_TEST = [
  'tetrahedron',
  'cube',
  'icosahedron',
  'truncated-icosahedron',
  'truncated-dodecahedron',
  'decagonal-prism',
  'square-torus',
  'rhombicosidodecahedron',
  'disdyakis-triacontahedron',
];

function bboxOf(pts: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function itemPoints(items: PageItem[]): Vec2[] {
  const pts: Vec2[] = [];
  for (const item of items) {
    if (item.kind === 'line') pts.push(item.a, item.b);
    else if (item.kind === 'poly') pts.push(...item.pts);
    else pts.push(item.at);
  }
  return pts;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6
    && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
}

function contains(outer: Rect, inner: Rect, slack = 1e-6): boolean {
  return inner.x >= outer.x - slack && inner.y >= outer.y - slack
    && inner.x + inner.w <= outer.x + outer.w + slack
    && inner.y + inner.h <= outer.y + outer.h + slack;
}

describe('packFaceSheets', () => {
  it.each(SHAPES_UNDER_TEST)('%s: lays out every face once, in face-number order', id => {
    const { polyhedron, sheets } = build(id);
    const ids = sheets.flatMap(s => s.frames.map(f => f.faceId));

    expect(ids).toEqual(polyhedron.faces().map(f => f.id).sort((a, b) => a - b));
    // Nothing is reordered, so each sheet carries a contiguous run of faces —
    // "sheet 3 holds faces 12 to 19" and never a scattered handful.
    for (const sheet of sheets) {
      const own = sheet.frames.map(f => f.faceId);
      expect(own).toEqual([...own].sort((a, b) => a - b));
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: panels sit on the sheet and never overlap', id => {
    const { sheets } = build(id);
    const band = sheetArea(A4_PORTRAIT);

    for (const sheet of sheets) {
      for (const frame of sheet.frames) expect(contains(band, frame.frame)).toBe(true);
      for (let i = 0; i < sheet.frames.length; i++) {
        for (let j = i + 1; j < sheet.frames.length; j++) {
          expect(overlaps(sheet.frames[i]!.frame, sheet.frames[j]!.frame)).toBe(false);
        }
      }
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: the piece is the size it was on a page of its own', id => {
    const { layout, scale, sheets } = build(id);
    const byId = new Map(layout.faces.map(nf => [nf.faceId, nf]));

    for (const sheet of sheets) {
      for (const frame of sheet.frames) {
        const nf = byId.get(frame.faceId)!;
        // Turned to fit the panel, so compare the pieces edge by edge rather
        // than by bounding box: the printed piece must be the same piece.
        const onPage = nf.vertices2d.map(faceToPageTransform(
          nf.vertices2d, scale.placements.get(frame.faceId)!, scale.mmPerUnit, scale.area));
        const onPanel = nf.vertices2d.map(faceToPageTransform(
          nf.vertices2d, frame.placement, scale.mmPerUnit, frame.area));

        for (let i = 0; i < onPage.length; i++) {
          const j = (i + 1) % onPage.length;
          expect(edgeLength(onPanel[i]!, onPanel[j]!))
            .toBeCloseTo(edgeLength(onPage[i]!, onPage[j]!), 9);
        }
      }
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: everything a panel draws stays in that panel', id => {
    const { layout, mg, maze, scale, sheets } = build(id);

    for (const sheet of sheets) {
      for (const frame of sheet.frames) {
        const page = buildFacePage(layout, mg, maze, scale, frame.faceId, {
          area: frame.area, locator: frame.locator, placement: frame.placement,
        });
        const bb = bboxOf(itemPoints([...frameChromeItems(frame), ...page.items]));
        expect(bb.minX).toBeGreaterThanOrEqual(frame.frame.x - 1e-6);
        expect(bb.minY).toBeGreaterThanOrEqual(frame.frame.y - 1e-6);
        expect(bb.maxX).toBeLessThanOrEqual(frame.frame.x + frame.frame.w + 1e-6);
        expect(bb.maxY).toBeLessThanOrEqual(frame.frame.y + frame.frame.h + 1e-6);
      }
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: the locator belongs to the panel it sits in', id => {
    const { sheets } = build(id);

    for (const sheet of sheets) {
      for (const frame of sheet.frames) {
        expect(contains(frame.frame, frame.locator)).toBe(true);
        // In the header band, clear of the piece: the diagram at the top of a
        // panel can only be read as that panel's own.
        expect(frame.locator.y + frame.locator.h).toBeLessThanOrEqual(frame.area.y + 1e-6);
        expect(frame.locator.w).toBeGreaterThan(10);
        expect(frame.locator.h).toBeGreaterThan(5);

        // The title shares the header with it and must not run into it.
        const title = frameChromeItems(frame).find(it => it.kind === 'text')!;
        expect(title.kind).toBe('text');
        if (title.kind !== 'text') return;
        // Helvetica bold digits and caps average well under 0.7 em.
        const width = title.text.length * title.size * 0.7;
        expect(title.at[0] + width).toBeLessThanOrEqual(frame.locator.x);
      }
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: leaves room to cut one piece out without nicking the next', id => {
    const { sheets } = build(id);
    const ring = A4_PORTRAIT.ring;

    for (const sheet of sheets) {
      for (let i = 0; i < sheet.frames.length; i++) {
        for (let j = i + 1; j < sheet.frames.length; j++) {
          const a = sheet.frames[i]!, b = sheet.frames[j]!;
          expect(gapBetween(a, b)).toBeGreaterThanOrEqual(
            FACE_SHEET_STYLE.gutter + ring - 1e-6);
        }
      }
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: never turns a piece into more paper than it needs', id => {
    const { layout, scale, sheets } = build(id);
    const byId = new Map(layout.faces.map(nf => [nf.faceId, nf]));

    for (const sheet of sheets) {
      for (const frame of sheet.frames) {
        const nf = byId.get(frame.faceId)!;
        const asScaled = faceFootprint(
          nf.vertices2d, scale.placements.get(frame.faceId)!, scale.mmPerUnit);
        const asPacked = faceFootprint(nf.vertices2d, frame.placement, scale.mmPerUnit);
        expect(asPacked[0] * asPacked[1]).toBeLessThanOrEqual(asScaled[0] * asScaled[1] + 1e-6);
      }
    }
  });

  it('turns a piece to save paper', () => {
    // A decagonal prism's decagons come out of the unfolding at an angle;
    // laid flat they take two fifths less paper, which is what packs the
    // twelve pieces onto four sheets instead of twelve.
    const { layout, scale, sheets } = build('decagonal-prism');
    const byId = new Map(layout.faces.map(nf => [nf.faceId, nf]));
    const turned = sheets.flatMap(s => s.frames).filter(frame => {
      const nf = byId.get(frame.faceId)!;
      const packed = faceFootprint(nf.vertices2d, frame.placement, scale.mmPerUnit);
      const scaled = faceFootprint(
        nf.vertices2d, scale.placements.get(frame.faceId)!, scale.mmPerUnit);
      return packed[0] * packed[1] < scaled[0] * scaled[1] - 1;
    });
    expect(turned.length).toBeGreaterThan(0);
    expect(sheets.length).toBeLessThan(6);
  });

  it('packs several pieces onto a sheet when they fit', () => {
    // Mixed piece sizes: the small triangles have no business taking a sheet
    // each just because the decagons need one.
    const { polyhedron, sheets } = build('truncated-dodecahedron');
    expect(sheets.length).toBeLessThan(polyhedron.faces().length / 1.5);
    expect(Math.max(...sheets.map(s => s.frames.length))).toBeGreaterThan(1);
  });

  it('still gives the largest piece a sheet of its own', () => {
    // The scale is chosen so that face fills a page; packing must not squeeze
    // it, which would shrink the whole model.
    const { sheets } = build('tetrahedron');
    expect(sheets.every(s => s.frames.length === 1)).toBe(true);
    expect(sheets.length).toBe(4);
  });
});

function edgeLength(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Shortest distance between two panels' piece areas, ignoring the ring. */
function gapBetween(a: FramePlacement, b: FramePlacement): number {
  const dx = Math.max(a.frame.x - (b.frame.x + b.frame.w), b.frame.x - (a.frame.x + a.frame.w));
  const dy = Math.max(a.frame.y - (b.frame.y + b.frame.h), b.frame.y - (a.frame.y + a.frame.h));
  return Math.max(dx, dy) + A4_PORTRAIT.ring;
}
