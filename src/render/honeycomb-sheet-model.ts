/**
 * The printed pattern for a ring of prisms: one sheet a piece, plus the notes.
 *
 * `fold-sheet-model.ts` does this for a ring of cubes, and it knows a great
 * deal about cubes: the 24 nets of one, four views of the object, which
 * squares fall on which. None of that transfers. What does transfer is the
 * thing a *piece* is — a connected set of a solid's faces, unfolded, with the
 * maze on them — and `piece-net-model.ts` already draws that for the two
 * turning mechanisms. A piece of a folding ring is a solid all of whose faces
 * it keeps, so this hands its own piece to that code (`pieceSolid`) and adds
 * the three things a ring needs and a cut solid does not:
 *
 * - **which piece each edge is taped to**, printed outside the cut line so it
 *   is cut away rather than left on the model. A ring is assembled from its
 *   labels: given them, the object is uniquely determined, which is the same
 *   argument the cube sheets rest on.
 * - **the net turned to suit the tape.** An edge that comes out *inside* the
 *   net is a fold, and a label on it would be printed on the model. Every
 *   rotation of the face list is tried and one that brings both hinges out on
 *   the cut line is taken.
 * - **the layout, drawn**, with the pieces numbered and the strips of tape
 *   marked — but only when the layout is flat and every strip can be pressed
 *   on where it lies. A strip needs both of the faces it spans to be free, and
 *   a drawing that showed half of them would be a lie; the notes then say to
 *   tape in ring order by the labels instead.
 *
 * DOM-free, like everything else that ends in `-model.ts`.
 */

import type { Vec2 } from '../core/vec2.ts';
import { centroid2 } from '../core/vec2.ts';
import type { Vec3 } from '../core/types.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign, PrintedEnds } from '../core/kinetic/maze.ts';
import { isSideOpen, pickPrintedEnds, treeRate } from '../core/kinetic/maze.ts';
import { applyPlacement } from '../core/kinetic/types.ts';
import { cartesianOf, pieceSolid } from '../core/kinetic/honeycomb.ts';
import type {
  HoneycombRingMechanism, TapeSeam,
} from '../core/kinetic/mechanisms/honeycomb-ring.ts';
import { norm, sub } from '../core/vec3.ts';
import type { PageItem } from './face-page-model.ts';
import { buildEdgeIndex } from './edge-index.ts';
import { drawPieceNet } from './piece-net-model.ts';
import {
  bestLayout, hingesByPiece, sameVec, tapeLabels, wrapped,
} from './ring-piece-sheet.ts';
import { SheetFlow, fitCellMm } from './kinetic-sheet-parts.ts';
import { A4_SHEET, STACK_SHEET_DEFAULTS as D, STACK_SHEET_STYLE as S } from './kinetic-sheet-constants.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import { FOLD_SHEET_STYLE as F } from './fold-sheet-constants.ts';

export interface HoneycombSheetOptions {
  cellMm?: number;
  tabMm?: number;
  gapMm?: number;
  sheet?: SheetBox;
  title?: string;
  /** Where the markers are printed; found from the design when not given. */
  ends?: PrintedEnds;
}

export interface HoneycombSheetPlan {
  readonly sheets: { items: PageItem[] }[];
  readonly cellMm: number;
  /** One edge of a piece, printed. */
  readonly edgeMm: number;
  /** Hinges that came out inside a net rather than on its cut line. */
  readonly hingesOffBoundary: number;
  /** Whether the layout could be drawn with every strip of tape on it. */
  readonly tapeDrawn: boolean;
  readonly perfectStates: number;
  readonly stateCount: number;
}

/**
 * Whether each strip of tape can be pressed on where the object is laid out.
 *
 * A strip spans the hinge edge and lies on one face of each piece — the face
 * that is *not* the one they are joined at. If a third piece rests against
 * either of those, the strip cannot be reached in that arrangement, however
 * much room the edge itself has.
 */
