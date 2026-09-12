/**
 * Stack-maze PDF: the printable rings and bulkheads.
 *
 * A thin wrapper. All of the drawing lives in `stack-sheet-model.ts`, which is
 * DOM-free and emits the same primitives as the face pages, so this only has to
 * open a document, paint each sheet and hand back the bytes.
 */

import { jsPDF } from 'jspdf';
import { paintItems } from './pdf-face-page-painter.ts';
import { buildStackSheets, type StackSheetOptions, type StackSheetPlan } from './stack-sheet-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { StackMechanism } from '../core/kinetic/mechanisms/stack.ts';

export interface StackPdfResult {
  readonly doc: jsPDF;
  readonly plan: StackSheetPlan;
}

export function buildStackPDF(
  mech: StackMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: StackSheetOptions = {},
): StackPdfResult {
  const plan = buildStackSheets(mech, surface, design, options);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  plan.sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    paintItems(doc, sheet.items);
  });
  return { doc, plan };
}

export function exportStackPDF(
  mech: StackMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  seed: number,
  options: StackSheetOptions = {},
): StackSheetPlan {
  const { doc, plan } = buildStackPDF(mech, surface, design, options);
  doc.save(`polyhedral-maze-${mech.id}-${seed}-stack.pdf`);
  return plan;
}
