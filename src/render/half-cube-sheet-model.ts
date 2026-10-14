/**
 * The printed pattern for a ring of half cubes: a sheet of notes, then one
 * sheet a piece.
 *
 * A piece is a solid all of whose faces it keeps, as a prism of the prism
 * ring is, so it is drawn the same way (`piece-net-model.ts`, through
 * `ring-piece-sheet.ts`) — and with one thing a prism never needed. A half
 * cube is not convex: between its three pyramids run three grooves, and a net
 * folded along one of those has to be folded the other way there, which
 * nothing printed would say. So the unfolder is told to keep the paper joined
 * only across edges that fold the one way and are not taped
 * (`NetLayoutOptions.mayFold`); every piece still has such a net, and with it
 * "fold every seam the same way" is true and the tape is named on the cut line.
 *
 * What the notes have to say is the object's own: how a strip of tape goes on
 * (across the two triangles at the edge, which never close on it), what each
 * of the six shapes shows, and that two of each mark are on show in one of
 * them, since no pair of cells on this object is on show one at a time
 * (`pickPrintedEnds`).
 *
 * DOM-free, like everything else that ends in `-model.ts`.
 */

import type { Vec2 } from '../core/vec2.ts';
import type { Face } from '../core/types.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign, PrintedEnds } from '../core/kinetic/maze.ts';
import { isSideOpen, pickPrintedEnds, treeRate } from '../core/kinetic/maze.ts';
import type { HalfCubeRingMechanism } from '../core/kinetic/mechanisms/half-cube-ring.ts';
import { dot, mean, norm, sub } from '../core/vec3.ts';
import type { PageItem } from './face-page-model.ts';
import { buildEdgeIndex } from './edge-index.ts';
import { drawPieceNet } from './piece-net-model.ts';
import {
  bestLayout, hingesByPiece, sameVec, tapeLabels, wrapped,
} from './ring-piece-sheet.ts';
import type { Hinge } from './ring-piece-sheet.ts';
import { SheetFlow, fitCellMm } from './kinetic-sheet-parts.ts';
import { A4_SHEET, STACK_SHEET_DEFAULTS as D, STACK_SHEET_STYLE as S } from './kinetic-sheet-constants.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';

export interface HalfCubeSheetOptions {
  cellMm?: number;
  tabMm?: number;
  gapMm?: number;
  sheet?: SheetBox;
  title?: string;
  /** Where the markers are printed; found from the design when not given. */
  ends?: PrintedEnds;
}

export interface HalfCubeSheetPlan {
  readonly sheets: { items: PageItem[] }[];
  readonly cellMm: number;
  /** One edge of a cube, printed: the side of a square. */
  readonly edgeMm: number;
  /** Hinges that came out inside a net rather than on its cut line. */
  readonly hingesOffBoundary: number;
  /** Creases folded along a groove — the other way from the rest. */
  readonly grooveFolds: number;
  readonly perfectStates: number;
  readonly stateCount: number;
}

/** The two vertices faces `a` and `b` share, if they share an edge. */
function sharedEdge(a: Face, b: Face): Face['vertices'] {
  return a.vertices.filter(v => b.vertices.some(w => sameVec(v, w)));
}

/** Whether the edge between two faces of a piece runs along a groove. */
function isGroove(a: Face, b: Face): boolean {
  return dot(a.normal, sub(mean(b.vertices), a.vertices[0]!)) > 1e-9;
}

/** Whether the edge between two faces is one of this piece's taped edges. */
function isTaped(a: Face, b: Face, hinges: readonly Hinge[]): boolean {
  const shared = sharedEdge(a, b);
  return shared.length === 2 && hinges.some(({ edge }) =>
    shared.some(v => sameVec(v, edge[0])) && shared.some(v => sameVec(v, edge[1])));
}

