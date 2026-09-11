/**
 * jsPDF page chrome shared by both PDF exports — headers, footers, legend,
 * metrics and the index sheet's text block.
 *
 * DOM-free: it touches nothing but the jsPDF document, so the page layout can
 * be rendered and inspected outside a browser. Anything needing a DOM (the
 * SVG net, measured elements) stays in `pdf-exporter.ts` /
 * `pdf-face-pages.ts`.
 */

import type { jsPDF } from 'jspdf';
import type { MazeMetrics } from '../core/metrics.ts';
import type { MazeParams } from '../ui/param-codec.ts';

export interface SheetSize {
  pageW: number;
  pageH: number;
}

export function formatInfo(p: MazeParams): string {
  const parts = [
    p.shape.charAt(0).toUpperCase() + p.shape.slice(1),
    `n=${p.n}`,
    `k=${p.k}`,
    p.algorithm,
    `seed=${p.seed}`,
  ];
  if (p.warp) parts.push('warp');
  return parts.join('  |  ');
}

export function drawLegend(doc: jsPDF, x: number, y: number, warp: boolean) {
  doc.setFontSize(8);
  const sw = 3;

  // Start: pastel green square with "S"
  doc.setFillColor(178, 240, 178);
  doc.rect(x, y - 1.5, sw, sw, 'F');
  doc.setFontSize(6);
  doc.setTextColor(85);
  doc.text('S', x + sw / 2, y + 0.4, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('Start', x + sw + 2, y + 1);

  // Goal: pastel red square with "G"
  doc.setFillColor(240, 178, 178);
  doc.rect(x, y + 4.5, sw, sw, 'F');
  doc.setFontSize(6);
  doc.setTextColor(85);
  doc.text('G', x + sw / 2, y + 6.4, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('Goal', x + sw + 2, y + 7);

  if (warp) {
    doc.setFillColor(240, 232, 178);
    doc.rect(x, y + 10.5, sw, sw, 'F');
    doc.setFontSize(6);
    doc.setTextColor(85);
    doc.text('W', x + sw / 2, y + 12.4, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('Warp', x + sw + 2, y + 13);
  }
}

export function drawMetrics(doc: jsPDF, x: number, y: number, m: MazeMetrics) {
  doc.setFontSize(7);
  doc.text(`Cells: ${m.totalCells}`, x, y);
  doc.text(`Solution: ${m.solutionLength} steps`, x, y + 4);
  doc.text(`Dead ends: ${m.deadEndCount}`, x, y + 8);
  doc.text(`Face crossings: ${m.faceCrossings}`, x, y + 12);
}

// ─── Face-pages index sheet ───────────────────────────────────────

export interface IndexFacts {
  mazeUrl: string;
  info: string;
  /** Edge length in mm when the pages are printed on A4 at 100%. */
  edgeMm: number;
  /** Rough size of the finished model in mm, likewise at A4 100%. */
  modelMm: number;
  faceCount: number;
  /** QR code as a PNG data URL, if one could be generated. */
  qrDataUrl?: string;
}

/** Box on the index sheet reserved for the net overview drawing. */
export const INDEX_NET_BOX = { x: 12, y: 32, w: 186, h: 150 };

/**
 * Everything on the index sheet except the net drawing itself: title, print
 * warning, build instructions, QR code, legend, metrics and footer.
 */
export function drawIndexChrome(
  doc: jsPDF,
  sheet: SheetSize,
  facts: IndexFacts,
  params: MazeParams,
  metrics: MazeMetrics,
): void {
  const { pageW, pageH } = sheet;

  doc.setFontSize(16);
  doc.text('Polyhedral Maze — Face Pages', pageW / 2, 15, { align: 'center' });
  doc.setFontSize(9);
  doc.text(facts.info, pageW / 2, 22, { align: 'center' });
  doc.setFontSize(8);
  doc.text(
    'Every page is drawn to one shared scale — print them all with the same setting.',
    pageW / 2, 28, { align: 'center' },
  );

  if (facts.qrDataUrl) {
    doc.addImage(facts.qrDataUrl, 'PNG', 14, 190, 34, 34);
    doc.setFontSize(7);
    doc.text('Scan to view online', 31, 228, { align: 'center' });
  }

  const textX = 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('How to build', textX, 194);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const lines = [
    `${facts.faceCount} face pages follow, one piece each. On A4 at 100% the edge comes`,
    `out ${facts.edgeMm.toFixed(0)} mm long and the model about ${(facts.modelMm / 10).toFixed(0)} cm across; enlarge every page by the`,
    'same factor (A3 = 141%) for a proportionally bigger model.',
    'Cut along the dashed guide — it runs along the outer edge of the black',
    'border, so the piece comes out at exactly the right size. No glue tabs.',
    'The number outside each edge is the face it joins: the edge labelled 7 on',
    'face 3 meets the edge labelled 3 on face 7. Labels fall outside the cut line.',
    'Every face number is underlined — read it with the rule at the foot (6 vs 9).',
    'A "~" after the number marks a flat seam — butt-join it, do not fold.',
    "The shaded face in each page's locator diagram is that page's piece.",
    'Join the pieces with tape from the inside.',
  ];
  lines.forEach((line, i) => doc.text(line, textX, 200 + i * 4.4));

  drawLegend(doc, textX, 249, params.warp);
  drawMetrics(doc, textX + 40, 250, metrics);

  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text(facts.mazeUrl, pageW / 2, pageH - 8, { align: 'center' });
  doc.text(
    '© kakeami | PolyForm Noncommercial 1.0.0 — Non-commercial use only',
    pageW / 2, pageH - 4, { align: 'center' },
  );
  doc.setTextColor(0);
}
