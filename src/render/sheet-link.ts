/**
 * The way back from the paper: a QR code for the page a pattern came from.
 *
 * A pattern is cut up, glued and handed on, and nothing on it used to say
 * where it was made or how to get the same maze on a screen again. The first
 * sheet now carries the link to it — the page and the maze, as the page's own
 * Copy URL gives it — as a QR code in its top right corner.
 *
 * It is drawn as boxes, like everything else on a pattern, and not as a
 * picture: the sheets are lists of `PageItem`s in page millimetres, a box
 * prints sharp at whatever size the set is enlarged to, and the whole of it
 * can be built and checked without a browser. A run of dark modules along a
 * row is one box.
 *
 * DOM-free. `qrcode` is asked for the matrix only (`create`); its renderers,
 * which want a canvas, are not touched.
 */

import QRCode from 'qrcode';
import type { Vec2 } from '../core/vec2.ts';
import type { PageItem } from './face-page-model.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import { SHEET_LINK_STYLE as L } from './kinetic-sheet-constants.ts';

export interface SheetLink {
  readonly items: PageItem[];
  /**
   * What has to be left alone: the symbol, the quiet zone a reader needs round
   * it, and the caption under it. It runs to the top and the right edge of
   * the paper, since the margins there are part of the quiet zone.
   */
  readonly keepClear: { readonly left: number; readonly bottom: number };
  /** The symbol alone: its top left corner, its side and its modules a side. */
  readonly symbol: { readonly at: Vec2; readonly sizeMm: number; readonly modules: number };
}

/** The dark modules of the QR code for `url`, row by row, and its size. */
export function linkModules(url: string): { size: number; dark: (row: number, col: number) => boolean } {
  // The library's default, and the usual one for print: a quarter of the
  // symbol may be lost before it stops reading.
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const { size, data } = modules;
  return { size, dark: (row, col) => data[row * size + col] === 1 };
}

/**
 * The QR code for `url` in the top right corner of `sheet`, with its caption.
 *
 * Rows run down the page and columns across it, as the matrix is written: a
 * symbol turned over its diagonal is a mirror image, and a reader need not
 * take one.
 */
export function sheetLink(url: string, sheet: SheetBox): SheetLink {
  const { size, dark } = linkModules(url);
  const side = L.sizeMm;
  const module = side / size;
  const quiet = L.quietModules * module;
  const x0 = sheet.width - sheet.margin - side;
  const y0 = sheet.margin;

  const items: PageItem[] = [];
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!dark(row, col)) { col++; continue; }
      let end = col;
      while (end < size && dark(row, end)) end++;
      const left = x0 + col * module;
      const right = x0 + end * module;
      const top = y0 + row * module;
      const bottom = top + module;
      items.push({
        kind: 'poly',
        pts: [[left, top], [right, top], [right, bottom], [left, bottom]],
        fill: L.dark, stroke: L.dark, width: L.lapMm,
      });
      col = end;
    }
  }

  const captionAt = y0 + side + quiet + L.captionSize / 2;
  items.push({
    kind: 'text', at: [x0 + side / 2, captionAt], text: L.caption,
    size: L.captionSize, color: L.captionColor,
  });

  return {
    items,
    keepClear: { left: x0 - quiet, bottom: captionAt + L.captionSize },
    symbol: { at: [x0, y0], sizeMm: side, modules: size },
  };
}