function tapeReachable(mech: HoneycombRingMechanism): boolean[] {
  const piece = cartesianOf(mech.object.honeycomb);
  const placed = mech.object.ring.map(cell => piece.place(cell));
  const world = (at: number, v: Vec3): Vec3 => applyPlacement(
    { rot: placed[at]!.rot as unknown as Parameters<typeof applyPlacement>[0]['rot'], offset: placed[at]!.offset },
    v,
  );
  const occupied = placed.map(place => applyPlacement(
    { rot: place.rot as unknown as Parameters<typeof applyPlacement>[0]['rot'], offset: place.offset },
    [0, 0, 0],
  ));
  const faces = piece.faces;

  return mech.tapeSeams().map(seam => {
    const [a, b] = seam.pieces;
    return [a, b].every((at, which) => {
      const edge = seam.ends[which]!;
      // the faces of this piece that have the taped edge: one is the join, the
      // other is where the strip lies
      const shared = faces
        .map((loop, index) => ({ loop, index }))
        .filter(({ loop }) => loop.some(v => sameVec(v, edge[0])) && loop.some(v => sameVec(v, edge[1])));
      return shared.some(({ loop, index }) => {
        // the cell across this face: its centre is the piece's centre reflected
        // in the face's plane
        const n = piece.normals[index]!;
        const centre = world(at, [0, 0, 0]);
        const point = world(at, loop[0]!);
        const turned = applyPlacement(
          { rot: placed[at]!.rot as unknown as Parameters<typeof applyPlacement>[0]['rot'], offset: [0, 0, 0] },
          n,
        );
        const depth = turned[0] * (point[0] - centre[0])
          + turned[1] * (point[1] - centre[1])
          + turned[2] * (point[2] - centre[2]);
        const beyond: Vec3 = [
          centre[0] + 2 * depth * turned[0],
          centre[1] + 2 * depth * turned[1],
          centre[2] + 2 * depth * turned[2],
        ];
        return !occupied.some(other => norm(sub(other, beyond)) < 1e-6);
      });
    });
  });
}

