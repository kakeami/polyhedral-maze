/**
 * The PDFs of the turning and folding patterns: the rings, the glued pair, the
 * cut solid, the ring of cubes, the ring of prisms and the ring of half cubes
 * — and the ring of cubes again with the interchange maze on it.
 *
 * All seven are the same three lines — build the plan, open a document, paint
 * each sheet — because every pattern is already a list of sheets of
 * `PageItem`s, DOM-free, in page millimetres, and `pdf-face-page-painter.ts`
 * paints those unchanged. Only the mechanism and the name of the file differ,
 * so they live together and say it once.
 *
 * `buildXPDF` hands back the document and the plan (the plan carries the
 * measurements the panel shows, and what a builder needs to cut a dowel);
 * `exportXPDF` is that plus the browser's save dialogue.
 */

import { jsPDF } from 'jspdf';
import { paintItems } from './pdf-face-page-painter.ts';
import type { PageItem } from './face-page-model.ts';
import { buildStackSheets, type StackSheetOptions, type StackSheetPlan } from './stack-sheet-model.ts';
import { buildPairSheets, type PairSheetOptions, type PairSheetPlan } from './pair-sheet-model.ts';
import {
  buildGyrationSheets,
  type GyrationSheetOptions,
  type GyrationSheetPlan,
} from './gyration-sheet-model.ts';
import { buildFoldSheets, type FoldSheetOptions, type FoldSheetPlan } from './fold-sheet-model.ts';
import {
  buildHoneycombSheets,
  type HoneycombSheetOptions,
  type HoneycombSheetPlan,
} from './honeycomb-sheet-model.ts';
import {
  buildHalfCubeSheets,
  type HalfCubeSheetOptions,
  type HalfCubeSheetPlan,
} from './half-cube-sheet-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { StackMechanism } from '../core/kinetic/mechanisms/stack.ts';
import type { JoinedPairMechanism } from '../core/kinetic/mechanisms/joined.ts';
import type { GyrationMechanism } from '../core/kinetic/mechanisms/gyration.ts';
import type { CubeRingMechanism } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { HoneycombRingMechanism } from '../core/kinetic/mechanisms/honeycomb-ring.ts';
import type { HalfCubeRingMechanism } from '../core/kinetic/mechanisms/half-cube-ring.ts';
import {
  buildInterchangeSheets,
  type InterchangeSheetOptions,
  type InterchangeSheetPlan,
} from './interchange-sheet-model.ts';
import type { InterchangeMaze, InterchangeWorld } from '../core/kinetic/interchange.ts';

export interface SheetPdf<P> {
  readonly doc: jsPDF;
  readonly plan: P;
}

/** A plan's sheets, one to a page, in the order they were laid out. */
function paintPlan<P extends { readonly sheets: readonly { readonly items: PageItem[] }[] }>(
  plan: P,
): SheetPdf<P> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  plan.sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    paintItems(doc, sheet.items);
  });
  return { doc, plan };
}

export function buildStackPDF(
  mech: StackMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: StackSheetOptions = {},
): SheetPdf<StackSheetPlan> {
  return paintPlan(buildStackSheets(mech, surface, design, options));
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

export function buildPairPDF(
  mech: JoinedPairMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: PairSheetOptions = {},
): SheetPdf<PairSheetPlan> {
  return paintPlan(buildPairSheets(mech, surface, design, options));
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

export function buildGyrationPDF(
  mech: GyrationMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: GyrationSheetOptions = {},
): SheetPdf<GyrationSheetPlan> {
  return paintPlan(buildGyrationSheets(mech, surface, design, options));
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

export function buildFoldPDF(
  mech: CubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: FoldSheetOptions = {},
): SheetPdf<FoldSheetPlan> {
  return paintPlan(buildFoldSheets(mech, surface, design, options));
}

export function exportFoldPDF(
  mech: CubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  maze: number,
  options: FoldSheetOptions = {},
): FoldSheetPlan {
  const { doc, plan } = buildFoldPDF(mech, surface, design, options);
  doc.save(`folding-maze-${mech.object.id}-${mech.cellsPerFace}-${maze}.pdf`);
  return plan;
}

export function buildHoneycombPDF(
  mech: HoneycombRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: HoneycombSheetOptions = {},
): SheetPdf<HoneycombSheetPlan> {
  return paintPlan(buildHoneycombSheets(mech, surface, design, options));
}

export function exportHoneycombPDF(
  mech: HoneycombRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  maze: number,
  options: HoneycombSheetOptions = {},
): HoneycombSheetPlan {
  const { doc, plan } = buildHoneycombPDF(mech, surface, design, options);
  doc.save(`polyhedral-maze-${mech.id}-${maze}-fold.pdf`);
  return plan;
}

export function buildHalfCubePDF(
  mech: HalfCubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: HalfCubeSheetOptions = {},
): SheetPdf<HalfCubeSheetPlan> {
  return paintPlan(buildHalfCubeSheets(mech, surface, design, options));
}

export function exportHalfCubePDF(
  mech: HalfCubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  maze: number,
  options: HalfCubeSheetOptions = {},
): HalfCubeSheetPlan {
  const { doc, plan } = buildHalfCubePDF(mech, surface, design, options);
  doc.save(`folding-maze-${mech.object.id}-${mech.cellsPerFace}-${maze}.pdf`);
  return plan;
}

export function buildInterchangePDF(
  mech: CubeRingMechanism,
  world: InterchangeWorld,
  maze: InterchangeMaze,
  options: InterchangeSheetOptions = {},
): SheetPdf<InterchangeSheetPlan> {
  return paintPlan(buildInterchangeSheets(mech, world, maze, options));
}

/**
 * `asked` is what the maze was asked for and not what it came out as: a seed
 * names a maze only together with the stations and the folds it was made for,
 * and those three are what a link to it carries.
 */
export function exportInterchangePDF(
  mech: CubeRingMechanism,
  world: InterchangeWorld,
  maze: InterchangeMaze,
  asked: { readonly stations: number; readonly folds: number; readonly seed: number },
  options: InterchangeSheetOptions = {},
): InterchangeSheetPlan {
  const { doc, plan } = buildInterchangePDF(mech, world, maze, options);
  doc.save(
    `interchange-maze-${mech.object.id}-${mech.cellsPerFace}`
    + `-${asked.stations}-${asked.folds}-${asked.seed}.pdf`,
  );
  return plan;
}
