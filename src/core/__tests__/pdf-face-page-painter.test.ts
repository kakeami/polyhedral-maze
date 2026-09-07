/**
 * The face-page painter has no DOM dependency by design, so the real jsPDF
 * output can be exercised here rather than only in a browser.
 */
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  A4_PORTRAIT, buildFacePage, computeFacePageScale,
} from '../../render/face-page-model.ts';
import { paintFacePage } from '../../render/pdf-face-page-painter.ts';
import { drawIndexChrome, formatInfo } from '../../render/pdf-chrome.ts';
import { computeMetrics } from '../metrics.ts';
import { computeNetLayout } from '../../render/net-layout.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { getShape } from '../polyhedra/registry.ts';

function paintAllFaces(shapeId: string, n: number) {
  const polyhedron = getShape(shapeId)!.factory();
  const mg = new MazeGraph(polyhedron, n, 2);
  mg.build();
  const maze = generate(mg, { algorithm: 'DFS', warp: true, rng: createRng(3) });
  const layout = computeNetLayout(polyhedron);
  const scale = computeFacePageScale(layout, A4_PORTRAIT);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ids = layout.faces.map(f => f.faceId).sort((a, b) => a - b);
  ids.forEach((faceId, i) => {
    const page = buildFacePage(layout, mg, maze, scale, faceId, {
      locator: { x: 148, y: 11, w: 52, h: 32 },
    });
    if (i > 0) doc.addPage();
    paintFacePage(doc, A4_PORTRAIT, {
      title: `Face ${faceId}`,
      subtitle: `${i + 1} of ${ids.length}`,
      footerLeft: shapeId,
      footerRight: `page ${i + 2} / ${ids.length + 1}`,
    }, page.items);
  });
  return { doc, faceCount: ids.length };
}

describe('paintFacePage', () => {
  it.each([
    { shape: 'cube', n: 4 },
    { shape: 'icosahedron', n: 6 },
    { shape: 'truncated-icosahedron', n: 5 },
    { shape: 'square-torus', n: 4 },
  ])('$shape: writes one page per face', ({ shape, n }) => {
    const { doc, faceCount } = paintAllFaces(shape, n);
    expect(doc.getNumberOfPages()).toBe(faceCount);

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
    }, params, computeMetrics(maze, mg));

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });
});
