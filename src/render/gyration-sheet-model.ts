/**
 * Printable pieces for a solid cut open on a seam, as draw lists in page mm.
 *
 * The same shape of thing as `pair-sheet-model.ts` — nets through the
 * unfolder, bulkheads to keep the paper in shape and give it a bearing on a
 * dowel — and it shares the drawing itself (`piece-net-model.ts`). Two things
 * differ, and both come from the object rather than from taste:
 *
 *   - **The pieces are not alike.** A glued pair is one net printed twice with
 *     different walls; a cut solid is two or three *different* subsets of one
 *     solid's faces. They are laid out separately and then drawn at one shared
 *     scale, because a piece drawn at its own scale would not meet its
 *     neighbour.
 *   - **Every cut is its own joint.** Each seam gets two bulkheads and a dowel
 *     of its own, so a solid cut twice is held by two short dowels rather than
 *     one long one — which is also what lets the middle piece turn against
 *     both of its neighbours.
 *
 * Nothing is dropped: the maze runs over the whole surface of the solid, and
 * the only openings are the cuts.
 */

import type { Vec2 } from '../core/vec2.ts';
import type { PageItem } from './face-page-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { GyrationMechanism } from '../core/kinetic/mechanisms/gyration.ts';
import { pickStartGoal, treeRate } from '../core/kinetic/maze.ts';
import { dot, norm, sub } from '../core/vec3.ts';
import { buildEdgeIndex } from './edge-index.ts';
import { drawPieceNet, layOutPiece } from './piece-net-model.ts';
import type { PieceLayout } from './piece-net-model.ts';
import { bulkheadTabQuads, circlePoly, polygonPoints } from './stack-sheet-model.ts';
import type { SheetBox } from './stack-sheet-model.ts';
import {
  STACK_SHEET_STYLE as S,
  STACK_SHEET_DEFAULTS as D,
  A4_SHEET,
} from './kinetic-sheet-constants.ts';

export interface GyrationSheetOptions {
  cellMm?: number;
  dowelMm?: number;
  bulkheadTabMm?: number;
  gapMm?: number;
  sheet?: SheetBox;
  title?: string;
  start?: number;
  goal?: number;
}

export interface GyrationSheetPlan {
  readonly sheets: { items: PageItem[] }[];
  readonly cellMm: number;
  /** One edge of the solid, printed. */
  readonly edgeMm: number;
  /** Across the widest cut, corner to corner: the width of a bulkhead. */
  readonly seamWidthMm: number;
  /** A dowel to cut for each seam, lowest first. */
  readonly dowelLengthsMm: readonly number[];
  readonly perfectStates: number;
  readonly stateCount: number;
}

/** Names a piece for its heading, which is how a builder tells them apart. */
function pieceName(piece: number, pieces: number): string {
  if (pieces === 2) return piece === 0 ? 'Lower piece' : 'Upper piece';
  if (piece === 0) return 'Bottom piece';
  if (piece === pieces - 1) return 'Top piece';
  return `Middle piece${pieces > 3 ? ` ${piece}` : ''}`;
}

