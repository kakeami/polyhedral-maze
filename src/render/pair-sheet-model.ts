/**
 * Printable pieces for the glued pair, as draw lists in page millimetres.
 *
 * DOM-free like `stack-sheet-model.ts`, and it emits the same `PageItem`
 * primitives so `pdf-face-page-painter.ts` paints it unchanged. Unlike the
 * stack it *does* go through the net unfolder: a cupola's surface is not a
 * rectangle, and the app already knows how to lay a solid's faces out flat.
 *
 * What is printed is the solid with one face missing — the face the two halves
 * are glued at is inside the finished object and never seen. The hole it leaves
 * is closed by a bulkhead, which is what keeps the paper solid in shape and
 * gives it a bearing on the dowel.
 *
 * The two halves are the same shape but not the same drawing: a side class is
 * shared by every side that can ever meet, and the two halves hold different
 * cells, so each gets its own walls.
 */

import type { PageItem } from './face-page-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { JoinedPairMechanism } from '../core/kinetic/mechanisms/joined.ts';
import { isSideOpen, pickStartGoal, treeRate } from '../core/kinetic/maze.ts';
import { sub, scale as scale3, dot, mean, norm } from '../core/vec3.ts';
import { buildEdgeIndex } from './edge-index.ts';
import { drawPieceNet, layOutPiece } from './piece-net-model.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import {
  STACK_SHEET_STYLE as S,
  STACK_SHEET_DEFAULTS as D,
  A4_SHEET,
} from './kinetic-sheet-constants.ts';
import {
  SheetFlow, bulkheadItems, discItems, fitCellMm, turningLine,
} from './kinetic-sheet-parts.ts';

export interface PairSheetOptions {
  /** One maze cell, measured along an edge of the solid. */
  cellMm?: number;
  dowelMm?: number;
  bulkheadTabMm?: number;
  gapMm?: number;
  sheet?: SheetBox;
  title?: string;
  start?: number;
  goal?: number;
}

export interface PairSheetPlan {
  readonly sheets: { readonly items: PageItem[] }[];
  readonly cellMm: number;
  /** One edge of the finished solid. */
  readonly edgeMm: number;
  /** Across the joint, corner to corner: the width of a bulkhead. */
  readonly jointWidthMm: number;
  /** Dowel to cut: long enough to hold the halves, short enough to stay inside. */
  readonly dowelLengthMm: number;
  readonly perfectStates: number;
  readonly stateCount: number;
}

