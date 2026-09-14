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
import { centroid2 } from '../core/vec2.ts';
import type { PageItem } from './face-page-model.ts';
// Which way is out of a piece is decided by the same helper the printed faces
// of a solid use, never by the order a polygon's points happen to come in.
import { offsetOutward } from './face-page-model.ts';
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

export function circlePoly(center: Vec2, radius: number, segments = 40): Vec2[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * TAU;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)] as Vec2;
  });
}

/** Regular polygon with a flat side at the bottom, centred on `center`. */
export function polygonPoints(center: Vec2, circumradius: number, sides: number): Vec2[] {
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
  const inside = centroid2(points);
  return points.map((a, i) => {
    const b = points[(i + 1) % sides]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const taper = Math.min(tabHeight / Math.tan(interiorAngle / 2) + clearance, len / 2.5);
    return glueTabQuad(a, b, tabHeight, taper, inside);
  });
}

/**
 * A tapered tab standing off the edge a->b, on the far side from `inside`.
 *
 * Which side is out is settled by `inside` and never by the order the points
 * come in, because the callers do not agree on it: a bulkhead is a polygon
 * generated right here, a half of a glued pair is a face handed over by the
 * net unfolder and then flipped into page coordinates, which reverses its
 * winding. A tab that reads the winding is a tab that stands outside one of
 * them and folds into the maze on the other.
 */
export function glueTabQuad(
  a: Vec2, b: Vec2, height: number, taper: number, inside: Vec2,
): Vec2[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const [oa, ob] = offsetOutward(a, b, inside, height);
  return [
    a,
    [oa[0] + ux * taper, oa[1] + uy * taper],
    [ob[0] - ux * taper, ob[1] - uy * taper],
    b,
  ];
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
    '1. Score each band down the line between the ticks above it and below it — one score a crease.',
    '2. Cut the band out on the dashed outline, round the shaded tab, and fold on every score.',
    `3. Roll the band into a ring and glue the tab inside the far end.`,
    `4. Fold the bulkhead tabs and glue one bulkhead inside each end of every band, flush with the edge.`,
    `5. Thread the ${mech.layers} rings onto a ${dowel} mm dowel. Do not glue them — they have to turn.`,
    '6. Cap the dowel above and below so the rings cannot slide off.',
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
  //
  // Top ring first, so the bottom one comes out at the bottom of the page and
  // the sheet stands the same way up as the finished object.
  for (let printed = 0; printed < mech.layers; printed++) {
    const layer = mech.layers - 1 - printed;
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

    // The glue tab, first so that everything else is drawn over it. A fill and
    // no outline: its silhouette is the cut, and the edge it stands on is the
    // fold, which a single outline could not tell apart.
    const tabTop = y0 + D.tabTaperMm;
    const tabBottom = y0 + bandHeight - D.tabTaperMm;
    items.push({
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
      items.push({ kind: 'line', a, b, stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash });
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
        items.push({
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
            items.push({ kind: 'line', a, b, stroke: S.wallColor, width: S.wallWidth, cap: 'round' });
          const rim = (a: Vec2, b: Vec2) =>
            items.push({
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
      // Filled, not outlined: the tab's own silhouette is what the knife
      // follows, and the edge it stands on is a fold rather than a cut.
      for (const quad of tabs) items.push({ kind: 'poly', pts: quad, fill: S.glueFill });
      for (let e = 0; e < pts.length; e++) {
        items.push({
          kind: 'line', a: pts[e]!, b: pts[(e + 1) % pts.length]!,
          stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash,
        });
      }
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
