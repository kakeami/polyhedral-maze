/**
 * Glued-pair PDF: the two halves and their bulkheads.
 *
 * A thin wrapper, like `pdf-stack-sheets.ts`. All of the drawing lives in
 * `pair-sheet-model.ts`, which is DOM-free and emits the same primitives as the
 * face pages, so this only has to open a document, paint each sheet and hand
 * back the bytes.
 */

import { jsPDF } from 'jspdf';
import { paintItems } from './pdf-face-page-painter.ts';
import { buildPairSheets, type PairSheetOptions, type PairSheetPlan } from './pair-sheet-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { JoinedPairMechanism } from '../core/kinetic/mechanisms/joined.ts';

export interface PairPdfResult {
  readonly doc: jsPDF;
  readonly plan: PairSheetPlan;
}

export function buildPairPDF(
  mech: JoinedPairMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: PairSheetOptions = {},
): PairPdfResult {
  const plan = buildPairSheets(mech, surface, design, options);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  plan.sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    paintItems(doc, sheet.items);
  });
  return { doc, plan };
}

export function exportPairPDF(
  mech: JoinedPairMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  seed: number,
  options: PairSheetOptions = {},
): PairSheetPlan {
  const { doc, plan } = buildPairPDF(mech, surface, design, options);
  doc.save(`polyhedral-maze-${mech.id}-${seed}-pair.pdf`);
  return plan;
}
