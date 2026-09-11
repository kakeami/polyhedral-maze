/**
 * Packs the face pieces onto sheets — several to a sheet — **without touching
 * the shared print scale**.
 *
 * The one-face-per-page layout sizes every page from the *largest* face, so
 * every smaller piece leaves the rest of its sheet blank. Here each piece
 * instead gets a panel only as big as it needs: its footprint at the shared
 * mm-per-unit scale, the ring that holds the edge labels, and a header band
 * for its title and locator. The panels are then shelf-packed onto sheets.
 *
 * Two properties are deliberate, and are what make the denser sheet safe:
 *
 * - **The scale is untouched.** Panels are measured from the scale
 *   `computeFacePageScale` already chose, so the printed pieces are exactly
 *   those the one-per-page layout produced — only the paper under them
 *   changes. The largest face still takes a sheet of its own.
 * - **A panel is a whole page in miniature.** Every panel carries its own
 *   rule, its own title and its own locator diagram, so a piece and the
 *   diagram saying where it belongs can never be read across panels. Pieces
 *   are packed in face-number order and never reordered, which also leaves
 *   each sheet holding a contiguous run of face numbers.
 */

import type { NetLayout } from './net-layout.ts';
import {
  QUARTER_TURN,
  faceFootprint,
  type FacePageScale,
  type FacePlacement,
  type PageGeometry,
  type PageItem,
  type Rect,
} from './face-page-model.ts';
import type { Vec2 } from '../core/vec2.ts';
import { FACE_SHEET_STYLE } from './face-page-constants.ts';

/** One piece's panel on a sheet: a complete page in miniature. */
export interface FramePlacement {
  faceId: number;
  /** How the piece is turned in this panel — pass it to `buildFacePage`. */
  placement: FacePlacement;
  /** The panel's rule — everything below belongs inside it. */
  frame: Rect;
  /** Where the piece is drawn; the ring for edge labels is already inside it. */
  area: Rect;
  /** Locator diagram box, in the panel's header band. */
  locator: Rect;
}

export interface FaceSheet {
  frames: FramePlacement[];
}

/** Strip of a sheet the panels may occupy, between the note line and the footer. */
export function sheetArea(page: PageGeometry): Rect {
  const { pageW, pageH, margin } = page;
  const { noteBand, footerBand } = FACE_SHEET_STYLE;
  return {
    x: margin,
    y: margin + noteBand,
    w: pageW - 2 * margin,
    h: pageH - 2 * margin - noteBand - footerBand,
  };
}

/**
 * Every face laid out on as few sheets as shelf packing manages, at the scale
 * `scale` has already fixed.
 *
 * The header floor is chosen here rather than fixed: each candidate is packed
 * and the most generous one that still uses the fewest sheets wins, so a
 * panel's locator is only ever shrunk to buy paper that is actually saved.
 */
export function packFaceSheets(
  layout: NetLayout, scale: FacePageScale, page: PageGeometry,
): FaceSheet[] {
  let best: FaceSheet[] | null = null;
  for (const headerMin of FACE_SHEET_STYLE.headerMinChoices) {
    const sheets = packWith(layout, scale, page, headerMin);
    if (!best || sheets.length < best.length) best = sheets;
  }
  return best ?? [];
}

function packWith(
  layout: NetLayout, scale: FacePageScale, page: PageGeometry, headerMin: number,
): FaceSheet[] {
  const band = sheetArea(page);
  const faceIds = layout.faces.map(nf => nf.faceId).sort((a, b) => a - b);
  const byId = new Map(layout.faces.map(nf => [nf.faceId, nf]));

  const sheets: FaceSheet[] = [];
  let shelves: Shelf[] = [];
  let frames: FramePlacement[] = [];
  const flush = () => {
    if (frames.length > 0) sheets.push({ frames });
    frames = [];
    shelves = [];
  };

  for (const faceId of faceIds) {
    const netFace = byId.get(faceId)!;
    const { panel, placement } = tightestPanel(
      netFace.vertices2d, scale, faceId, page, band, headerMin,
    );

    let spot = findSpot(shelves, band, panel);
    if (!spot) {
      // Nothing left on this sheet. A panel always fits an empty one: the
      // scale was chosen so that the biggest face fits a whole page.
      flush();
      spot = findSpot(shelves, band, panel) ?? { x: band.x, y: band.y, shelf: null };
    }
    if (spot.shelf) {
      spot.shelf.cursorX = spot.x + panel.w + FACE_SHEET_STYLE.gutter;
      spot.shelf.h = Math.max(spot.shelf.h, panel.h);
    } else {
      shelves.push({
        y: spot.y, h: panel.h, cursorX: band.x + panel.w + FACE_SHEET_STYLE.gutter,
      });
    }
    frames.push(frameAt(faceId, placement, spot.x, spot.y, panel, page));
  }
  flush();

  return sheets;
}

// ─── Packing ──────────────────────────────────────────────────────

/** A panel's outer size, and how much of its height the header takes. */
interface Panel { w: number; h: number; header: number }

/** An open row of panels; only the last one may still grow taller. */
interface Shelf { y: number; h: number; cursorX: number }

/**
 * Where a panel goes: into the first shelf with room for it, or onto a new
 * shelf below the last, or nowhere — meaning the sheet is full.
 */
