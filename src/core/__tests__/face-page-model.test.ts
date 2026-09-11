/**
 * One-face-per-page model: the two properties the printed pieces depend on
 * are a single shared scale across all pages, and assembly annotations that
 * sit outside the cut line so they never end up on the finished model.
 */
import { describe, it, expect } from 'vitest';
import {
  A4_PORTRAIT,
  buildFacePage,
  buildLocatorItems,
  computeFacePageScale,
  faceToPageTransform,
  medianEdgeLength,
  pieceArea,
  QUARTER_TURN,
} from '../../render/face-page-model.ts';
import { FACE_PAGE_STYLE } from '../../render/face-page-constants.ts';
import { computeNetLayout } from '../../render/net-layout.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { getShape } from '../polyhedra/registry.ts';
import type { Polyhedron } from '../polyhedron.ts';
import type { Face, Vec3 } from '../types.ts';
import type { Vec2 } from '../vec2.ts';
import type { PageItem } from '../../render/face-page-model.ts';

function build(shapeId: string, n = 4, k = 2, seed = 7, warp = false) {
  const polyhedron = getShape(shapeId)!.factory();
  const mg = new MazeGraph(polyhedron, n, k);
  mg.build();
  const maze = generate(mg, { algorithm: 'DFS', warp, rng: createRng(seed) });
  const layout = computeNetLayout(polyhedron);
  const scale = computeFacePageScale(layout, A4_PORTRAIT);
  return { polyhedron, mg, maze, layout, scale };
}

function scalePolyhedron(p: Polyhedron, s: number): Polyhedron {
  const faces: Face[] = p.faces().map(f => ({
    id: f.id,
    vertices: f.vertices.map(v => [v[0] * s, v[1] * s, v[2] * s] as Vec3),
    normal: f.normal,
  }));
  return {
    faces: () => faces,
    faceAdjacency: () => p.faceAdjacency(),
    gridForFace: (face, n) => p.gridForFace(face, n),
  };
}