export function buildHoneycombSheets(
  mech: HoneycombRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: HoneycombSheetOptions = {},
): HoneycombSheetPlan {
  const sheet = options.sheet ?? A4_SHEET;
  const tab = options.tabMm ?? D.bulkheadTabMm;
  const gap = options.gapMm ?? D.gapMm;
  const solid = pieceSolid(mech.object.honeycomb);
  const faces = solid.faces();
  const edgeIndex = buildEdgeIndex(faces);
  const seams = mech.tapeSeams();
  const hinges = hingesByPiece(seams, mech.pieceCount);

  const usableWidth = sheet.width - 2 * sheet.margin - 2 * tab;
  const usableHeight = sheet.height - 2 * sheet.margin - 2 * tab - S.labelSize - 6;
  const layouts = hinges.map(mine =>
    bestLayout(solid, faces, mine, { width: usableWidth, height: usableHeight }));
  const hingesOffBoundary = layouts.reduce((sum, at) => sum + at.offBoundary, 0);
  // Either every hinge is named on a cut line or the pattern is no use, and
  // the half-way house is the worst of the three: a label on a fold is printed
  // on the finished piece, and a bar left off leaves a builder guessing which
  // edge of a prism to tape. The cube sheets hold themselves to the same rule
  // — draw every strip or say to tape in ring order, never half — and
  // `bestLayout` has already tried every net this piece has.
  if (hingesOffBoundary > 0) {
    throw new Error(
      `${hingesOffBoundary} of the ${seams.length * 2} taped edges come out inside a net, ` +
        `where a label would be printed on the model: this layout cannot be marked`,
    );
  }

  // Net units to millimetres. A cell is one edge of the piece over n — the
  // longest edge, where a piece has more than one length — and every piece is
  // the same solid, so one scale serves all of them.
  let edgeUnits = 0;
  for (const face of faces) {
    const k = face.vertices.length;
    for (let i = 0; i < k; i++) {
      edgeUnits = Math.max(edgeUnits, norm(sub(face.vertices[(i + 1) % k]!, face.vertices[i]!)));
    }
  }
  const unitsPerCell = edgeUnits / mech.cellsPerFace;
  // As large as the sheet allows, rather than a wanted cell size: a sheet holds
  // one piece and nothing about this object is threaded on a dowel, so there is
  // no fixed length to print to and every millimetre left over is a millimetre
  // off every cell. The ring of cubes does the same thing by fiat — 58 mm a
  // cube, because a sheet holds one.
  const cellMm = fitCellMm({
    wanted: options.cellMm ?? Infinity,
    unitsPerCell,
    netWidth: Math.max(...layouts.map(at => at.layout.width)),
    netHeight: Math.max(...layouts.map(at => at.layout.height)),
    usableWidth,
    usableHeight,
    n: mech.cellsPerFace,
    refusal: 'these pieces need',
  });
  const scale = cellMm / unitsPerCell;
  const edgeMm = edgeUnits * scale;

  const rate = treeRate(surface, design);
  const ends = options.ends ?? pickPrintedEnds(surface, design);
  const cellIndexOf = (piece: number) => (faceId: number, cell: string): number | undefined => {
    try {
      return mech.cellIndex(piece, faceId, cell);
    } catch {
      return undefined;
    }
  };
  const isOpen = (cellIndex: number, side: number): boolean =>
    isSideOpen(surface, design, cellIndex, side);

  const reachable = tapeReachable(mech);
  const flat = mech.poses.some(pose => pose.thickness === 1 && pose.closure === 0);
  const tapeDrawn = flat && reachable.every(Boolean);

  const flow = new SheetFlow(sheet);

  // ---- The notes ----------------------------------------------------------
  flow.title(options.title ?? `Folding maze — ${mech.object.label.toLowerCase()}`);
  flow.notes(wrapped([
    'Print at 100%. Glue the sheets to thin card, then cut.',
    `1. Cut each piece on the dashed outline, round the shaded tabs. Everything written ` +
      `outside that line is cut away — it is there to tell you what to tape to what.`,
    '2. Fold along every seam between two faces, all one way, and glue the tabs inside. ' +
      `Each piece closes into one ${solid.faces().length === 8 ? 'hexagonal prism' : 'prism'}.`,
    tapeDrawn
      ? '3. Lay the pieces out as drawn below and tape along each orange bar, one strip a bar. ' +
        'A bar drawn as a dot stands on an upright edge: tape down that corner.'
      : '3. Tape the pieces together in ring order, one pair at a time: piece 1 to piece 2, ' +
        '2 to 3, and so on round to the last and back to piece 1. Each sheet names the ' +
        'piece its taped edges belong to.',
    '4. Nothing else is glued. The tape is the hinge, and the object folds on it.',
    `5. The maze runs from S to G. Each is printed twice, on two cells that are never both ` +
      `on the outside — whichever of the pair you can see is the one in play.`,
  ]));
  flow.y += gap / 2;

  flow.label(`One printed pattern, a perfect maze in ${rate.perfect === surface.stateCount
    ? `every one of its ${surface.stateCount} shapes`
    : `${rate.perfect} of its ${surface.stateCount} shapes`}:`);
  flow.notes(wrapped(mech.poses.map(pose =>
    `  ${pose.label}: ${pose.genus > 0 ? 'a ring with a hole through it' : `${pose.thickness} layer${pose.thickness === 1 ? '' : 's'}`}` +
    `, ${pose.exposed} faces on show${pose.tapePinched ? ', one strip of tape pinched' : ''}`)));
  flow.notes(wrapped([
    `Cells across a face: ${mech.cellsPerFace}. One edge of a piece prints at ` +
      `${edgeMm.toFixed(0)} mm, one cell at ${cellMm.toFixed(1)} mm.`,
  ]));

  if (tapeDrawn) {
    flow.y += gap / 2;
    flow.label('Lay them out like this, and tape the bars:');
    const drawing = layoutDrawing(mech, seams, sheet, flow.y, usableWidth);
    flow.ensure(drawing.height);
    flow.add(...drawing.items);
    flow.y += drawing.height;
  }
  flow.turnPage();

  // ---- One sheet a piece --------------------------------------------------
  layouts.forEach((at, piece) => {
    const { layout } = at;
    const netWidth = layout.width * scale;
    const netHeight = layout.height * scale;
    const mine = hinges[piece]!;
    flow.ensure(netHeight + 2 * tab + S.labelSize + 2.5);
    flow.label(
      `Piece ${piece + 1} of ${mech.pieceCount} — taped to ` +
      `${mine.map(hinge => `piece ${hinge.to + 1}`).join(' and ')}`,
    );

    const originX = sheet.margin + tab + Math.max(0, (usableWidth - netWidth) / 2);
    const originY = flow.y + tab;
    const place = ([x, y]: Vec2): Vec2 =>
      [originX + x * scale, originY + (layout.height - y) * scale];

    flow.add(...drawPieceNet({
      piece: layout,
      polyhedron: solid,
      edgeIndex,
      n: mech.cellsPerFace,
      scale,
      origin: [originX, originY],
      tabMm: tab,
      cellMm,
      cellIndexOf: cellIndexOf(piece),
      isOpen,
      start: ends.start,
      goal: ends.goal,
    }));

    // the tape bars and their labels, outside the cut line
    flow.add(...tapeLabels(layout, mine, place));
    flow.y += netHeight + 2 * tab + gap;
  });
  flow.turnPage();

  return {
    sheets: flow.sheets,
    cellMm,
    edgeMm,
    hingesOffBoundary,
    tapeDrawn,
    perfectStates: rate.perfect,
    stateCount: surface.stateCount,
  };
}