export function buildGyrationSheets(
  mech: GyrationMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: GyrationSheetOptions = {},
): GyrationSheetPlan {
  const dowel = options.dowelMm ?? D.dowelMm;
  const bulkheadTab = options.bulkheadTabMm ?? D.bulkheadTabMm;
  const gap = options.gapMm ?? D.gapMm;
  const sheet = options.sheet ?? A4_SHEET;
  const tab = bulkheadTab;

  const allFaces = mech.polyhedron.faces();
  const byId = new Map(allFaces.map(f => [f.id, f]));
  const edgeIndex = buildEdgeIndex(allFaces);
  const pieces: PieceLayout[] = mech.facesOfPiece.map(ids =>
    layOutPiece(mech.polyhedron, ids.map(id => {
      const face = byId.get(id);
      if (!face) throw new Error(`the solid has no face ${id}`);
      return face;
    })),
  );

  // Net units to millimetres. A cell is one edge of the solid over n — the
  // longest edge, where a solid has more than one length, so that no cell
  // comes out over the asked-for size — and every piece has to land inside
  // the sheet at the one shared scale.
  let edgeUnits = 0;
  for (const face of allFaces) {
    const k = face.vertices.length;
    for (let i = 0; i < k; i++) {
      edgeUnits = Math.max(edgeUnits, norm(sub(face.vertices[(i + 1) % k]!, face.vertices[i]!)));
    }
  }
  const unitsPerCell = edgeUnits / mech.n;
  const usableWidth = sheet.width - 2 * sheet.margin - 2 * tab;
  const usableHeight = sheet.height - 2 * sheet.margin - 2 * tab;
  const widest = Math.max(...pieces.map(p => p.width));
  const tallest = Math.max(...pieces.map(p => p.height));
  const wanted = options.cellMm ?? D.cellMm;
  const fits = Math.min(
    usableWidth / (widest / unitsPerCell),
    usableHeight / (tallest / unitsPerCell),
  );
  const cellMm = Math.min(wanted, fits);
  if (cellMm < D.minCellMm) {
    const maxN = Math.max(1, Math.floor(mech.n * (cellMm / D.minCellMm)));
    throw new Error(
      `these pieces need cells of ${cellMm.toFixed(1)} mm to fit the sheet, under the ` +
        `${D.minCellMm} mm a knife can follow; try n of ${maxN} or fewer`,
    );
  }
  const scale = cellMm / unitsPerCell;
  const edgeMm = edgeUnits * scale;

  // How far each piece reaches along the axis, so that each dowel can be as
  // long as its two pieces allow and no longer: a dowel that reached past the
  // far bulkhead of a middle piece would foul the next one.
  const axis = mech.axis.axis;
  const extent = mech.facesOfPiece.map(ids => {
    let low = Infinity;
    let high = -Infinity;
    for (const id of ids) {
      for (const v of byId.get(id)!.vertices) {
        const t = dot(v, axis);
        low = Math.min(low, t);
        high = Math.max(high, t);
      }
    }
    return [low * scale, high * scale] as const;
  });
  const dowelLengthsMm = mech.axis.seams.map((seam, index) => {
    const level = seam.level * scale;
    const below = level - extent[index]![0];
    const above = extent[index + 1]![1] - level;
    return Math.max(15, Math.round(below + above - 8));
  });

  const rate = treeRate(surface, design);
  const ends = pickStartGoal(surface, design);
  const start = options.start ?? ends.start;
  const goal = options.goal ?? ends.goal;

  // Which kinetic cell each (piece, face, cell) is, so the walls can be looked
  // up the same way the 3D view looks them up.
  const cellIndexOf = new Map<string, number>();
  for (let i = 0; i < mech.cells.length; i++) {
    const source = mech.cellSource(i);
    cellIndexOf.set(`${source.piece}:${source.faceId}:${source.cell}`, i);
  }
  const isOpen = (cellIndex: number, side: number): boolean =>
    design.open.has(surface.classOf[surface.sideStart[cellIndex]! + side]!);

  const sheets: { items: PageItem[] }[] = [];
  let items: PageItem[] = [];
  let cursorY = sheet.margin;
  const pushSheet = () => {
    if (items.length > 0) sheets.push({ items });
    items = [];
    cursorY = sheet.margin;
  };
  const ensure = (height: number) => {
    if (cursorY > sheet.margin && cursorY + height > sheet.height - sheet.margin) pushSheet();
  };

  // ---- Header -------------------------------------------------------------
  const title = options.title ??
    `Cut solid — a ${mech.shapeName} in ${mech.pieceCount} pieces`;
  items.push({
    kind: 'text', at: [sheet.margin, cursorY + S.titleSize], text: title,
    size: S.titleSize, color: S.titleColor, align: 'left', bold: true,
  });
  cursorY += S.titleSize + 2.5;

  const perfect = rate.perfect;
  const cuts = mech.axis.seams.length;
  const puzzleLine = perfect === surface.stateCount
    ? `Every one of the ${surface.stateCount} ways to turn the pieces is a perfect maze.`
    : `${perfect} of the ${surface.stateCount} ways to turn the pieces make a perfect maze — find one.`;
  for (const note of [
    'Print at 100%. Glue the sheets to thin card, then cut.',
    '1. Cut each piece on the dashed outline, round the shaded tabs.',
    '2. Fold along every seam between two faces, all one way — the heavy lines inside a piece ' +
      'are its folds.',
    '3. Glue the tabs inside. The open polygon on each piece is a cut — leave it open.',
    `4. Pierce the bulkheads and the discs for a ${dowel} mm dowel, and cut ` +
      `${cuts === 1 ? 'a dowel' : `${cuts} dowels`} of ` +
      `${dowelLengthsMm.map(mm => `${mm} mm`).join(' and ')}.`,
    '5. Fold the bulkhead tabs. At each cut, glue one bulkhead inside the piece below, flush ' +
      'with the opening, then glue the dowel standing in its hole.',
    '6. Slide the second bulkhead on, glue a disc to the dowel above it, and glue that ' +
      'bulkhead into the piece above, disc inside.',
    '7. Nothing else is glued: the pieces have to turn against each other.',
    puzzleLine,
  ]) {
    items.push({
      kind: 'text', at: [sheet.margin, cursorY + S.noteSize], text: note,
      size: S.noteSize, color: S.noteColor, align: 'left',
    });
    cursorY += S.noteLeading;
  }
  cursorY += gap;

  // ---- The pieces ---------------------------------------------------------
  pieces.forEach((piece, index) => {
    const netWidth = piece.width * scale;
    const netHeight = piece.height * scale;
    ensure(netHeight + 2 * tab + S.labelSize + 2.5);
    items.push({
      kind: 'text', at: [sheet.margin, cursorY + S.labelSize],
      text: `${pieceName(index, pieces.length)} (${index + 1} of ${pieces.length}) — ` +
        `${piece.faces.length} faces`,
      size: S.labelSize, color: S.labelColor, align: 'left',
    });
    cursorY += S.labelSize + 2.5;

    const originX = sheet.margin + tab + Math.max(0, (usableWidth - netWidth) / 2);
    const originY = cursorY + tab;
    items.push(...drawPieceNet({
      piece,
      polyhedron: mech.polyhedron,
      edgeIndex,
      n: mech.n,
      scale,
      origin: [originX, originY],
      tabMm: tab,
      cellMm,
      cellIndexOf: (faceId, cell) => cellIndexOf.get(`${index}:${faceId}:${cell}`),
      isOpen,
      start,
      goal,
    }));
    cursorY += netHeight + 2 * tab + gap;
  });

  // ---- Bulkheads ----------------------------------------------------------
  // Two to a cut, one for the piece below and one for the piece above, and the
  // polygon is the cut itself rather than a guess at it.
  let seamWidthMm = 0;
  mech.axis.seams.forEach((seam, index) => {
    const radii = seam.polygon.map(v => {
      const height = dot(v, axis);
      return norm(sub(v, [axis[0] * height, axis[1] * height, axis[2] * height]));
    });
    const spread = Math.max(...radii) - Math.min(...radii);
    if (spread > 1e-6 * Math.max(...radii)) {
      throw new Error(
        `the cut on this solid is not a regular polygon — its corners stand ` +
          `${spread.toFixed(3)} apart in radius, and a bulkhead cannot be cut from one circle`,
      );
    }
    const circumMm = radii[0]! * scale;
    const radiusMm = circumMm - D.bulkheadInsetMm;
    seamWidthMm = Math.max(seamWidthMm, 2 * circumMm);

    const across = radiusMm + bulkheadTab;
    const acrossSheet = sheet.width - 2 * sheet.margin;
    if (2 * across > acrossSheet) {
      throw new Error(
        `a bulkhead is ${(2 * across).toFixed(0)} mm across, wider than the ` +
          `${acrossSheet.toFixed(0)} mm the sheet has; try a smaller n`,
      );
    }
    const perRow = Math.max(1, Math.floor((acrossSheet + gap) / (2 * across + gap)));
    const which = mech.axis.seams.length === 1
      ? 'the cut'
      : index === 0 ? 'the lower cut' : 'the upper cut';
    const heading = `Bulkheads (2) for ${which} — ${seam.loop}-gon, ${dowel} mm hole`;
    for (let placed = 0; placed < 2; ) {
      const inRow = Math.min(perRow, 2 - placed);
      const wasOn = sheets.length;
      ensure(2 * across + S.labelSize + 2.5);
      if (placed === 0 || sheets.length !== wasOn) {
        items.push({
          kind: 'text', at: [sheet.margin, cursorY + S.labelSize], text: heading,
          size: S.labelSize, color: S.labelColor, align: 'left',
        });
        cursorY += S.labelSize + 2.5;
      }
      for (let i = 0; i < inRow; i++) {
        const cx = sheet.margin + across + i * (2 * across + gap);
        const cy = cursorY + across;
        const points = polygonPoints([cx, cy], radiusMm, seam.loop);
        for (const quad of bulkheadTabQuads(points, bulkheadTab)) {
          items.push({ kind: 'poly', pts: quad, fill: S.glueFill });
        }
        for (let e = 0; e < points.length; e++) {
          items.push({
            kind: 'line', a: points[e]!, b: points[(e + 1) % points.length]!,
            stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash,
          });
        }
        items.push({
          kind: 'poly', pts: circlePoly([cx, cy], (dowel + D.dowelClearanceMm) / 2),
          stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
        });
      }
      cursorY += 2 * across + gap;
      placed += inRow;
    }
  });

  // The discs that stop the pieces lifting off a dowel, two to a cut. Their
  // holes get no clearance: one is glued to the dowel, the other turns against
  // a bulkhead.
  const discRadius = 1.5 * dowel;
  const discs = 2 * mech.axis.seams.length;
  ensure(2 * discRadius + S.labelSize + 2.5);
  items.push({
    kind: 'text', at: [sheet.margin, cursorY + S.labelSize],
    text: `Retaining discs (${discs}) — ${dowel} mm hole, no clearance`,
    size: S.labelSize, color: S.labelColor, align: 'left',
  });
  cursorY += S.labelSize + 2.5;
  for (let i = 0; i < discs; i++) {
    const cx = sheet.margin + discRadius + i * (2 * discRadius + gap);
    const cy = cursorY + discRadius;
    const circle: Vec2 = [cx, cy];
    items.push({
      kind: 'poly', pts: circlePoly(circle, discRadius),
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    });
    items.push({
      kind: 'poly', pts: circlePoly(circle, dowel / 2),
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    });
  }
  cursorY += 2 * discRadius;
  pushSheet();

  return {
    sheets,
    cellMm,
    edgeMm,
    seamWidthMm,
    dowelLengthsMm,
    perfectStates: perfect,
    stateCount: surface.stateCount,
  };
}
