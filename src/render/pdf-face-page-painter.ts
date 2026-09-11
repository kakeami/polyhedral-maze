/**
 * Paints the primitives from `face-page-model.ts` onto a jsPDF document.
 *
 * Deliberately free of DOM and of svg2pdf: a face page is nothing but lines,
 * polygons and text, so the whole piece-drawing path can run (and be checked)
 * outside a browser. The one part that does need a DOM — the SVG net on the
 * index sheet — stays in `pdf-face-pages.ts`.
 */

import type { jsPDF } from 'jspdf';
import type { Vec2 } from '../core/vec2.ts';
import type { PageItem } from './face-page-model.ts';
import type { SheetSize } from './pdf-chrome.ts';

const MM_TO_PT = 72 / 25.4;

export interface FaceSheetChrome {
  /** Right of the note line: the maze parameters. */
  info: string;
  footerLeft: string;
  footerRight: string;
}

/**
 * Draws the sheet chrome and every primitive of the pieces on it onto `doc`.
 * Each piece's own title and locator come from its panel, not from here.
 */
export function paintFaceSheet(
  doc: jsPDF, sheet: SheetSize, chrome: FaceSheetChrome, items: PageItem[],
): void {
  drawSheetNote(doc, sheet, chrome);
  paintItems(doc, items);
  drawSheetFooter(doc, sheet, chrome);
}

export function paintItems(doc: jsPDF, items: PageItem[]): void {
  for (const item of items) {
    if (item.kind === 'line') {
      doc.setLineDashPattern(item.dash ? [...item.dash] : [], 0);
      doc.setLineCap(item.cap ?? 'butt');
      doc.setDrawColor(...item.stroke);
      doc.setLineWidth(item.width);
      doc.line(item.a[0], item.a[1], item.b[0], item.b[1]);
      continue;
    }

    if (item.kind === 'poly') {
      if (item.pts.length < 2) continue;
      doc.setLineDashPattern(item.dash ? [...item.dash] : [], 0);
      doc.setLineCap('butt');
      if (item.fill) doc.setFillColor(...item.fill);
      if (item.stroke) doc.setDrawColor(...item.stroke);
      doc.setLineWidth(item.width ?? 0.1);
      const style = item.fill && item.stroke ? 'FD' : item.fill ? 'F' : 'S';
      const deltas = item.pts.slice(1).map((p, i) => {
        const prev = item.pts[i]!;
        return [p[0] - prev[0], p[1] - prev[1]] as [number, number];
      });
      doc.lines(deltas, item.pts[0]![0], item.pts[0]![1], [1, 1], style, true);
      continue;
    }

    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    doc.setFontSize(item.size * MM_TO_PT);
    doc.setTextColor(...item.color);
    drawText(
      doc, item.text, item.at, item.size, item.angle ?? 0, item.align ?? 'center',
      item.underline ? item.color : undefined,
    );
  }

  resetStyle(doc);
}

/**
 * Draws `text` at `at` — centred there, or starting there when `align` is
 * 'left' — rotated by `angle` degrees.
 *
 * jsPDF cannot be asked for this directly: `align: 'center'` and
 * `baseline: 'middle'` shift the anchor along the *page* axes and only then
 * rotate about the shifted point, so a rotated label lands half its own width
 * off perpendicular to the text. On an edge label — offset a few millimetres
 * from the cut line — that is enough to drop a two-digit neighbour id onto
 * the piece it labels. So the baseline origin is placed here instead, in the
 * text's own frame, and jsPDF is asked for no adjustment at all. At `angle` 0
 * this reproduces `align: 'center'` with `baseline: 'middle'` exactly.
 *
 * `underline` rules the text in its own frame as well, so the rule turns with
 * the label and always marks its foot — which is the whole point of it.
 */
function drawText(
  doc: jsPDF, text: string, at: readonly [number, number], size: number, angle: number,
  align: 'left' | 'center',
  underline?: readonly [number, number, number],
): void {
  // Page axes are y-down and `angle` turns counter-clockwise, so the text
  // advances along (cos, -sin) with its ascenders along (-sin, -cos).
  const rad = (angle * Math.PI) / 180;
  const adv: Vec2 = [Math.cos(rad), -Math.sin(rad)];
  const up: Vec2 = [-Math.sin(rad), -Math.cos(rad)];
  // The rise jsPDF's own `baseline: 'middle'` uses, so labels sit at the same
  // height above their anchor whichever way they are turned.
  const rise = size * (1.5 - doc.getLineHeightFactor());
  const width = doc.getTextWidth(text);
  const back = align === 'left' ? 0 : width / 2;

  const ox = at[0] - adv[0] * back - up[0] * rise;
  const oy = at[1] - adv[1] * back - up[1] * rise;
  doc.text(text, ox, oy, { angle });

  if (!underline) return;
  // Kept within the glyph's own descent box, so an underlined label needs no
  // more clearance from the piece than a bare one.
  const drop = size * UNDERLINE_DROP;
  const sx = ox - up[0] * drop, sy = oy - up[1] * drop;
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(...(underline as [number, number, number]));
  doc.setLineWidth(size * UNDERLINE_WIDTH);
  doc.line(sx, sy, sx + adv[0] * width, sy + adv[1] * width);
}

/** Rule offset below the baseline and its weight, in ems of the text size. */
const UNDERLINE_DROP = 0.16;
const UNDERLINE_WIDTH = 0.08;

/**
 * No absolute length is printed on a face sheet — not an edge measurement and
 * not a ruler bar. What matters is that every sheet is enlarged by the *same*
 * factor, so printing the set on A3 to build a bigger model stays valid.
 */
function drawSheetNote(doc: jsPDF, sheet: SheetSize, chrome: FaceSheetChrome): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90);
  doc.text('Print every sheet at the same scale — never sheet by sheet.', 10, 12);
  doc.text(chrome.info, sheet.pageW - 10, 12, { align: 'right' });
  doc.setTextColor(0);
}

function drawSheetFooter(doc: jsPDF, sheet: SheetSize, chrome: FaceSheetChrome): void {
  doc.setFontSize(6.5);
  doc.setTextColor(150);
  doc.text(chrome.footerLeft, 10, sheet.pageH - 4);
  doc.text(chrome.footerRight, sheet.pageW - 10, sheet.pageH - 4, { align: 'right' });
  doc.setTextColor(0);
}

/** Leaves the document in a neutral state for whatever draws next. */
function resetStyle(doc: jsPDF): void {
  doc.setLineDashPattern([], 0);
  doc.setLineCap('butt');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.setDrawColor(0);
}