/**
 * The layout, seen from above, with the pieces numbered and the tape marked.
 *
 * Only ever drawn for a flat arrangement, which is the one case where a single
 * view shows every piece — and the only case this is called in.
 */
function layoutDrawing(
  mech: HoneycombRingMechanism,
  seams: readonly TapeSeam[],
  sheet: SheetBox,
  top: number,
  usableWidth: number,
): { items: PageItem[]; height: number } {
  const piece = cartesianOf(mech.object.honeycomb);
  const placed = mech.object.ring.map(cell => {
    const at = piece.place(cell);
    return { rot: at.rot as unknown as Parameters<typeof applyPlacement>[0]['rot'], offset: at.offset };
  });

  // The face that looks up, per piece: its outline is the piece's footprint.
  const upward = piece.normals.reduce((best, n, index) =>
    (n[2] > piece.normals[best]![2] ? index : best), 0);
  const footprints = placed.map(at =>
    piece.faces[upward]!.map(v => {
      const world = applyPlacement(at, v);
      return [world[0], world[1]] as Vec2;
    }));
  const strips = seams.map(seam => ({
    seam: seam.seam,
    ends: seam.ends[0].map(v => {
      const world = applyPlacement(placed[seam.pieces[0]]!, v);
      return [world[0], world[1]] as Vec2;
    }) as [Vec2, Vec2],
  }));

  const points = footprints.flat();
  const lo = [0, 1].map(i => Math.min(...points.map(p => p[i]!)));
  const hi = [0, 1].map(i => Math.max(...points.map(p => p[i]!)));
  const span = [hi[0]! - lo[0]!, hi[1]! - lo[1]!];
  const width = Math.min(usableWidth, 130);
  const scale = Math.min(width / (span[0] || 1), 90 / (span[1] || 1));
  const height = span[1]! * scale;
  const originX = sheet.margin + Math.max(0, (usableWidth - span[0]! * scale) / 2);
  const to = ([x, y]: Vec2): Vec2 =>
    [originX + (x - lo[0]!) * scale, top + (hi[1]! - y) * scale];

  const items: PageItem[] = [];
  footprints.forEach((outline, index) => {
    const pts = outline.map(to);
    items.push({ kind: 'poly', pts, fill: S.paperColor, stroke: S.cutColor, width: S.cutWidth });
    items.push({
      kind: 'text', at: centroid2(pts), text: String(index + 1),
      size: S.labelSize, color: S.labelColor,
    });
  });
  for (const strip of strips) {
    const a = to(strip.ends[0]);
    const b = to(strip.ends[1]);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5) {
      items.push({ kind: 'line', a, b, stroke: F.tapeColor, width: F.tapeWidth, cap: 'round' });
    } else {
      // an upright edge is a point from above: a dot, as the cube sheets draw it
      const r = F.tapeWidth;
      items.push({
        kind: 'poly',
        pts: Array.from({ length: 10 }, (_unused, k) => {
          const angle = (k / 10) * 2 * Math.PI;
          return [a[0] + r * Math.cos(angle), a[1] + r * Math.sin(angle)] as Vec2;
        }),
        fill: F.tapeColor,
      });
    }
  }
  return { items, height };
}