export function buildPairSheets(
  mech: JoinedPairMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: PairSheetOptions = {},
): PairSheetPlan {
  const dowel = options.dowelMm ?? D.dowelMm;
  const bulkheadTab = options.bulkheadTabMm ?? D.bulkheadTabMm;
  const gap = options.gapMm ?? D.gapMm;
  const sheet = options.sheet ?? A4_SHEET;

  const allFaces = mech.polyhedron.faces();
  const joint = allFaces.find(f => f.id === mech.jointFaceId);
  if (!joint) throw new Error(`the solid has no face ${mech.jointFaceId}`);
  const edgeIndex = buildEdgeIndex(allFaces);
  // The solid with the glued face taken out: that face is inside the finished
  // object and never seen, and the hole it leaves is where the bulkhead goes.
  const carrying = allFaces.filter(f => f.id !== mech.jointFaceId);
  const piece = layOutPiece(mech.polyhedron, carrying);
  const layout = piece.layout;

  // Net units to millimetres. One cell is one edge of the solid over n, and
  // the whole net has to land inside the sheet with room for the glue tabs.
  const edgeUnits = norm(sub(joint.vertices[0]!, joint.vertices[1]!));
  const unitsPerCell = edgeUnits / mech.n;
  const tab = bulkheadTab;
  const usableWidth = sheet.width - 2 * sheet.margin - 2 * tab;
  const usableHeight = sheet.height - 2 * sheet.margin - 2 * tab;
  const cellMm = fitCellMm({
    wanted: options.cellMm ?? D.cellMm,
    unitsPerCell,
    netWidth: layout.width,
    netHeight: layout.height,
    usableWidth,
    usableHeight,
    n: mech.n,
    refusal: 'this net needs',
  });
  const scale = cellMm / unitsPerCell;
  const edgeMm = edgeUnits * scale;

  // How deep each half is, measured down the axis from the joint. The dowel
  // lives between the two bulkheads and must not reach the far end, because
  // that end carries maze: a hole through it would cost a cell, and a 6 mm
  // dowel through a 10 mm cell costs the whole cell.
  const jointCentre = mean(joint.vertices);
  const into = scale3(joint.normal, -1);
  let depthUnits = 0;
  for (const face of carrying) {
    for (const v of face.vertices) depthUnits = Math.max(depthUnits, dot(sub(v, jointCentre), into));
  }
  const depthMm = depthUnits * scale;
  const dowelLengthMm = Math.max(15, Math.round(2 * (depthMm - 4)));

  const rate = treeRate(surface, design);
  const ends = pickStartGoal(surface, design);
  const start = options.start ?? ends.start;
  const goal = options.goal ?? ends.goal;

  // Which kinetic cell each (half, face, cell) is, so the walls can be looked
  // up the same way the 3D view looks them up.
  const cellIndexOf = new Map<string, number>();
  for (let i = 0; i < mech.cells.length; i++) {
    const source = mech.cellSource(i);
    cellIndexOf.set(`${source.piece}:${source.faceId}:${source.cell}`, i);
  }
  const isOpen = (cellIndex: number, side: number): boolean =>
    isSideOpen(surface, design, cellIndex, side);

  const flow = new SheetFlow(sheet);

  // ---- Header -------------------------------------------------------------
  flow.title(options.title ?? `Glued pair — two ${mech.shapeName}s at a ${mech.gon}-gon`);

  const perfect = rate.perfect;
  const puzzleLine = turningLine(perfect, surface.stateCount, 'the halves');
  flow.notes([
    'Print at 100%. Glue the sheets to thin card, then cut.',
    '1. Cut each half on the dashed outline, round the shaded tabs.',
    '2. Fold along every seam between two faces, all one way — the heavy lines inside a piece ' +
      'are its folds.',
    '3. Glue the tabs inside. The open polygon is the face the two halves meet at — leave it open.',
    `4. Pierce the bulkheads and the two discs for a ${dowel} mm dowel, and cut a dowel about ` +
      `${dowelLengthMm} mm long.`,
    '5. Fold the bulkhead tabs. Glue one bulkhead inside the first half, flush with the opening, ' +
      'then glue the dowel standing in its hole.',
    '6. Slide the second bulkhead on, glue a disc to the dowel above it, and glue that bulkhead ' +
      'into the second half with the disc inside.',
    '7. Nothing else is glued: the two halves have to turn against each other.',
    puzzleLine,
  ]);
  flow.y += gap;

  // ---- The two halves -----------------------------------------------------
  const netWidth = layout.width * scale;
  const netHeight = layout.height * scale;
  const blockHeight = netHeight + 2 * tab + S.labelSize + 2.5;
  for (let half = 0; half < 2; half++) {
    flow.ensure(blockHeight);
    flow.label(half === 0 ? 'Lower half (1 of 2)' : 'Upper half (2 of 2)');

    const originX = sheet.margin + tab + Math.max(0, (usableWidth - netWidth) / 2);
    const originY = flow.y + tab;
    flow.add(...drawPieceNet({
      piece,
      polyhedron: mech.polyhedron,
      edgeIndex,
      n: mech.n,
      scale,
      origin: [originX, originY],
      tabMm: tab,
      cellMm,
      cellIndexOf: (faceId, cell) => cellIndexOf.get(`${half}:${faceId}:${cell}`),
      isOpen,
      start,
      goal,
    }));
    flow.y += netHeight + 2 * tab + gap;
  }

  // ---- Bulkheads ----------------------------------------------------------
  const jointCircumUnits = norm(sub(joint.vertices[0]!, mean(joint.vertices)));
  const jointRadiusMm = jointCircumUnits * scale - D.bulkheadInsetMm;
  const jointWidthMm = 2 * (jointCircumUnits * scale);
  // Both halves need one, and a wide joint puts two of them past the edge of
  // the sheet side by side. They go one under the other then, and onto a
  // further sheet if that is what it takes: a pattern that is one bulkhead
  // short is a pattern for an object that cannot be built.
  const across = jointRadiusMm + bulkheadTab;
  const acrossSheet = sheet.width - 2 * sheet.margin;
  if (2 * across > acrossSheet) {
    throw new Error(
      `a bulkhead is ${(2 * across).toFixed(0)} mm across, wider than the ` +
        `${acrossSheet.toFixed(0)} mm the sheet has; try a smaller n`,
    );
  }
  const perRow = Math.max(1, Math.floor((acrossSheet + gap) / (2 * across + gap)));
  const heading = `Bulkheads (2) and retaining discs (2) — ${mech.gon}-gon, ${dowel} mm hole`;
  for (let placed = 0; placed < 2; ) {
    const inRow = Math.min(perRow, 2 - placed);
    const turned = flow.ensure(2 * across + S.labelSize + 2.5);
    if (placed === 0 || turned) flow.label(heading);
    for (let i = 0; i < inRow; i++) {
      const cx = sheet.margin + across + i * (2 * across + gap);
      const cy = flow.y + across;
      flow.add(...bulkheadItems([cx, cy], jointRadiusMm, mech.gon, bulkheadTab, dowel));
    }
    flow.y += 2 * across + gap;
    placed += inRow;
  }

  // The discs that stop the halves lifting off the dowel. Their holes get no
  // clearance: one is glued to the dowel, the other turns against a bulkhead.
  const discRadius = 1.5 * dowel;
  flow.ensure(2 * discRadius + S.labelSize);
  for (let i = 0; i < 2; i++) {
    const cx = sheet.margin + discRadius + i * (2 * discRadius + gap);
    const cy = flow.y + discRadius;
    flow.add(...discItems([cx, cy], discRadius, dowel));
  }
  flow.y += 2 * discRadius;

  return {
    sheets: flow.finish(),
    cellMm,
    edgeMm,
    jointWidthMm,
    dowelLengthMm,
    perfectStates: perfect,
    stateCount: surface.stateCount,
  };
}
