/**
 * Face-pages PDF export: an index sheet plus the pieces themselves, all at a
 * single shared scale, for building a very large papercraft model.
 *
 * Pieces are packed several to a sheet where they fit (`face-sheet-layout.ts`)
 * — the scale never bends for the packing, so a sheet holds as many pieces as
 * their true printed size allows and no more. Each piece keeps its own framed
 * panel, title and locator diagram, so the panel reads exactly as the page it
 * used to have.
 *
 * The pieces are painted with jsPDF vector primitives straight from
 * `face-page-model.ts` rather than through SVG: the page model already works
 * in millimetres, which is what a fixed print scale needs, and it keeps a
 * 120-page document cheap to generate.
 */

import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import QRCode from 'qrcode';
import { computeNetLayout } from './net-layout.ts';
import { renderNetSVG } from './svg-net-renderer.ts';
import {
  A4_PORTRAIT,
  buildFacePage,
  computeFacePageScale,
  medianEdgeLength,
  type PageItem,
} from './face-page-model.ts';
import { frameChromeItems, packFaceSheets } from './face-sheet-layout.ts';
import { paintFaceSheet } from './pdf-face-page-painter.ts';
import {
  INDEX_NET_BOX, drawIndexChrome, formatInfo, type IndexFacts,
} from './pdf-chrome.ts';
import type { Face } from '../core/types.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import type { MazeMetrics } from '../core/metrics.ts';
import { encodeParams, type MazeParams } from '../ui/param-codec.ts';

export interface FacePagesProgress {
  (done: number, total: number): void;
}

export async function exportFacePagesPDF(
  params: MazeParams,
  mazeGraph: MazeGraph,
  maze: Maze,
  metrics: MazeMetrics,
  baseUrl: string,
  onProgress?: FacePagesProgress,
): Promise<void> {
  const page = A4_PORTRAIT;
  const polyhedron = mazeGraph.polyhedron;
  const faces = polyhedron.faces();
  const layout = computeNetLayout(polyhedron);
  const scale = computeFacePageScale(layout, page);

  const sheets = packFaceSheets(layout, scale, page);

  const edgeMm = medianEdgeLength(faces) * scale.mmPerUnit;
  const modelMm = modelExtent(faces) * scale.mmPerUnit;
  const totalPages = sheets.length + 1;
  const mazeUrl = baseUrl + encodeParams(params);
  const info = formatInfo(params);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const qrDataUrl = await QRCode.toDataURL(mazeUrl, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
  await drawIndexPage(
    doc, page, layout, mazeGraph, maze, metrics, params,
    {
      mazeUrl, info, edgeMm, modelMm,
      faceCount: faces.length, sheetCount: sheets.length, qrDataUrl,
    },
  );
  onProgress?.(1, totalPages);

  for (let i = 0; i < sheets.length; i++) {
    const items: PageItem[] = [];
    for (const frame of sheets[i]!.frames) {
      const facePage = buildFacePage(layout, mazeGraph, maze, scale, frame.faceId, {
        area: frame.area,
        locator: frame.locator,
        placement: frame.placement,
      });
      items.push(...frameChromeItems(frame), ...facePage.items);
    }

    doc.addPage();
    paintFaceSheet(doc, page, {
      info,
      footerLeft: `${params.shape}  seed=${params.seed}  n=${params.n}  k=${params.k}`,
      footerRight: `sheet ${i + 1} / ${sheets.length}`,
    }, items);

    onProgress?.(i + 2, totalPages);
    // Let the UI repaint between sheets; a 120-face solid takes a while.
    if (i % 8 === 7) await new Promise(resolve => setTimeout(resolve, 0));
  }

  doc.save(`polyhedral-maze-${params.shape}-${params.seed}-faces.pdf`);
}

// ─── Index page ───────────────────────────────────────────────────

/**
 * Index sheet: the whole net with face ids — the map the per-page locator
 * diagrams point into — plus the build instructions.
 */
async function drawIndexPage(
  doc: jsPDF,
  sheet: { pageW: number; pageH: number },
  layout: ReturnType<typeof computeNetLayout>,
  mazeGraph: MazeGraph,
  maze: Maze,
  metrics: MazeMetrics,
  params: MazeParams,
  facts: IndexFacts,
): Promise<void> {
  drawIndexChrome(doc, sheet, facts, params, metrics);

  const netSvg = renderNetSVG(layout, mazeGraph, maze, false, {
    showFaceIds: true,
    showGlueTabs: false,
  });
  // svg2pdf.js measures the element, so it has to be in the document.
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:absolute;left:-9999px;top:0';
  offscreen.appendChild(netSvg);
  document.body.appendChild(offscreen);
  try {
    const box = INDEX_NET_BOX;
    const [vbW, vbH] = viewBoxSize(netSvg);
    const s = Math.min(box.w / vbW, box.h / vbH);
    await doc.svg(netSvg, {
      x: box.x + (box.w - vbW * s) / 2,
      y: box.y + (box.h - vbH * s) / 2,
      width: vbW * s,
      height: vbH * s,
    });
  } finally {
    offscreen.remove();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function viewBoxSize(svg: SVGSVGElement): [number, number] {
  const vb = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(/[\s,]+/).map(Number);
  const w = vb[2] || 1;
  const h = vb[3] || 1;
  return [w, h];
}

/** Largest 3D bounding-box dimension of the solid, in net units. */
function modelExtent(faces: Face[]): number {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    for (const v of f.vertices) {
      for (let i = 0; i < 3; i++) {
        if (v[i]! < min[i]!) min[i] = v[i]!;
        if (v[i]! > max[i]!) max[i] = v[i]!;
      }
    }
  }
  return Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!);
}
