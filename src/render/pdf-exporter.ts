/**
 * PDF export: 2-page A4 landscape (puzzle + answer) with QR code.
 */

import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import QRCode from 'qrcode';
import { computeNetLayout } from './net-layout.ts';
import { renderNetSVG } from './svg-net-renderer.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import type { MazeMetrics } from '../core/metrics.ts';
import { encodeParams, type MazeParams } from '../ui/param-codec.ts';
import { drawLegend, drawMetrics, formatInfo } from './pdf-chrome.ts';

export async function exportPDF(
  params: MazeParams,
  mazeGraph: MazeGraph,
  maze: Maze,
  metrics: MazeMetrics,
  baseUrl: string,
): Promise<void> {
  const layout = computeNetLayout(mazeGraph.polyhedron);

  // Generate SVGs
  // No face ids on either page: this export is a puzzle to solve, not a set of
  // pieces to assemble, so the numbers would only crowd the answer's solution
  // path. They belong to the face-pages index sheet, where they are the map.
  const puzzleSvg = renderNetSVG(layout, mazeGraph, maze, false, { showFaceIds: false });
  const answerSvg = renderNetSVG(layout, mazeGraph, maze, true, { showFaceIds: false });

  // Temporarily add to DOM (required by svg2pdf.js for measurement)
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(offscreen);
  offscreen.appendChild(puzzleSvg);
  offscreen.appendChild(answerSvg);

  try {
    // Generate QR code (data URL)
    const mazeUrl = baseUrl + encodeParams(params);
    const qrDataUrl = await QRCode.toDataURL(mazeUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // A4 landscape: 297 × 210 mm
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210;
    const info = formatInfo(params);

    // ─── Page 1: Puzzle ──────────────────────────────────────────
    drawHeader(doc, 'Polyhedral Maze', info, pageW);
    await doc.svg(puzzleSvg, { x: 8, y: 24, width: 220, height: 178 });

    // Right sidebar: QR + legend + metrics
    const sideX = 238;
    doc.addImage(qrDataUrl, 'PNG', sideX, 28, 40, 40);
    doc.setFontSize(7);
    doc.text('Scan to view online', sideX + 20, 72, { align: 'center' });

    drawLegend(doc, sideX, 78, params.warp);
    drawMetrics(doc, sideX, params.warp ? 102 : 96, metrics);

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(mazeUrl, pageW / 2, pageH - 7, { align: 'center' });
    doc.text(
      '© kakeami | PolyForm Noncommercial 1.0.0 — Non-commercial use only',
      pageW / 2, pageH - 3, { align: 'center' },
    );
    doc.setTextColor(0);

    // ─── Page 2: Answer ──────────────────────────────────────────
    doc.addPage();
    drawHeader(doc, 'Polyhedral Maze — Answer', info, pageW);
    await doc.svg(answerSvg, { x: 8, y: 24, width: 277, height: 178 });

    doc.save(`polyhedral-maze-${params.shape}-${params.seed}.pdf`);
  } finally {
    offscreen.remove();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

// svg2pdf.js patches jsPDF with svg() method — use doc directly

function drawHeader(doc: jsPDF, title: string, info: string, pageW: number) {
  doc.setFontSize(16);
  doc.text(title, pageW / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.text(info, pageW / 2, 19, { align: 'center' });
}

