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

import type { Vec2 } from '../core/vec2.ts';
import type { Face } from '../core/types.ts';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { PageItem } from './face-page-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { JoinedPairMechanism } from '../core/kinetic/mechanisms/joined.ts';
import { pickStartGoal, treeRate } from '../core/kinetic/maze.ts';
import { sub, scale as scale3, dot } from '../core/vec3.ts';
import { computeNetLayout } from './net-layout.ts';
import { cellVerts2d } from './net-cell-geometry.ts';
import { buildEdgeIndex } from './edge-index.ts';
import { bulkheadTabQuads, circlePoly, polygonPoints } from './stack-sheet-model.ts';
import type { SheetBox } from './stack-sheet-model.ts';
import {
  STACK_SHEET_STYLE as S,
  STACK_SHEET_DEFAULTS as D,
  A4_SHEET,
} from './kinetic-sheet-constants.ts';

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

/**
 * The solid with the glued face taken out, for the unfolder to lay flat.
 *
 * The faces are renumbered 0, 1, 2, ... because the unfolder reaches for
 * `faces[id]`: leave a gap in the numbering and it walks off the end of its own
 * array. Everything else here keeps the solid's real face ids, so the caller
 * translates at the one boundary rather than throughout.
 */
function withoutJoint(polyhedron: Polyhedron, carrying: readonly Face[]): Polyhedron {
  const renumbered = carrying.map((face, index) => ({ ...face, id: index }));
  return {
    faces: () => renumbered,
    faceAdjacency: () => polyhedron.faceAdjacency(),
    gridForFace: (face, n) => polyhedron.gridForFace(face, n),
  };
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
  const carrying = allFaces.filter(f => f.id !== mech.jointFaceId);
  const netIdOf = new Map(carrying.map((face, index) => [face.id, index]));
  const layout = computeNetLayout(withoutJoint(mech.polyhedron, carrying));
  const netFaces = new Map(layout.faces.map(f => [f.faceId, f.vertices2d]));

  // Net units to millimetres. One cell is one edge of the solid over n, and
  // the whole net has to land inside the sheet with room for the glue tabs.
  const edgeUnits = length2(joint.vertices[0]!, joint.vertices[1]!, true);
  const unitsPerCell = edgeUnits / mech.n;
  const tab = bulkheadTab;
  const usableWidth = sheet.width - 2 * sheet.margin - 2 * tab;
  const usableHeight = sheet.height - 2 * sheet.margin - 2 * tab;
  const wanted = options.cellMm ?? D.cellMm;
  const fits = Math.min(
    usableWidth / (layout.width / unitsPerCell),
    usableHeight / (layout.height / unitsPerCell),
  );
  const cellMm = Math.min(wanted, fits);
  if (cellMm < D.minCellMm) {
    const maxN = Math.max(1, Math.floor(mech.n * (cellMm / D.minCellMm)));
    throw new Error(
      `this net needs cells of ${cellMm.toFixed(1)} mm to fit the sheet, under the ` +
        `${D.minCellMm} mm a knife can follow; try n of ${maxN} or fewer`,
    );
  }
  const scale = cellMm / unitsPerCell;
  const edgeMm = edgeUnits * scale;

  // How deep each half is, measured down the axis from the joint. The dowel
  // lives between the two bulkheads and must not reach the far end, because
  // that end carries maze: a hole through it would cost a cell, and a 6 mm
  // dowel through a 10 mm cell costs the whole cell.
  const jointCentre = centroid3(joint);
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
  const title = options.title ?? `Glued pair — two ${mech.shapeName}s at a ${mech.gon}-gon`;
  items.push({
    kind: 'text', at: [sheet.margin, cursorY + S.titleSize], text: title,
    size: S.titleSize, color: S.titleColor, align: 'left', bold: true,
  });
  cursorY += S.titleSize + 2.5;

  const perfect = rate.perfectStates.length;
  const puzzleLine = perfect === surface.stateCount
    ? `Every one of the ${surface.stateCount} ways to turn the halves is a perfect maze.`
    : `${perfect} of the ${surface.stateCount} ways to turn the halves make a perfect maze — find one.`;
  for (const note of [
    'Print at 100%. Glue the sheets to thin card, then cut.',
    '1. Cut each half on the dashed outline. Score the dotted folds and fold them all one way.',
    '2. Glue the tabs inside. The open polygon is the face the two halves meet at — leave it open.',
    `3. Pierce the bulkheads and the two discs for a ${dowel} mm dowel, and cut a dowel about ` +
      `${dowelLengthMm} mm long.`,
    '4. Fold the bulkhead tabs. Glue one bulkhead inside the first half, flush with the opening, ' +
      'then glue the dowel standing in its hole.',
    '5. Slide the second bulkhead on, glue a disc to the dowel above it, and glue that bulkhead ' +
      'into the second half with the disc inside.',
    '6. Nothing else is glued: the two halves have to turn against each other.',
    puzzleLine,
  ]) {
    items.push({
      kind: 'text', at: [sheet.margin, cursorY + S.noteSize], text: note,
      size: S.noteSize, color: S.noteColor, align: 'left',
    });
    cursorY += S.noteLeading;
  }
  cursorY += gap;

  // ---- The two halves -----------------------------------------------------
  const netWidth = layout.width * scale;
  const netHeight = layout.height * scale;
  const blockHeight = netHeight + 2 * tab + S.labelSize + 2.5;
  for (let piece = 0; piece < 2; piece++) {
    ensure(blockHeight);
    items.push({
      kind: 'text', at: [sheet.margin, cursorY + S.labelSize],
      text: piece === 0 ? 'Lower half (1 of 2)' : 'Upper half (2 of 2)',
      size: S.labelSize, color: S.labelColor, align: 'left',
    });
    cursorY += S.labelSize + 2.5;

    const originX = sheet.margin + tab + Math.max(0, (usableWidth - netWidth) / 2);
    const originY = cursorY + tab;
    // Page millimetres run y-down and the net comes out y-up.
    const place = ([x, y]: Vec2): Vec2 => [originX + x * scale, originY + (layout.height - y) * scale];

    for (const face of carrying) {
      const flat = netFaces.get(netIdOf.get(face.id)!);
      if (!flat) continue;
      drawFace(face, flat, piece);
    }
    cursorY += netHeight + 2 * tab + gap;

    function drawFace(face: Face, flat: Vec2[], half: number) {
      const grid = mech.polyhedron.gridForFace(face, mech.n);
      const sides = face.vertices.length;

      // Outline: a fold where the neighbour was unfolded beside it, a cut
      // otherwise. Cuts on the joint's own ring get no tab: that opening is
      // where the bulkhead goes and where the other half sits.
      for (let e = 0; e < sides; e++) {
        const a = place(flat[e]!);
        const b = place(flat[(e + 1) % sides]!);
        const neighbour = edgeIndex.findAdjacentFace(face.id, e);
        const onJoint = neighbour === mech.jointFaceId;
        const here = netIdOf.get(face.id)!;
        const there = neighbour === null ? undefined : netIdOf.get(neighbour);
        const folded = there !== undefined && layout.foldPairs.has(
          here < there ? `${here}:${there}` : `${there}:${here}`,
        );
        if (folded) {
          items.push({ kind: 'line', a, b, stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash });
          continue;
        }
        items.push({ kind: 'line', a, b, stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash });
        if (!onJoint && layout.tabOwners.has(`${here}:${e}`)) {
          items.push({
            kind: 'poly', pts: glueTab(a, b, tab * 0.7),
            stroke: S.glueColor, width: S.glueWidth, dash: S.cutDash,
          });
        }
      }

      for (const cell of grid.cells()) {
        const index = cellIndexOf.get(`${half}:${face.id}:${cell}`);
        if (index === undefined) continue;
        const corners = cellVerts2d(flat, cell, mech.n, grid.kind).map(place);
        if (index === start || index === goal) {
          items.push({
            kind: 'poly', pts: corners,
            fill: index === start ? S.startColor : S.goalColor,
          });
          items.push({
            kind: 'text', at: centre(corners), text: index === start ? 'S' : 'G',
            size: S.markerTextSize, color: S.markerTextColor,
          });
        }
        for (let side = 0; side < corners.length; side++) {
          if (isOpen(index, side)) continue;
          items.push({
            kind: 'line', a: corners[side]!, b: corners[(side + 1) % corners.length]!,
            stroke: S.wallColor, width: S.wallWidth, cap: 'round',
          });
        }
      }
    }
  }

  // ---- Bulkheads ----------------------------------------------------------
  const jointCircumUnits = length2(joint.vertices[0]!, centroid3(joint), true);
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
      const points = polygonPoints([cx, cy], jointRadiusMm, mech.gon);
      for (const quad of bulkheadTabQuads(points, bulkheadTab)) {
        items.push({
          kind: 'poly', pts: quad, stroke: S.glueColor, width: S.glueWidth, dash: S.cutDash,
        });
      }
      for (let e = 0; e < points.length; e++) {
        items.push({
          kind: 'line', a: points[e]!, b: points[(e + 1) % points.length]!,
          stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash,
        });
      }
      items.push({
        kind: 'poly', pts: circlePoly([cx, cy], (dowel + D.dowelClearanceMm) / 2),
        stroke: S.cutColor, width: S.cutWidth,
      });
    }
    cursorY += 2 * across + gap;
    placed += inRow;
  }

  // The discs that stop the halves lifting off the dowel. Their holes get no
  // clearance: one is glued to the dowel, the other turns against a bulkhead.
  const discRadius = 1.5 * dowel;
  ensure(2 * discRadius + S.labelSize);
  for (let i = 0; i < 2; i++) {
    const cx = sheet.margin + discRadius + i * (2 * discRadius + gap);
    const cy = cursorY + discRadius;
    items.push({
      kind: 'poly', pts: circlePoly([cx, cy], discRadius),
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    });
    items.push({
      kind: 'poly', pts: circlePoly([cx, cy], dowel / 2),
      stroke: S.cutColor, width: S.cutWidth,
    });
  }
  cursorY += 2 * discRadius;
  pushSheet();

  return {
    sheets,
    cellMm,
    edgeMm,
    jointWidthMm,
    dowelLengthMm,
    perfectStates: perfect,
    stateCount: surface.stateCount,
  };
}

/** A tab standing off the outside of a cut edge, tapered so it glues flat. */
function glueTab(a: Vec2, b: Vec2, height: number): Vec2[] {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const len = Math.hypot(ex, ey) || 1;
  const ux = ex / len;
  const uy = ey / len;
  // Page coordinates run y-down, so the outward normal turns the other way
  // from the textbook one.
  const nx = uy;
  const ny = -ux;
  const taper = Math.min(height, len / 3);
  return [
    a,
    [a[0] + ux * taper + nx * height, a[1] + uy * taper + ny * height],
    [b[0] - ux * taper + nx * height, b[1] - uy * taper + ny * height],
    b,
  ];
}

function centre(points: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

function centroid3(face: Face): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const v of face.vertices) {
    x += v[0];
    y += v[1];
    z += v[2];
  }
  const k = face.vertices.length;
  return [x / k, y / k, z / k];
}

function length2(
  a: readonly number[], b: readonly number[], threeD = false,
): number {
  return threeD
    ? Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
    : Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
}
