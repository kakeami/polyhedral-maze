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

export async function exportPDF(
  params: MazeParams,
  mazeGraph: MazeGraph,
  maze: Maze,
  metrics: MazeMetrics,
  baseUrl: string,
): Promise<void> {
  const layout = computeNetLayout(mazeGraph.polyhedron);

  // Generate SVGs
  const puzzleSvg = renderNetSVG(layout, mazeGraph, maze, false, { showFaceIds: false });
  const answerSvg = renderNetSVG(layout, mazeGraph, maze, true, { showFaceIds: true });

  // Temporarily add to DOM (required by svg2pdf.js for measurement)
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(offscreen);
  offscreen.appendChild(puzzleSvg);
  offscreen.appendChild(answerSvg);

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
    '\u00A9 kakeami | PolyForm Noncommercial 1.0.0 — Non-commercial use only',
    pageW / 2, pageH - 3, { align: 'center' },
  );
  doc.setTextColor(0);

  // ─── Page 2: Answer ──────────────────────────────────────────
  doc.addPage();
  drawHeader(doc, 'Polyhedral Maze — Answer', info, pageW);
  await doc.svg(answerSvg, { x: 8, y: 24, width: 277, height: 178 });

  // Cleanup
  offscreen.remove();

  // Save
  doc.save(`polyhedral-maze-${params.shape}-${params.seed}.pdf`);
}

// ─── Helpers ──────────────────────────────────────────────────────

// svg2pdf.js patches jsPDF with svg() method — use doc directly

function drawHeader(doc: jsPDF, title: string, info: string, pageW: number) {
  doc.setFontSize(16);
  doc.text(title, pageW / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.text(info, pageW / 2, 19, { align: 'center' });
}

function drawLegend(doc: jsPDF, x: number, y: number, warp: boolean) {
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

function drawMetrics(doc: jsPDF, x: number, y: number, m: MazeMetrics) {
  doc.setFontSize(7);
  doc.text(`Cells: ${m.totalCells}`, x, y);
  doc.text(`Solution: ${m.solutionLength} steps`, x, y + 4);
  doc.text(`Dead ends: ${m.deadEndCount}`, x, y + 8);
  doc.text(`Face crossings: ${m.faceCrossings}`, x, y + 12);
}

function formatInfo(p: MazeParams): string {
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
