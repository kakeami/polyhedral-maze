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
import type { Face, Vec3 } from '../core/types.ts';
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
import { drawPieceNet, layOutPiece } from './piece-net-model.ts';
import type { PieceLayout } from './piece-net-model.ts';
import { SheetFlow, fitCellMm } from './kinetic-sheet-parts.ts';
import { A4_SHEET, STACK_SHEET_DEFAULTS as D, STACK_SHEET_STYLE as S } from './kinetic-sheet-constants.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import {
  FOLD_SHEET_DEFAULTS as FD, FOLD_SHEET_STYLE as F,
} from './fold-sheet-constants.ts';

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

/** One hinge, as the piece it is printed on sees it. */
interface Hinge {
  readonly seam: number;
  /** The piece at the other end of the strip. */
  readonly to: number;
  /** The taped edge, in this piece's body frame. */
  readonly edge: readonly [Vec3, Vec3];
}

const EPS = 1e-7;
const sameVec = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;
const same2 = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/** The hinges of each piece, read off the tape seams. */
function hingesByPiece(seams: readonly TapeSeam[], pieces: number): Hinge[][] {
  const out: Hinge[][] = Array.from({ length: pieces }, () => []);
  for (const seam of seams) {
    const [a, b] = seam.pieces;
    out[a]!.push({ seam: seam.seam, to: b, edge: seam.ends[0] });
    out[b]!.push({ seam: seam.seam, to: a, edge: seam.ends[1] });
  }
  return out;
}

/** Where an edge of the solid comes out in a net, face by face. */
function edgeInNet(
  layout: PieceLayout,
  edge: readonly [Vec3, Vec3],
): { faceId: number; segment: readonly [Vec2, Vec2]; inside: Vec2 }[] {
  const found: { faceId: number; segment: readonly [Vec2, Vec2]; inside: Vec2 }[] = [];
  for (const face of layout.faces) {
    const flat = layout.flatOf.get(face.id);
    if (!flat) continue;
    const k = face.vertices.length;
    for (let i = 0; i < k; i++) {
      const p = face.vertices[i]!;
      const q = face.vertices[(i + 1) % k]!;
      const hit = (sameVec(p, edge[0]) && sameVec(q, edge[1]))
        || (sameVec(p, edge[1]) && sameVec(q, edge[0]));
      if (!hit) continue;
      found.push({
        faceId: face.id,
        segment: [flat[i]!, flat[(i + 1) % k]!],
        inside: centroid2(flat),
      });
    }
  }
  return found;
}

/**
 * Whether an edge is on the cut line of the net rather than inside it.
 *
 * The unfolder lays a tree of faces flat, so an edge whose two faces ended up
 * side by side is a *fold* and its two copies land on the same segment; an
 * edge whose faces went elsewhere has two copies in two places, and both are
 * on the outline.
 */
function onCutLine(places: readonly { segment: readonly [Vec2, Vec2] }[]): boolean {
  if (places.length < 2) return true;
  const [a, b] = [places[0]!.segment, places[1]!.segment];
  const together = (same2(a[0], b[0]) && same2(a[1], b[1]))
    || (same2(a[0], b[1]) && same2(a[1], b[0]));
  return !together;
}

/**
 * The same net, turned a quarter turn.
 *
 * A net is laid out flat with no thought for the paper it is going on, and
 * these come out wider than they are tall while the sheet is taller than it is
 * wide: turning it is worth a quarter of the printed size, which is a quarter
 * off every wall a knife has to follow. Only the geometry turns — which edges
 * fold and which carry a tab are facts about the solid, not about the paper.
 */
function turnLayout(piece: PieceLayout): PieceLayout {
  const across = piece.height;
  const turn = ([x, y]: Vec2): Vec2 => [across - y, x];
  const flatOf = new Map<number, Vec2[]>();
  for (const [id, points] of piece.flatOf) flatOf.set(id, points.map(turn));
  return {
    faces: piece.faces,
    layout: {
      ...piece.layout,
      faces: piece.layout.faces.map(face => ({ ...face, vertices2d: face.vertices2d.map(turn) })),
      width: piece.height,
      height: piece.width,
    },
    netIdOf: piece.netIdOf,
    flatOf,
    width: piece.height,
    height: piece.width,
  };
}

/**
 * The net that suits this piece's hinges best, and then prints biggest.
 *
 * Every rotation of the face list is tried, because the unfolder roots its
 * tree at the first face it is given: turning the list turns the net. Two
 * things are read off each one and in this order — hinges left *inside* the
 * net, which would put a label on the model, and then how squarely the net
 * sits on the sheet, because the piece is printed as large as the sheet allows
 * and a net that wastes a margin costs every cell on it.
 */
