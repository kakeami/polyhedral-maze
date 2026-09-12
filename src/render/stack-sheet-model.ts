/**
 * Printable pieces for the stack mechanism, as draw lists in page millimetres.
 *
 * DOM-free, like `face-page-model.ts`, and it emits the same `PageItem`
 * primitives so `pdf-face-page-painter.ts` can paint it unchanged. It does not
 * go through the net unfolder: a prism layer's lateral surface *is* a
 * rectangle, so the band is laid out directly and stays exact.
 *
 * A layer is built as a band plus two bulkheads. The band carries the maze; the
 * bulkheads are blank discs with a hole that keep the ring round and give it a
 * bearing on the dowel — without them a paper ring folds flat the first time
 * someone turns it.
 */

import type { Vec2 } from '../core/vec2.ts';
import type { PageItem } from './face-page-model.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import type { StackMechanism } from '../core/kinetic/mechanisms/stack.ts';
import { pickStartGoal, treeRate } from '../core/kinetic/maze.ts';
import { STACK_SHEET_STYLE as S, STACK_SHEET_DEFAULTS as D, A4_SHEET } from './kinetic-sheet-constants.ts';

export interface SheetBox {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}

export interface StackSheetOptions {
  cellMm?: number;
  dowelMm?: number;
  bandTabMm?: number;
  bulkheadTabMm?: number;
  gapMm?: number;
  sheet?: SheetBox;
  title?: string;
  /** Cell index of the entrance; defaults to the bottom rim. */
  start?: number;
  /** Cell index of the exit; defaults to the top rim, across the barrel. */
  goal?: number;
}

export interface StackSheet {
  readonly items: PageItem[];
}

export interface StackSheetPlan {
  readonly sheets: StackSheet[];
  /** Outside width of the finished barrel, across the corners. */
  readonly barrelWidthMm: number;
  readonly barrelHeightMm: number;
  readonly cellMm: number;
  readonly bulkheadCount: number;
  /** How many of the mechanism's configurations are perfect mazes. */
  readonly perfectStates: number;
  readonly stateCount: number;
}

const TAU = Math.PI * 2;

function circlePoly(center: Vec2, radius: number, segments = 40): Vec2[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * TAU;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)] as Vec2;
  });
}

/** Regular polygon with a flat side at the bottom, centred on `center`. */
function polygonPoints(center: Vec2, circumradius: number, sides: number): Vec2[] {
  const offset = Math.PI / 2 + Math.PI / sides;
  return Array.from({ length: sides }, (_, i) => {
    const a = offset + (i / sides) * TAU;
    return [center[0] + circumradius * Math.cos(a), center[1] + circumradius * Math.sin(a)] as Vec2;
  });
}


/**
 * Glue tabs standing off each edge of a bulkhead, as closed quads.
 *
 * Each tab is cut back from both ends of its edge, or the flat patterns of two
 * tabs meeting at a corner would overlap and could not both be cut out. The
 * cut-back is the tab height over the tangent of half the interior angle — the
 * familiar 45 degrees on a square box, less on a hexagon — plus a little
 * clearance so the folded tabs do not rub.
 */
export function bulkheadTabQuads(
  points: readonly Vec2[],
  tabHeight: number,
  clearance: number = D.tabClearanceMm,
): Vec2[][] {
  const sides = points.length;
  const interiorAngle = (Math.PI * (sides - 2)) / sides;
  const taperFor = (length: number) =>
    Math.min(tabHeight / Math.tan(interiorAngle / 2) + clearance, length / 2.5);
  return points.map((a, i) => {
    const b = points[(i + 1) % sides]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    const ux = ex / len;
    const uy = ey / len;
    // Page coordinates run y-down, so the outward normal is the edge direction
    // turned the other way from the textbook one.
    const nx = uy;
    const ny = -ux;
    const taper = taperFor(len);
    return [
      a,
      [a[0] + ux * taper + nx * tabHeight, a[1] + uy * taper + ny * tabHeight],
      [b[0] - ux * taper + nx * tabHeight, b[1] - uy * taper + ny * tabHeight],
      b,
    ] as Vec2[];
  });
}

