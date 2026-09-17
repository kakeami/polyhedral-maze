/**
 * Cut-solid PDF: the pieces, their bulkheads and the discs that hold them on.
 *
 * A thin wrapper, like `pdf-pair-sheets.ts`. All of the drawing lives in
 * `gyration-sheet-model.ts`, which is DOM-free and emits the same primitives as
 * the face pages, so this only has to open a document, paint each sheet and
 * hand back the bytes.
 */

import { jsPDF } from 'jspdf';
import { paintItems } from './pdf-face-page-painter.ts';
import {
  buildGyrationSheets,
  type GyrationSheetOptions,
  type GyrationSheetPlan,
} from './gyration-sheet-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { GyrationMechanism } from '../core/kinetic/mechanisms/gyration.ts';

export interface GyrationPdfResult {
  readonly doc: jsPDF;
  readonly plan: GyrationSheetPlan;
}

export function buildGyrationPDF(
  mech: GyrationMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: GyrationSheetOptions = {},
): GyrationPdfResult {
  const plan = buildGyrationSheets(mech, surface, design, options);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  plan.sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    paintItems(doc, sheet.items);
  });
  return { doc, plan };
}

export function exportGyrationPDF(
  mech: GyrationMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  seed: number,
  options: GyrationSheetOptions = {},
): GyrationSheetPlan {
  const { doc, plan } = buildGyrationPDF(mech, surface, design, options);
  doc.save(`polyhedral-maze-${mech.id}-${seed}-cut.pdf`);
  return plan;
}