function bboxOf(pts: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** The black border round the piece, told from the inner maze walls by weight. */
function isBoundaryWall(it: PageItem): it is Extract<PageItem, { kind: 'line' }> {
  return it.kind === 'line' && it.width === FACE_PAGE_STYLE.boundaryWidth;
}

/** Distance from `p` to segment ab. */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** True if `p` is strictly inside the convex polygon `poly`. */
function insideConvex(poly: Vec2[], p: Vec2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

const SHAPES_UNDER_TEST = [
  'tetrahedron',
  'cube',
  'icosahedron',
  'truncated-icosahedron',
  'decagonal-prism',
  'square-torus',
  'disdyakis-triacontahedron',
];

describe('computeFacePageScale', () => {
  it.each(SHAPES_UNDER_TEST)('%s: every face fits one page at the shared scale', id => {
    const { layout, scale } = build(id);
    const area = pieceArea(A4_PORTRAIT);

    for (const nf of layout.faces) {
      const placement = scale.placements.get(nf.faceId)!;
      const tf = faceToPageTransform(nf.vertices2d, placement, scale.mmPerUnit, area);
      const bb = bboxOf(nf.vertices2d.map(tf));
      expect(bb.minX).toBeGreaterThanOrEqual(area.x - 1e-6);
      expect(bb.minY).toBeGreaterThanOrEqual(area.y - 1e-6);
      expect(bb.maxX).toBeLessThanOrEqual(area.x + area.w + 1e-6);
      expect(bb.maxY).toBeLessThanOrEqual(area.y + area.h + 1e-6);
    }
  });

  it.each(SHAPES_UNDER_TEST)('%s: the scale is the largest one that fits', id => {
    const { layout, scale } = build(id);
    const area = pieceArea(A4_PORTRAIT);
    const bigger = scale.mmPerUnit * 1.01;

    const overflows = layout.faces.some(nf => {
      const placement = scale.placements.get(nf.faceId)!;
      const tf = faceToPageTransform(nf.vertices2d, placement, bigger, area);
      const bb = bboxOf(nf.vertices2d.map(tf));
      return bb.minX < area.x - 1e-6 || bb.maxX > area.x + area.w + 1e-6
        || bb.minY < area.y - 1e-6 || bb.maxY > area.y + area.h + 1e-6;
    });
    expect(overflows).toBe(true);
  });

  it.each(['decagonal-prism', 'cube', 'truncated-icosahedron'])(
    '%s: a quarter turn is only used when it clearly fits better', id => {
      const { layout, scale } = build(id);
      const area = pieceArea(A4_PORTRAIT);
      for (const nf of layout.faces) {
        const rotate90 = scale.placements.get(nf.faceId)!.turn !== 0;
        const bb = bboxOf(nf.vertices2d);
        const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
        const upright = Math.min(area.w / w, area.h / h);
        const turned = Math.min(area.w / h, area.h / w);
        // A square piece must stay upright rather than flip on rounding noise.
        if (Math.abs(turned / upright - 1) < 1e-3) expect(rotate90).toBe(false);
        else expect(rotate90).toBe(turned > upright);
        // The scale only ever considers a quarter turn.
        expect([0, QUARTER_TURN]).toContain(scale.placements.get(nf.faceId)!.turn);
      }
    },
  );

  it('the printed size does not depend on the input coordinate scale', () => {
    const base = getShape('icosahedron')!.factory();
    const edgeMm = (p: Polyhedron) => {
      const layout = computeNetLayout(p);
      const s = computeFacePageScale(layout, A4_PORTRAIT);
      return medianEdgeLength(p.faces()) * s.mmPerUnit;
    };
    const reference = edgeMm(base);
    for (const factor of [0.1, 10, 100]) {
      expect(edgeMm(scalePolyhedron(base, factor))).toBeCloseTo(reference, 6);
    }
  });

  it('gives a large model: an icosahedron edge exceeds 100 mm', () => {
    const { polyhedron, scale } = build('icosahedron');
    expect(medianEdgeLength(polyhedron.faces()) * scale.mmPerUnit).toBeGreaterThan(100);
  });
});

describe('buildFacePage', () => {
  it('draws everything inside the sheet', () => {
    const { layout, mg, maze, scale } = build('truncated-icosahedron');
    const locator = { x: 148, y: 11, w: 52, h: 32 };
    const { pageW, pageH } = A4_PORTRAIT;

    for (const nf of layout.faces) {
      const page = buildFacePage(layout, mg, maze, scale, nf.faceId, { locator });
      const pts: Vec2[] = [];
      for (const item of page.items) {
        if (item.kind === 'line') pts.push(item.a, item.b);
        else if (item.kind === 'poly') pts.push(...item.pts);
        else pts.push(item.at);
      }
      const bb = bboxOf(pts);
      expect(bb.minX).toBeGreaterThan(0);
      expect(bb.minY).toBeGreaterThan(0);
      expect(bb.maxX).toBeLessThan(pageW);
      expect(bb.maxY).toBeLessThan(pageH);
    }
  });

  it('keeps edge labels outside the cut line and markers inside', () => {
    const { layout, mg, maze, scale } = build('cube', 4, 2, 7, true);
    const area = pieceArea(A4_PORTRAIT);

    for (const nf of layout.faces) {
      const page = buildFacePage(layout, mg, maze, scale, nf.faceId);
      const placement = scale.placements.get(nf.faceId)!;
      const tf = faceToPageTransform(nf.vertices2d, placement, scale.mmPerUnit, area);
      const outline = nf.vertices2d.map(tf);

      const labels = page.items.filter(
        it => it.kind === 'text' && /^\d/.test(it.text),
      );
      expect(labels.length).toBe(nf.vertices2d.length);
      for (const label of labels) {
        expect(insideConvex(outline, (label as { at: Vec2 }).at)).toBe(false);
      }

      const markers = page.items.filter(
        it => it.kind === 'text' && /^[SGW]$/.test(it.text),
      );
      for (const marker of markers) {
        expect(insideConvex(outline, (marker as { at: Vec2 }).at)).toBe(true);
      }
    }
  });

  it('labels each edge with the face it joins', () => {
    const { layout, mg, maze, scale } = build('cube');
    const page = buildFacePage(layout, mg, maze, scale, 0);
    const labelled = page.items
      .filter(it => it.kind === 'text' && /^\d/.test(it.text))
      .map(it => Number.parseInt((it as { text: string }).text, 10))
      .sort((a, b) => a - b);
    expect(labelled).toEqual([...page.neighbors].filter(x => x !== null).sort((a, b) => a! - b!));
  });

  it('marks flat seams only where neighbouring faces are coplanar', () => {
    const flat = build('square-torus');
    const seamMarks = flat.layout.faces.flatMap(nf =>
      buildFacePage(flat.layout, flat.mg, flat.maze, flat.scale, nf.faceId).items
        .filter(it => it.kind === 'text' && it.text.endsWith('~')),
    );
    expect(seamMarks.length).toBeGreaterThan(0);

    const convex = build('cube');
    const cubeMarks = convex.layout.faces.flatMap(nf =>
      buildFacePage(convex.layout, convex.mg, convex.maze, convex.scale, nf.faceId).items
        .filter(it => it.kind === 'text' && it.text.endsWith('~')),
    );
    expect(cubeMarks.length).toBe(0);
  });

  it('opens the boundary wall exactly where the maze crosses to a neighbour', () => {
    const n = 4;
    const { layout, mg, maze, scale } = build('cube', n);
    const face = 0;
    const page = buildFacePage(layout, mg, maze, scale, face);

    const boundary = page.items.filter(isBoundaryWall);
    const crossings = [...maze.tree.edges()].filter(([a, b]) => {
      const fa = Number(a.split(':')[0]), fb = Number(b.split(':')[0]);
      return (fa === face) !== (fb === face);
    }).length;
    const edges = mg.polyhedron.faces().find(f => f.id === face)!.vertices.length;
    expect(boundary.length).toBe(edges * n - crossings);
  });

  it('hugs the cut line with the boundary wall, half a wall-width inside', () => {
    const { layout, mg, maze, scale } = build('truncated-icosahedron');
    const area = pieceArea(A4_PORTRAIT);

    for (const nf of layout.faces) {
      const page = buildFacePage(layout, mg, maze, scale, nf.faceId);
      const tf = faceToPageTransform(
        nf.vertices2d, scale.placements.get(nf.faceId)!, scale.mmPerUnit, area,
      );
      const outline = nf.vertices2d.map(tf);

      const boundary = page.items.filter(isBoundaryWall);
      expect(boundary.length).toBeGreaterThan(0);

      const insets: number[] = [];
      for (const wall of boundary) {
        const { a, b } = wall as { a: Vec2; b: Vec2 };
        for (const end of [a, b]) {
          // Never outside: a wall poking past the cut line would be cut off.
          expect(insideConvex(outline, end)).toBe(true);
          insets.push(Math.min(...outline.map((v, i) =>
            distToSegment(end, v, outline[(i + 1) % outline.length]!),
          )));
        }
      }
      // The wall's outer edge lands exactly on the cut line — all the way
      // round, corners included: offsetting each edge on its own used to leave
      // the corner endpoints sitting right on the neighbouring edge (inset 0),
      // a wedge of white as wide as the wall.
      expect(Math.max(...insets)).toBeCloseTo(FACE_PAGE_STYLE.boundaryInset, 6);
      expect(Math.min(...insets)).toBeCloseTo(FACE_PAGE_STYLE.boundaryInset, 6);
      expect(FACE_PAGE_STYLE.boundaryInset * 2).toBeCloseTo(FACE_PAGE_STYLE.boundaryWidth, 6);
    }
  });

  it('places start and goal markers only on their own faces', () => {
    const { layout, mg, maze, scale } = build('icosahedron');
    const startFace = Number(maze.start.split(':')[0]);
    const pagesWithS = layout.faces.filter(nf =>
      buildFacePage(layout, mg, maze, scale, nf.faceId).items
        .some(it => it.kind === 'text' && it.text === 'S'),
    );
    expect(pagesWithS.map(nf => nf.faceId)).toEqual([startFace]);
  });

  it('rejects unknown face ids', () => {
    const { layout, mg, maze, scale } = build('cube');
    expect(() => buildFacePage(layout, mg, maze, scale, 99)).toThrow(/Unknown face/);
  });
});

describe('buildLocatorItems', () => {
  const RECT = { x: 148, y: 11, w: 52, h: 32 };

  it('shows the whole net with exactly one face highlighted', () => {
    const { layout, scale } = build('icosahedron');
    const items = buildLocatorItems(layout, 5, scale.placements.get(5)!, RECT);

    const polys = items.filter(it => it.kind === 'poly');
    expect(polys.length).toBe(layout.faces.length);
    expect(polys.filter(it => it.fill).length).toBe(1);

    for (const item of items) {
      if (item.kind !== 'poly') continue;
      for (const [x, y] of item.pts) {
        expect(x).toBeGreaterThanOrEqual(RECT.x - 1e-6);
        expect(x).toBeLessThanOrEqual(RECT.x + RECT.w + 1e-6);
        expect(y).toBeGreaterThanOrEqual(RECT.y - 1e-6);
        expect(y).toBeLessThanOrEqual(RECT.y + RECT.h + 1e-6);
      }
    }
  });

  it('numbers every face, each inside its own outline', () => {
    const { layout, scale } = build('icosahedron');
    const items = buildLocatorItems(layout, 5, scale.placements.get(5)!, RECT);

    const labels = items.filter(it => it.kind === 'text');
    expect(labels.map(l => l.text).sort()).toEqual(
      layout.faces.map(nf => String(nf.faceId)).sort(),
    );

    for (const label of labels) {
      const poly = items.find(
        it => it.kind === 'poly' && insideConvex(it.pts, label.at),
      );
      expect(poly).toBeDefined();
      // Read from any side, so the rule that separates 6 from 9 is required.
      expect(label.underline).toBe(true);
      expect(label.size).toBeGreaterThanOrEqual(FACE_PAGE_STYLE.locatorLabelMinSize);
    }
  });

  it('picks out the highlighted face in white, on its dark fill', () => {
    const { layout, scale } = build('icosahedron');
    const items = buildLocatorItems(layout, 5, scale.placements.get(5)!, RECT);

    const white = items.filter(
      it => it.kind === 'text' && it.color === FACE_PAGE_STYLE.locatorLabelHighlightColor,
    );
    expect(white.map(it => (it as { text: string }).text)).toEqual(['5']);
  });

  it('leaves a face unnumbered rather than illegible', () => {
    // 120 faces in a 52 mm diagram: there is no size at which the numbers
    // would be anything but smudges, and page 1 is where you look them up.
    const { layout, scale } = build('disdyakis-triacontahedron');
    const items = buildLocatorItems(layout, 0, scale.placements.get(0)!, RECT);

    expect(items.filter(it => it.kind === 'poly').length).toBe(layout.faces.length);
    for (const label of items.filter(it => it.kind === 'text')) {
      expect(label.size).toBeGreaterThanOrEqual(FACE_PAGE_STYLE.locatorLabelMinSize);
    }
  });
});