export function buildStackSheets(
  mech: StackMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: StackSheetOptions = {},
): StackSheetPlan {
  const cell = options.cellMm ?? D.cellMm;
  const dowel = options.dowelMm ?? D.dowelMm;
  const bandTab = options.bandTabMm ?? D.bandTabMm;
  const bulkheadTab = options.bulkheadTabMm ?? D.bulkheadTabMm;
  const gap = options.gapMm ?? D.gapMm;
  const sheet = options.sheet ?? A4_SHEET;

  const columns = mech.sides * mech.cols;
  const bandWidth = columns * cell;
  const bandHeight = mech.rows * cell;
  const usableWidth = sheet.width - 2 * sheet.margin;
  if (bandWidth + bandTab > usableWidth) {
    const maxCell = (usableWidth - bandTab) / columns;
    throw new Error(
      `a band of ${columns} columns does not fit the sheet at ${cell} mm a cell; ` +
        `use cellMm of at most ${maxCell.toFixed(1)}`,
    );
  }

  const open = (cellIndex: number, side: number): boolean =>
    design.open.has(surface.classOf[surface.sideStart[cellIndex]! + side]!);

  const rate = treeRate(surface, design);
  const circumradius = cell * mech.cols / (2 * Math.sin(Math.PI / mech.sides));
  const ends = pickStartGoal(surface, design);
  const start = options.start ?? ends.start;
  const goal = options.goal ?? ends.goal;

  const sheets: StackSheet[] = [];
  let items: PageItem[] = [];
  let cursorY = sheet.margin;
  const pushSheet = () => {
    if (items.length > 0) sheets.push({ items });
    items = [];
    cursorY = sheet.margin;
  };
  const ensure = (height: number) => {
    if (cursorY + height > sheet.height - sheet.margin) pushSheet();
  };

  // ---- Header and instructions -------------------------------------------
  const title = options.title ?? `Stack maze — ${mech.sides}-gon, ${mech.layers} layers`;
  items.push({
    kind: 'text', at: [sheet.margin, cursorY + S.titleSize], text: title,
    size: S.titleSize, color: S.titleColor, align: 'left', bold: true,
  });
  cursorY += S.titleSize + 2.5;

  const perfect = rate.perfectStates.length;
  const puzzleLine =
    perfect === surface.stateCount
      ? `Every one of the ${surface.stateCount} ways to turn the rings is a perfect maze.`
      : `${perfect} of the ${surface.stateCount} ways to turn the rings make a perfect maze — find one.`;
  const notes = [
    'Print at 100%. Glue the sheet to thin card, then cut.',
    `1. Cut each band on the dashed outline. Score the dotted verticals and fold them.`,
    `2. Roll the band into a ring and glue the tab inside the far end.`,
    `3. Fold the bulkhead tabs and glue one bulkhead inside each end of every band, flush with the edge.`,
    `4. Thread the ${mech.layers} rings onto a ${dowel} mm dowel. Do not glue them — they have to turn.`,
    '5. Cap the dowel above and below so the rings cannot slide off.',
    puzzleLine,
  ];
  for (const note of notes) {
    items.push({
      kind: 'text', at: [sheet.margin, cursorY + S.noteSize], text: note,
      size: S.noteSize, color: S.noteColor, align: 'left',
    });
    cursorY += S.noteLeading;
  }
  cursorY += gap;

  // ---- Bands --------------------------------------------------------------
  for (let layer = 0; layer < mech.layers; layer++) {
    const blockHeight = bandHeight + S.labelSize + 2.5;
    ensure(blockHeight + gap);
    const x0 = sheet.margin;
    const labelY = cursorY + S.labelSize;
    const y0 = labelY + 2.5; // top of the band
    const xOf = (u: number) => x0 + u * cell;
    const yOf = (v: number) => y0 + (mech.rows - v) * cell;

    const role =
      layer === 0 ? 'bottom' : layer === mech.layers - 1 ? 'top' : `${layer + 1} from bottom`;
    items.push({
      kind: 'text', at: [x0, labelY], text: `Ring ${layer + 1} (${role})`,
      size: S.labelSize, color: S.labelColor, align: 'left',
    });

    // Cut outline: band plus the taper of the glue tab.
    const tabTop = y0 + D.tabTaperMm;
    const tabBottom = y0 + bandHeight - D.tabTaperMm;
    items.push({
      kind: 'poly',
      pts: [
        [x0, y0], [xOf(columns), y0], [xOf(columns) + bandTab, tabTop],
        [xOf(columns) + bandTab, tabBottom], [xOf(columns), y0 + bandHeight], [x0, y0 + bandHeight],
      ],
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    });

    // Score lines at the prism's vertical edges, and at the tab fold.
    for (let k = 1; k <= mech.sides; k++) {
      const x = xOf(k * mech.cols);
      items.push({
        kind: 'line', a: [x, y0], b: [x, y0 + bandHeight],
        stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash,
      });
    }

    // Walls. Every edge of the grid is drawn once: the bottom and left side of
    // each cell, plus the top side of the top row. The band's right edge is the
    // same seam as its left edge once rolled, so it is not drawn twice.
    for (let face = 0; face < mech.sides; face++) {
      for (let col = 0; col < mech.cols; col++) {
        const u = face * mech.cols + col;
        for (let row = 0; row < mech.rows; row++) {
          const index = mech.cellIndex(layer, face, row, col);
          const wall = (a: Vec2, b: Vec2) =>
            items.push({ kind: 'line', a, b, stroke: S.wallColor, width: S.wallWidth, cap: 'round' });
          if (!open(index, 0)) wall([xOf(u), yOf(row)], [xOf(u + 1), yOf(row)]);
          if (!open(index, 3)) wall([xOf(u), yOf(row)], [xOf(u), yOf(row + 1)]);
          if (row === mech.rows - 1 && !open(index, 2)) {
            wall([xOf(u), yOf(row + 1)], [xOf(u + 1), yOf(row + 1)]);
          }
          if (index === start || index === goal) {
            const inset = cell * 0.18;
            items.push({
              kind: 'poly',
              pts: [
                [xOf(u) + inset, yOf(row + 1) + inset], [xOf(u + 1) - inset, yOf(row + 1) + inset],
                [xOf(u + 1) - inset, yOf(row) - inset], [xOf(u) + inset, yOf(row) - inset],
              ],
              fill: index === start ? S.startColor : S.goalColor,
            });
            items.push({
              kind: 'text',
              // The painter already sets the middle baseline, so the anchor is
              // the cell's centre and nothing else.
              at: [xOf(u) + cell / 2, yOf(row) - cell / 2],
              text: index === start ? 'S' : 'G',
              size: S.markerTextSize, color: S.markerTextColor, bold: true,
            });
          }
        }
      }
    }
    cursorY = y0 + bandHeight + gap;
  }

  // ---- Bulkheads ----------------------------------------------------------
  const bulkheadCount = mech.layers * 2;
  const bulkheadRadius = circumradius - D.bulkheadInsetMm;
  const bulkheadSpan = 2 * (bulkheadRadius + bulkheadTab);
  const perRow = Math.max(1, Math.floor((usableWidth + gap) / (bulkheadSpan + gap)));
  let placed = 0;
  while (placed < bulkheadCount) {
    ensure(bulkheadSpan + S.labelSize + 2.5 + gap);
    const rowTop = cursorY + S.labelSize + 2.5;
    if (placed === 0) {
      items.push({
        kind: 'text', at: [sheet.margin, cursorY + S.labelSize],
        text: `Bulkheads — cut ${bulkheadCount} (two per ring); the hole takes the ${dowel} mm dowel`,
        size: S.labelSize, color: S.labelColor, align: 'left',
      });
    }
    for (let i = 0; i < perRow && placed < bulkheadCount; i++, placed++) {
      const cx = sheet.margin + bulkheadSpan / 2 + i * (bulkheadSpan + gap);
      const cy = rowTop + bulkheadSpan / 2;
      const pts = polygonPoints([cx, cy], bulkheadRadius, mech.sides);
      const tabs = bulkheadTabQuads(pts, bulkheadTab);
      tabs.forEach((quad, e) => {
        const a = quad[0]!;
        const b = quad[3]!;
        // Open path: the cut line is the outside of the tab only. Closing it
        // along the polygon edge would put a cut mark on a fold.
        for (const [p, q] of [[a, quad[1]!], [quad[1]!, quad[2]!], [quad[2]!, b]] as [Vec2, Vec2][]) {
          items.push({
            kind: 'line', a: p, b: q, stroke: S.glueColor, width: S.glueWidth, dash: S.cutDash,
          });
        }
        items.push({
          kind: 'line', a: pts[e]!, b: pts[(e + 1) % pts.length]!,
          stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash,
        });
      });
      items.push({
        kind: 'poly',
        pts: circlePoly([cx, cy], (dowel + D.dowelClearanceMm) / 2),
        stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
      });
    }
    cursorY = rowTop + bulkheadSpan + gap;
  }
  pushSheet();

  return {
    sheets,
    barrelWidthMm: 2 * circumradius,
    barrelHeightMm: mech.layers * bandHeight,
    cellMm: cell,
    bulkheadCount,
    perfectStates: rate.perfectStates.length,
    stateCount: surface.stateCount,
  };
}