export function buildHalfCubeSheets(
  mech: HalfCubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: HalfCubeSheetOptions = {},
): HalfCubeSheetPlan {
  const sheet = options.sheet ?? A4_SHEET;
  const tab = options.tabMm ?? D.bulkheadTabMm;
  const gap = options.gapMm ?? D.gapMm;
  const n = mech.cellsPerFace;
  const seams = mech.tapeSeams();
  const hinges = hingesByPiece(seams, mech.pieceCount);

  const usableWidth = sheet.width - 2 * sheet.margin - 2 * tab;
  const usableHeight = sheet.height - 2 * sheet.margin - 2 * tab - S.labelSize - 6;
  const pieces = hinges.map((mine, piece) => {
    const solid = mech.pieceSolid(piece);
    const faces = solid.faces();
    const chosen = bestLayout(
      solid, faces, mine, { width: usableWidth, height: usableHeight },
      (a, b) => !isGroove(a, b) && !isTaped(a, b, mine),
    );
    let grooves = 0;
    for (const key of chosen.layout.layout.foldPairs) {
      const [a, b] = key.split(':').map(Number) as [number, number];
      const fa = chosen.layout.faces[a]!;
      const fb = chosen.layout.faces[b]!;
      if (isGroove(fa, fb)) grooves++;
    }
    return { solid, faces, edgeIndex: buildEdgeIndex(faces), grooves, ...chosen };
  });
  const hingesOffBoundary = pieces.reduce((sum, at) => sum + at.offBoundary, 0);
  const grooveFolds = pieces.reduce((sum, at) => sum + at.grooves, 0);
  // Either every hinge is named on a cut line and every crease folds the one
  // way, or the pattern says something untrue — the prism sheets hold
  // themselves to the first half of this for the same reason.
  if (hingesOffBoundary > 0 || grooveFolds > 0) {
    throw new Error(
      `${hingesOffBoundary} taped edges inside a net and ${grooveFolds} creases along a groove: ` +
        'this piece cannot be printed to be folded one way and taped from its labels',
    );
  }

  // A cell is a cube's edge over n, and every piece is cut from the same cube.
  let edgeUnits = 0;
  for (const face of pieces[0]!.faces) {
    const k = face.vertices.length;
    for (let i = 0; i < k; i++) {
      edgeUnits = Math.max(edgeUnits, norm(sub(face.vertices[(i + 1) % k]!, face.vertices[i]!)));
    }
  }
  const unitsPerCell = edgeUnits / n;
  // As large as a sheet holds, as the prisms are: one piece a sheet, and every
  // millimetre left over is a millimetre off every cell.
  const cellMm = fitCellMm({
    wanted: options.cellMm ?? Infinity,
    unitsPerCell,
    netWidth: Math.max(...pieces.map(at => at.layout.width)),
    netHeight: Math.max(...pieces.map(at => at.layout.height)),
    usableWidth,
    usableHeight,
    n,
    refusal: 'these pieces need',
  });
  const scale = cellMm / unitsPerCell;
  const edgeMm = edgeUnits * scale;

  const rate = treeRate(surface, design);
  const ends = options.ends ?? pickPrintedEnds(surface, design);
  const isOpen = (cellIndex: number, side: number): boolean =>
    isSideOpen(surface, design, cellIndex, side);

  const flow = new SheetFlow(sheet);

  // ---- The notes ----------------------------------------------------------
  flow.title(options.title ?? `Folding maze — ${mech.object.label.toLowerCase()}`);
  flow.notes(wrapped([
    'Print at 100%. Glue the sheets to thin card, then cut.',
    '1. Cut each piece on the dashed outline, round the shaded tabs. Everything written ' +
      'outside that line is cut away — it is there to tell you what to tape to what.',
    '2. Fold along every seam between two faces, all the same way, and glue the tabs inside. ' +
      'Each piece closes into half a cube: three squares round one corner, and six triangles ' +
      'running in to the point where the middle of the cube was.',
    `3. Tape the pieces into a ring in order: piece 1 to piece 2, 2 to 3, and so on round to ` +
      `${mech.pieceCount} and back to 1. The edge to tape is named on each sheet, outside the ` +
      'cut line, and it is always where a square meets a triangle. Hold the two pieces so that ' +
      'the triangles at that edge lie flat side by side, and run the strip along the edge across ' +
      'both triangles, not across the squares: that side of a hinge never closes up, so the ' +
      'strip is never pinched.',
    '4. Nothing else is glued. The tape is the hinge, and the object folds on it.',
    '5. The maze runs from S to G. Each is printed twice: once on a triangle, which is on the ' +
      'outside in every shape but the cube, and once on a square, which is on the outside in the ' +
      'cube. In one of the planks both of each are on the outside: start from either S and ' +
      'finish at either G. Every shape is a perfect maze, so each of those walks has exactly ' +
      'one way. (The web page draws the shortest of them.)',
  ]));
  flow.y += gap / 2;

  flow.label(`One printed pattern, a perfect maze in ${rate.perfect === surface.stateCount
    ? `every one of its ${surface.stateCount} shapes`
    : `${rate.perfect} of its ${surface.stateCount} shapes`}:`);
  const perFace = n * n;
  flow.notes(wrapped(mech.poses.map((pose, state) => {
    const visible = surface.visibleOfState(state);
    let squares = 0;
    let triangles = 0;
    mech.sources.forEach((source, cell) => {
      if (!visible[cell]) return;
      if (source.faceId < 3) squares++;
      else triangles++;
    });
    const twice = ends.start.filter(cell => visible[cell]).length > 1
      || ends.goal.filter(cell => visible[cell]).length > 1;
    const shows = pose.label === 'Cube'
      ? `a cube from outside, ${squares / perFace} squares on show; the triangles line a hollow inside it`
      : pose.label === 'Star'
        ? `a twelve-pointed star, ${triangles / perFace} triangles on show`
        : `${squares / perFace} squares and ${triangles / perFace} triangles on show`;
    return `  ${pose.label}: ${shows}${twice ? ' — two S and two G on show here' : ''}`;
  })));
  flow.notes(wrapped([
    `Cells across a face: ${n}. One edge of a square prints at ${edgeMm.toFixed(0)} mm, ` +
      `one cell at ${cellMm.toFixed(1)} mm.`,
  ]));
  flow.turnPage();

  // ---- One sheet a piece --------------------------------------------------
  pieces.forEach((at, piece) => {
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
      polyhedron: at.solid,
      edgeIndex: at.edgeIndex,
      n,
      scale,
      origin: [originX, originY],
      tabMm: tab,
      cellMm,
      cellIndexOf: (faceId, cell) => {
        try {
          return mech.cellIndex(piece, faceId, cell);
        } catch {
          return undefined;
        }
      },
      isOpen,
      start: ends.start,
      goal: ends.goal,
    }));
    flow.add(...tapeLabels(layout, mine, place));
    flow.y += netHeight + 2 * tab + gap;
  });
  flow.turnPage();

  return {
    sheets: flow.sheets,
    cellMm,
    edgeMm,
    hingesOffBoundary,
    grooveFolds,
    perfectStates: rate.perfect,
    stateCount: surface.stateCount,
  };
}
