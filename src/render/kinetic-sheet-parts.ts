/**
 * The parts every turning-maze pattern is made of: the page flow, the shapes
 * that are not maze, and the sentence that says how many ways round there are.
 *
 * DOM-free like the models that use it. Three patterns — the rings, the glued
 * pair and the cut solid — put different objects on paper, but they put them
 * there the same way: a title, a list of steps, then blocks laid down the page
 * one after another, each moved to a fresh sheet whole rather than split. The
 * bulkheads and the retaining discs are the same drawing in all three, because
 * they are the same part: a polygon with tabs and a hole for the dowel.
 */

import type { Vec2 } from '../core/vec2.ts';
import { centroid2 } from '../core/vec2.ts';
import type { PageItem } from './face-page-model.ts';
// Which way is out of a piece is decided by the same helper the printed faces
// of a solid use, never by the order a polygon's points happen to come in.
import { offsetOutward } from './face-page-model.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import {
  STACK_SHEET_STYLE as S,
  STACK_SHEET_DEFAULTS as D,
} from './kinetic-sheet-constants.ts';

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
 * One bulkhead: the polygon of the opening it closes, its glue tabs, and the
 * hole for the dowel.
 *
 * The tabs are filled and not outlined, because a tab's own silhouette is what
 * the knife follows and the edge it stands on is a fold rather than a cut. The
 * hole is drawn with the dowel's clearance so the piece turns on the dowel
 * rather than gripping it.
 */
export function bulkheadItems(
  centre: Vec2, radiusMm: number, sides: number, tabMm: number, dowelMm: number,
): PageItem[] {
  const points = polygonPoints(centre, radiusMm, sides);
  const items: PageItem[] = [];
  for (const quad of bulkheadTabQuads(points, tabMm)) {
    items.push({ kind: 'poly', pts: quad, fill: S.glueFill });
  }
  for (let e = 0; e < points.length; e++) {
    items.push({
      kind: 'line', a: points[e]!, b: points[(e + 1) % points.length]!,
      stroke: S.foldColor, width: S.foldWidth, dash: S.foldDash,
    });
  }
  items.push({
    kind: 'poly', pts: circlePoly(centre, (dowelMm + D.dowelClearanceMm) / 2),
    stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
  });
  return items;
}

/**
 * One retaining disc: the disc and its hole.
 *
 * The hole gets no clearance, unlike a bulkhead's — of the two discs at a
 * joint, one is glued to the dowel and the other turns against a bulkhead.
 */
export function discItems(centre: Vec2, radiusMm: number, dowelMm: number): PageItem[] {
  return [
    {
      kind: 'poly', pts: circlePoly(centre, radiusMm),
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    },
    {
      kind: 'poly', pts: circlePoly(centre, dowelMm / 2),
      stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash,
    },
  ];
}

/**
 * What the pattern tells the solver about the object as a whole.
 *
 * `what` names the things that turn — the rings, the halves, the pieces — and
 * is the only part of the sentence an object gets to choose.
 */
export function turningLine(perfect: number, states: number, what: string): string {
  return perfect === states
    ? `Every one of the ${states} ways to turn ${what} is a perfect maze.`
    : `${perfect} of the ${states} ways to turn ${what} make a perfect maze — find one.`;
}

/**
 * The scale a net is printed at: the asked-for cell, or as much of it as the
 * sheet will take.
 *
 * `refusal` names what did not fit — "this net", "these pieces" — with the
 * verb, because the message is advice and has to say what to make smaller.
 * Below the size a knife can follow there is no pattern worth printing, so it
 * refuses and names a ruling that would fit.
 */
export function fitCellMm(opts: {
  wanted: number;
  unitsPerCell: number;
  netWidth: number;
  netHeight: number;
  usableWidth: number;
  usableHeight: number;
  n: number;
  refusal: string;
}): number {
  const fits = Math.min(
    opts.usableWidth / (opts.netWidth / opts.unitsPerCell),
    opts.usableHeight / (opts.netHeight / opts.unitsPerCell),
  );
  const cellMm = Math.min(opts.wanted, fits);
  if (cellMm < D.minCellMm) {
    const maxN = Math.max(1, Math.floor(opts.n * (cellMm / D.minCellMm)));
    throw new Error(
      `${opts.refusal} cells of ${cellMm.toFixed(1)} mm to fit the sheet, under the ` +
        `${D.minCellMm} mm a knife can follow; try n of ${maxN} or fewer`,
    );
  }
  return cellMm;
}

/**
 * Blocks laid down a page, and onto the next page when one runs out.
 *
 * A block is never split across sheets: `ensure` asks for the room a whole
 * block needs, and says whether it had to turn the page — which is how a
 * heading knows to repeat itself at the top of the new one.
 */
export class SheetFlow {
  readonly sheets: { items: PageItem[] }[] = [];
  private current: PageItem[] = [];
  /** Where the next block starts, in page millimetres from the top. */
  y: number;

  constructor(readonly sheet: SheetBox) {
    this.y = sheet.margin;
  }

  add(...items: PageItem[]): void {
    this.current.push(...items);
  }

  /** Start a fresh sheet. A sheet with nothing on it is not kept. */
  turnPage(): boolean {
    if (this.current.length === 0) {
      this.y = this.sheet.margin;
      return false;
    }
    this.sheets.push({ items: this.current });
    this.current = [];
    this.y = this.sheet.margin;
    return true;
  }

  /** Make room for a block `height` mm tall; true if that meant a new sheet. */
  ensure(height: number): boolean {
    if (this.y > this.sheet.margin && this.y + height > this.sheet.height - this.sheet.margin) {
      return this.turnPage();
    }
    return false;
  }

  title(text: string): void {
    this.add({
      kind: 'text', at: [this.sheet.margin, this.y + S.titleSize], text,
      size: S.titleSize, color: S.titleColor, align: 'left', bold: true,
    });
    this.y += S.titleSize + 2.5;
  }

  notes(lines: readonly string[]): void {
    for (const text of lines) {
      this.add({
        kind: 'text', at: [this.sheet.margin, this.y + S.noteSize], text,
        size: S.noteSize, color: S.noteColor, align: 'left',
      });
      this.y += S.noteLeading;
    }
  }

  /** A heading over the block that follows, at the left margin unless moved. */
  label(text: string, x: number = this.sheet.margin): void {
    this.add({
      kind: 'text', at: [x, this.y + S.labelSize], text,
      size: S.labelSize, color: S.labelColor, align: 'left',
    });
    this.y += S.labelSize + 2.5;
  }

  /** The sheets, with whatever is on the page now as the last of them. */
  finish(): { items: PageItem[] }[] {
    this.turnPage();
    return this.sheets;
  }
}
