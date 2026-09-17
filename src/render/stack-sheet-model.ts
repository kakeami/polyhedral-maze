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
import { isSideOpen, pickStartGoal, treeRate } from '../core/kinetic/maze.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import {
  STACK_SHEET_STYLE as S,
  STACK_SHEET_DEFAULTS as D,
  A4_SHEET,
} from './kinetic-sheet-constants.ts';
import { SheetFlow, bulkheadItems, turningLine } from './kinetic-sheet-parts.ts';

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
    isSideOpen(surface, design, cellIndex, side);

  const rate = treeRate(surface, design);
  const circumradius = cell * mech.cols / (2 * Math.sin(Math.PI / mech.sides));
  const ends = pickStartGoal(surface, design);
  const start = options.start ?? ends.start;
  const goal = options.goal ?? ends.goal;

  const flow = new SheetFlow(sheet);

  // ---- Header and instructions -------------------------------------------
  flow.title(options.title ?? `Stack maze — ${mech.sides}-gon, ${mech.layers} layers`);

  const perfect = rate.perfect;
  const puzzleLine = turningLine(perfect, surface.stateCount, 'the rings');
  const notes = [
    'Print at 100%. Glue the sheet to thin card, then cut.',
    '1. Score each band down the line between the ticks above it and below it — one score a crease.',
    '2. Cut the band out on the dashed outline, round the shaded tab, and fold on every score.',
    `3. Roll the band into a ring and glue the tab inside the far end.`,
    `4. Fold the bulkhead tabs and glue one bulkhead inside each end of every band, flush with the edge.`,
    `5. Thread the ${mech.layers} rings onto a ${dowel} mm dowel. Do not glue them — they have to turn.`,
    '6. Cap the dowel above and below so the rings cannot slide off.',
    puzzleLine,
  ];
  flow.notes(notes);
  flow.y += gap;

  // ---- Bands --------------------------------------------------------------
  //
  // Top ring first, so the bottom one comes out at the bottom of the page and
  // the sheet stands the same way up as the finished object.
  for (let printed = 0; printed < mech.layers; printed++) {
    const layer = mech.layers - 1 - printed;
    const blockHeight = bandHeight + S.labelSize + 2.5;
    flow.ensure(blockHeight + gap);
    const x0 = sheet.margin;
    const role =
      layer === 0 ? 'bottom' : layer === mech.layers - 1 ? 'top' : `${layer + 1} from bottom`;
    flow.label(`Ring ${layer + 1} (${role})`);
    const y0 = flow.y; // top of the band
    const xOf = (u: number) => x0 + u * cell;
    const yOf = (v: number) => y0 + (mech.rows - v) * cell;

    // The glue tab, first so that everything else is drawn over it. A fill and
    // no outline: its silhouette is the cut, and the edge it stands on is the
    // fold, which a single outline could not tell apart.
    const tabTop = y0 + D.tabTaperMm;
    const tabBottom = y0 + bandHeight - D.tabTaperMm;
    flow.add({
      kind: 'poly',
      pts: [
        [xOf(columns), y0], [xOf(columns) + bandTab, tabTop],
        [xOf(columns) + bandTab, tabBottom], [xOf(columns), y0 + bandHeight],
      ],
      fill: S.glueFill,
    });

    // Cut guide, on the band's own three cut sides. The fourth is the fold the
    // tab turns on, and a cut mark there would be an instruction to cut the
    // tab off.
    for (const [a, b] of [
      [[x0, y0], [xOf(columns), y0]],
      [[x0, y0 + bandHeight], [xOf(columns), y0 + bandHeight]],
      [[x0, y0], [x0, y0 + bandHeight]],
    ] as [Vec2, Vec2][]) {
      flow.add({ kind: 'line', a, b, stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash });
    }

    // Where the band creases into the prism's edges, marked by a tick above
    // and below and by nothing in between.
    //
    // A line drawn down the crease would have to cross every passage that
    // crosses it, and a line across an opening reads as a wall — which is why
    // the net PDF of a solid draws no crease at all. A band has no shape of its
    // own to fold by, though, so the two ticks stand in for the line: lay a
    // ruler between them and score, then cut the band out. They sit outside the
    // cut guide, so nothing of them survives onto the finished ring.
    for (let k = 1; k < mech.sides; k++) {
      const x = xOf(k * mech.cols);
      for (const [from, to] of [
        [y0 - S.creaseTickMm, y0],
        [y0 + bandHeight, y0 + bandHeight + S.creaseTickMm],
      ] as [number, number][]) {
        flow.add({
          kind: 'line', a: [x, from], b: [x, to],
          stroke: S.foldColor, width: S.creaseTickWidth,
        });
      }
    }

    // Walls. Every edge of the grid is drawn once: the bottom and left side of
    // each cell, plus the top side of the top row. The band's right edge is the
    // same seam as its left edge once rolled, so it is not drawn twice.
    //
    // A wall on an edge of the prism — the two rims and the vertical creases —
    // is drawn as a rim wall, the weight the net PDF gives the edges of a face,
    // because it is a fold or a cut as well as a wall. On a cut it is inset by
    // half its width so its outer edge lands on the cut guide; on a crease it
    // sits astride the fold, where the paper carries on.
    for (let face = 0; face < mech.sides; face++) {
      for (let col = 0; col < mech.cols; col++) {
        const u = face * mech.cols + col;
        for (let row = 0; row < mech.rows; row++) {
          const index = mech.cellIndex(layer, face, row, col);
          const wall = (a: Vec2, b: Vec2) =>
            flow.add({ kind: 'line', a, b, stroke: S.wallColor, width: S.wallWidth, cap: 'round' });
          const rim = (a: Vec2, b: Vec2) =>
            flow.add({
              kind: 'line', a, b, stroke: S.boundaryColor, width: S.boundaryWidth, cap: 'round',
            });
          const bottomIsRim = row === 0;
          const leftIsRim = col === 0;
          if (!open(index, 0)) {
            const y = bottomIsRim ? yOf(row) - S.boundaryInset : yOf(row);
            (bottomIsRim ? rim : wall)([xOf(u), y], [xOf(u + 1), y]);
          }
          if (!open(index, 3)) {
            // The band's own left edge is a cut; every other crease is a fold.
            const x = u === 0 ? xOf(u) + S.boundaryInset : xOf(u);
            (leftIsRim ? rim : wall)([x, yOf(row)], [x, yOf(row + 1)]);
          }
          if (row === mech.rows - 1 && !open(index, 2)) {
            const y = yOf(row + 1) + S.boundaryInset;
            rim([xOf(u), y], [xOf(u + 1), y]);
          }
          if (index === start || index === goal) {
            const inset = cell * 0.18;
            flow.add({
              kind: 'poly',
              pts: [
                [xOf(u) + inset, yOf(row + 1) + inset], [xOf(u + 1) - inset, yOf(row + 1) + inset],
                [xOf(u + 1) - inset, yOf(row) - inset], [xOf(u) + inset, yOf(row) - inset],
              ],
              fill: index === start ? S.startColor : S.goalColor,
            });
            flow.add({
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
    flow.y = y0 + bandHeight + gap;
  }

  // ---- Bulkheads ----------------------------------------------------------
  const bulkheadCount = mech.layers * 2;
  const bulkheadRadius = circumradius - D.bulkheadInsetMm;
  const bulkheadSpan = 2 * (bulkheadRadius + bulkheadTab);
  const perRow = Math.max(1, Math.floor((usableWidth + gap) / (bulkheadSpan + gap)));
  let placed = 0;
  while (placed < bulkheadCount) {
    flow.ensure(bulkheadSpan + S.labelSize + 2.5 + gap);
    if (placed === 0) {
      flow.label(
        `Bulkheads — cut ${bulkheadCount} (two per ring); the hole takes the ${dowel} mm dowel`,
      );
    } else {
      flow.y += S.labelSize + 2.5;
    }
    const rowTop = flow.y;
    for (let i = 0; i < perRow && placed < bulkheadCount; i++, placed++) {
      const cx = sheet.margin + bulkheadSpan / 2 + i * (bulkheadSpan + gap);
      const cy = rowTop + bulkheadSpan / 2;
      flow.add(...bulkheadItems([cx, cy], bulkheadRadius, mech.sides, bulkheadTab, dowel));
    }
    flow.y = rowTop + bulkheadSpan + gap;
  }
  return {
    sheets: flow.finish(),
    barrelWidthMm: 2 * circumradius,
    barrelHeightMm: mech.layers * bandHeight,
    cellMm: cell,
    bulkheadCount,
    perfectStates: rate.perfect,
    stateCount: surface.stateCount,
  };
}
