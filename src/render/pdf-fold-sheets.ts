/**
 * Folding-maze PDF: the assembly sheet and the eight cube nets.
 *
 * A thin wrapper, like `pdf-stack-sheets.ts`. All of the drawing is in
 * `fold-sheet-model.ts`, which is DOM-free and emits the same primitives as
 * the face pages, so this only opens a document, paints each sheet and hands
 * back the bytes.
 */

import { jsPDF } from 'jspdf';
import { paintItems } from './pdf-face-page-painter.ts';
import { buildFoldSheets, type FoldSheetOptions, type FoldSheetPlan } from './fold-sheet-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { InfinityCubeMechanism } from '../core/kinetic/mechanisms/infinity-cube.ts';

export interface FoldPdfResult {
  readonly doc: jsPDF;
  readonly plan: FoldSheetPlan;
}

export function buildFoldPDF(
  mech: InfinityCubeMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: FoldSheetOptions = {},
): FoldPdfResult {
  const plan = buildFoldSheets(mech, surface, design, options);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  plan.sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    paintItems(doc, sheet.items);
  });
  return { doc, plan };
}

export function exportFoldPDF(
  mech: InfinityCubeMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  maze: number,
  options: FoldSheetOptions = {},
): FoldSheetPlan {
  const { doc, plan } = buildFoldPDF(mech, surface, design, options);
  doc.save(`folding-maze-${mech.cellsPerFace}-${maze}.pdf`);
  return plan;
}