function findSpot(
  shelves: Shelf[], band: Rect, panel: Panel,
): { x: number; y: number; shelf: Shelf | null } | null {
  for (let i = 0; i < shelves.length; i++) {
    const shelf = shelves[i]!;
    // A shelf with a row beneath it cannot grow: a taller panel placed in it
    // would overlap that row. The last shelf may grow into the free space.
    const roof = i === shelves.length - 1 ? band.y + band.h - shelf.y : shelf.h;
    if (panel.h <= roof + EPS && shelf.cursorX + panel.w <= band.x + band.w + EPS) {
      return { x: shelf.cursorX, y: shelf.y, shelf };
    }
  }
  const last = shelves[shelves.length - 1];
  const y = last ? last.y + last.h + FACE_SHEET_STYLE.gutter : band.y;
  if (y + panel.h > band.y + band.h + EPS) return null;
  return { x: band.x, y, shelf: null };
}

const EPS = 1e-6;

/**
 * Panel size for a footprint: the piece, its label ring, and a header band.
 *
 * The header grows with the panel, so a big piece gets a big locator, and is
 * capped by the height the sheet has left — which is how the largest face,
 * whose piece alone is nearly a whole sheet, still fits one.
 */
function panelSize(
  footprint: readonly [number, number], page: PageGeometry, band: Rect, headerMin: number,
): Panel {
  const S = FACE_SHEET_STYLE;
  const contentW = footprint[0] + 2 * page.ring;
  const contentH = footprint[1] + 2 * page.ring;
  const header = clamp(
    S.headerRatio * contentH, headerMin, Math.min(S.headerMax, band.h - contentH),
  );
  return { w: Math.max(contentW, S.minFrameW), h: contentH + header, header };
}

/**
 * The smallest panel a piece can be given, and the turn that achieves it.
 *
 * A face lies in the net at whatever angle the unfolding left it at, and its
 * upright bounding box can be far larger than the piece itself — a triangle
 * cornerwise takes half again the paper it needs. Turning the piece costs
 * nothing (its printed size is fixed by the scale, and the locator diagram
 * turns with it), so the panel is measured over every orientation in which
 * some edge of the piece lies flat: the minimum-area rectangle around a
 * convex polygon is always flush with one of its edges.
 *
 * Orientations whose panel would not fit a sheet are skipped, and the turn the
 * scale chose is always among the candidates, so the result is never worse
 * than the one-piece-per-page layout.
 */
function tightestPanel(
  vertices2d: Vec2[],
  scale: FacePageScale,
  faceId: number,
  page: PageGeometry,
  band: Rect,
  headerMin: number,
): { panel: Panel; placement: FacePlacement } {
  const fromScale = scale.placements.get(faceId)!;
  let best = {
    panel: panelSize(faceFootprint(vertices2d, fromScale, scale.mmPerUnit), page, band, headerMin),
    placement: fromScale,
  };

  const nv = vertices2d.length;
  for (let i = 0; i < nv; i++) {
    const a = vertices2d[i]!, b = vertices2d[(i + 1) % nv]!;
    const flat = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (const turn of [flat, flat + QUARTER_TURN]) {
      const placement: FacePlacement = { faceId, turn };
      const panel = panelSize(
        faceFootprint(vertices2d, placement, scale.mmPerUnit), page, band, headerMin,
      );
      if (panel.w > band.w + EPS || panel.h > band.h + EPS) continue;
      if (panel.w * panel.h < best.panel.w * best.panel.h - EPS) best = { panel, placement };
    }
  }
  return best;
}

/** Splits a placed panel into its header (title, locator) and its piece area. */
function frameAt(
  faceId: number, placement: FacePlacement,
  x: number, y: number, panel: Panel, page: PageGeometry,
): FramePlacement {
  const S = FACE_SHEET_STYLE;
  const locW = Math.min(S.locatorMaxW, panel.w * S.locatorWidthRatio);
  return {
    faceId,
    placement,
    frame: { x, y, w: panel.w, h: panel.h },
    area: {
      x: x + page.ring,
      y: y + panel.header + page.ring,
      w: panel.w - 2 * page.ring,
      h: panel.h - panel.header - 2 * page.ring,
    },
    locator: {
      x: x + panel.w - S.framePad - locW,
      y: y + S.framePad,
      w: locW,
      h: Math.max(panel.header - 2 * S.framePad, 1),
    },
  };
}

// ─── Panel chrome ─────────────────────────────────────────────────

/**
 * Panel rule and title — the chrome that makes a panel read as its own page.
 * The title sits on the locator's centre line, so title and diagram belong
 * visibly to the same panel however tall its header turned out.
 */
export function frameChromeItems(frame: FramePlacement): PageItem[] {
  const S = FACE_SHEET_STYLE;
  const { x, y, w, h } = frame.frame;
  return [
    {
      kind: 'poly',
      pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]],
      stroke: S.frameColor,
      width: S.frameWidth,
    },
    {
      kind: 'text',
      at: [x + S.framePad + 1, frame.locator.y + frame.locator.h / 2],
      text: `Face ${frame.faceId}`,
      size: clamp(frame.locator.h * S.titleRatio, S.titleMin, S.titleMax),
      color: S.titleColor,
      bold: true,
      align: 'left',
    },
  ];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, Math.max(lo, hi)));
}