function bestLayout(
  solid: ReturnType<typeof pieceSolid>,
  faces: readonly Face[],
  hinges: readonly Hinge[],
  room: { width: number; height: number },
): { layout: PieceLayout; offBoundary: number } {
  let best: { layout: PieceLayout; offBoundary: number; fits: number } | null = null;
  for (let start = 0; start < faces.length; start++) {
    const ordered = [...faces.slice(start), ...faces.slice(0, start)];
    const laid = layOutPiece(solid, ordered);
    let off = 0;
    for (const hinge of hinges) {
      if (!onCutLine(edgeInNet(laid, hinge.edge))) off++;
    }
    for (const layout of [laid, turnLayout(laid)]) {
      const fits = Math.min(room.width / layout.width, room.height / layout.height);
      if (!best || off < best.offBoundary || (off === best.offBoundary && fits > best.fits)) {
        best = { layout, offBoundary: off, fits };
      }
    }
  }
  return { layout: best!.layout, offBoundary: best!.offBoundary };
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
    for (const hinge of mine) {
      // An edge of the solid comes out twice in a net that folds nowhere along
      // it, and both copies are labelled — a builder reads whichever is in
      // front of them. The two labels are pushed to opposite thirds of the
      // edge so that the copies, which meet at a corner of the net, do not
      // write over each other.
      const copies = edgeInNet(layout, hinge.edge);
      copies.forEach((where, copy) => {
        const a = place(where.segment[0]);
        const b = place(where.segment[1]);
        const inside = place(where.inside);
        const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const away = awayFrom(inside, mid);
        const along: Vec2 = [b[0] - a[0], b[1] - a[1]];
        const off = (by: number): [Vec2, Vec2] => [
          [a[0] + away[0] * by, a[1] + away[1] * by],
          [b[0] + away[0] * by, b[1] + away[1] * by],
        ];
        const bar = off(FD.tapeStandMm);
        flow.add({
          kind: 'line', a: bar[0], b: bar[1],
          stroke: F.tapeColor, width: F.tapeWidth, cap: 'round',
        });
        // Both copies of an edge are labelled, and in a star-shaped net they
        // can meet at a corner — so each label goes to whichever end of its
        // own edge is further from the other copy, which pulls them apart
        // exactly when they would have collided.
        const other = copies[1 - copy];
        const at = (fraction: number): Vec2 =>
          [a[0] + along[0] * fraction, a[1] + along[1] * fraction];
        let on = at(0.5);
        if (other) {
          const theirs = place([
            (other.segment[0][0] + other.segment[1][0]) / 2,
            (other.segment[0][1] + other.segment[1][1]) / 2,
          ]);
          const away2 = (point: Vec2): number =>
            Math.hypot(point[0] - theirs[0], point[1] - theirs[1]);
          on = away2(at(0.3)) > away2(at(0.7)) ? at(0.3) : at(0.7);
        }
        const at2: Vec2 = [
          on[0] + away[0] * FD.tapeLabelStandMm, on[1] + away[1] * FD.tapeLabelStandMm,
        ];
        // along the edge, reading left to right
        const angle = -Math.atan2(along[1], along[0]) * (180 / Math.PI);
        flow.add({
          kind: 'text', at: at2, text: `tape to piece ${hinge.to + 1}`,
          size: F.tapeLabelSize, color: F.tapeColor,
          angle: angle > 90 || angle < -90 ? angle + 180 : angle,
        });
      });
    }
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
 * A line of notes, broken to fit the sheet.
 *
 * `SheetFlow.notes` draws what it is given and does not measure it, so a long
 * sentence runs off the right margin and is silently cut. The width here is in
 * characters rather than millimetres because the note face is the one size:
 * ninety-five of them is the sheet's usable width at `noteSize`, measured.
 */
function wrapped(lines: readonly string[], columns = 95): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const indent = line.startsWith('  ') ? '  ' : '';
    const words = line.trim().split(' ');
    let at = indent;
    for (const word of words) {
      if (at.trim() !== '' && (at + ' ' + word).length > columns) {
        out.push(at);
        at = `${indent}${indent === '' ? '   ' : '  '}${word}`;
      } else {
        at = at.trim() === '' ? `${indent}${word}` : `${at} ${word}`;
      }
    }
    out.push(at);
  }
  return out;
}

/** A unit vector from the inside of a face towards a point on its rim. */
function awayFrom(inside: Vec2, at: Vec2): Vec2 {
  const dx = at[0] - inside[0];
  const dy = at[1] - inside[1];
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
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
