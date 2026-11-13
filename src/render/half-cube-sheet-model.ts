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
 * And the notes sheet draws the whole ring, as the cube sheets do: laid out
 * flat as the plank it is defined in, from above and from below and from any
 * side a hinge stands on, with the real maze on every piece, the pieces
 * numbered and every hinge in orange (`layoutViews`). Eight pieces of one
 * shape are told apart, and set the right way up, only by what is printed on
 * them, so it has to be the real maze. A half cube is not convex, so a view
 * is more than one face a piece: a piece shows its square, or the four
 * triangles that run in under where the square would be, and the faces a
 * nearer face covers are left out.
 *
 * DOM-free, like everything else that ends in `-model.ts`.
 */

import type { Vec2 } from '../core/vec2.ts';
import { centroid2 } from '../core/vec2.ts';
import type { Face, Vec3 } from '../core/types.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign, PrintedEnds } from '../core/kinetic/maze.ts';
import { isSideOpen, pickPrintedEnds, treeRate } from '../core/kinetic/maze.ts';
import type { HalfCubeRingMechanism } from '../core/kinetic/mechanisms/half-cube-ring.ts';
import { halfCubeFaces } from '../core/kinetic/mechanisms/half-cube-ring.ts';
import type { TapeSeam } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { KineticState } from '../core/kinetic/types.ts';
import { IDENTITY, applyPlacement } from '../core/kinetic/types.ts';
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
import { FOLD_SHEET_STYLE as F } from './fold-sheet-constants.ts';
import { lyingFlat, packDiagrams } from './fold-sheet-model.ts';

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
  /**
   * The views of the ring drawn on the notes sheet: how many pieces each
   * shows, and the area its faces cover in squares — the same number when no
   * face is drawn over another and none is missing.
   */
  readonly views: readonly { label: string; pieces: number; area: number; squares: number }[];
  /** Hinges drawn on those views, as a bar or a dot: every one of them. */
  readonly hingesDrawn: number;
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
  const views = layoutViews(mech, seams);

  // ---- The notes ----------------------------------------------------------
  flow.title(options.title ?? `Folding maze — ${mech.object.label.toLowerCase()}`);
  flow.notes(wrapped([
    'Print at 100%. Glue the sheets to thin card, then cut.',
    '1. Cut each piece on the dashed outline, round the shaded tabs. Everything written ' +
      'outside that line is cut away — it is there to tell you what to tape to what.',
    '2. Fold along every seam between two faces, all the same way, and glue the tabs inside. ' +
      'Each piece closes into half a cube: three squares round one corner, and six triangles ' +
      'running in to the point where the middle of the cube was.',
    '3. Lay the pieces out as the views at the foot of this sheet show: the ring laid flat, ' +
      'with the real maze on it, so each piece goes where its own pattern is and the right way ' +
      'up. Then tape them together along the orange edges' +
      (views.dots.length > 0 ? ' (an orange dot is an edge standing upright)' : '') +
      `, a pair at a time: piece 1 to piece 2, 2 to 3, and so on round to ${mech.pieceCount} ` +
      'and back to 1. Each sheet also names the edge, outside the cut line, and it is always ' +
      'where a square meets a triangle. Hold the two pieces so that the triangles at that edge ' +
      'lie flat side by side, and run the strip along the edge across both triangles, not ' +
      'across the squares: that side of a hinge never closes up, so the strip is never pinched.',
    '4. Nothing else is glued. The tape is the hinge, and the object folds on it.',
    '5. The maze runs from S to G. Each is printed twice: once on a triangle, which is on the ' +
      'outside in every shape but the cube, and once on a square, which is on the outside in the ' +
      'cube. In one of the planks both of each are on the outside: start from either S and ' +
      'finish at either G. Every shape below is a perfect maze, so each of those walks has ' +
      'exactly one way. (The web page draws the shortest of them.)',
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

  // ---- The ring, laid out -------------------------------------------------
  // Under the notes if it fits there at a size a piece can be matched against,
  // and on a sheet of its own if not, rather than shrunk past that.
  flow.y += gap / 2;
  const heading = 'The ring laid out flat — pieces numbered, hinges in orange:';
  const headingMm = S.labelSize + 2.5;
  const width = sheet.width - 2 * sheet.margin;
  const sizes = views.shown.map(view => ({ wide: view.wide, tall: view.tall }));
  let packed = packDiagrams(sizes, width, sheet.height - sheet.margin - flow.y - headingMm);
  if (!packed.fits || packed.edge < VIEW_EDGE_MIN_MM) {
    flow.turnPage();
    packed = packDiagrams(sizes, width, sheet.height - 2 * sheet.margin - headingMm);
  }
  flow.label(heading);
  flow.add(...drawViews(mech, surface, design, ends, views, packed, sheet.margin, flow.y));
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
    views: views.shown.map(view => ({
      label: view.label,
      pieces: new Set(view.faces.map(face => face.piece)).size,
      area: view.faces.reduce((sum, face) => sum + polygonArea(face.pts), 0),
      squares: view.faces.filter(face => face.face.id < 3).length,
    })),
    hingesDrawn: views.shown.reduce((sum, view) => sum + view.bars.length, 0) + views.dots.length,
  };
}

// ─── the ring, laid out ──────────────────────────────────────────────────

/**
 * The smallest a square may be drawn and still share the notes sheet. The
 * cube sheets go down to `minDiagramEdgeMm` because their notes are short;
 * these are three times as long, and a view squeezed under them would be one
 * nobody can match a piece against, so it goes onto a sheet of its own.
 */
const VIEW_EDGE_MIN_MM = 20;

interface ViewFrame {
  readonly label: string;
  /** Towards the eye. */
  readonly n: Vec3;
  /** Across the drawing, and up it. */
  readonly r: Vec3;
  readonly u: Vec3;
}

/** The views the cube sheets draw, in their order and with their names. */
const VIEW_FRAMES: readonly ViewFrame[] = [
  { label: 'From above', n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] },
  { label: 'From below (turned over towards you)', n: [0, 0, -1], r: [1, 0, 0], u: [0, -1, 0] },
  { label: 'The near side', n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] },
  { label: 'The far side', n: [0, 1, 0], r: [-1, 0, 0], u: [0, 0, 1] },
  { label: 'The left side', n: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] },
  { label: 'The right side', n: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1] },
];

/** One face of one piece as a view sees it. */
interface SeenFace {
  readonly piece: number;
  readonly face: Face;
  /** Its corners in the drawing's own units: one square edge is 1. */
  readonly pts: readonly Vec2[];
}

interface View {
  readonly label: string;
  readonly frame: ViewFrame;
  readonly faces: readonly SeenFace[];
  /** Hinges lying in the face of the ring this view looks at. */
  readonly bars: readonly (readonly [Vec2, Vec2])[];
  readonly minR: number;
  readonly maxU: number;
  readonly wide: number;
  readonly tall: number;
}

interface Views {
  readonly state: KineticState;
  /** Above and below, and a side wherever a hinge stands on it. */
  readonly shown: readonly View[];
  /** Hinges no drawn view has a bar for: upright, so a dot from above. */
  readonly dots: readonly Vec2[];
}

/**
 * The ring laid out flat, as the views of it see it.
 *
 * Laid out the way the ring is defined — the plank its tape goes on in — and
 * turned so its one layer lies on the table (`lyingFlat`), the shape the cube
 * sheets draw for the same eight hinges.
 *
 * A face is in a view if it looks towards the eye and no nearer face covers
 * it. In a view along an axis every face a half cube shows is its square, the
 * whole of the cube's outline, or a triangle over exactly a quarter of it, so
 * a face is covered as soon as the middle of it is: tested at the middle,
 * edges included, against every face in front of it.
 */
function layoutViews(mech: HalfCubeRingMechanism, seams: readonly TapeSeam[]): Views {
  const state = squaresUp(mech, lyingFlat(mech.object.halves.ring.map(cell => ({
    rot: IDENTITY, offset: cell.map(x => x + 0.5) as unknown as Vec3,
  }))));
  const turn = (piece: number, v: Vec3): Vec3 =>
    applyPlacement({ rot: state[piece]!.rot, offset: [0, 0, 0] }, v);
  const placed = mech.kept.flatMap((kept, piece) => halfCubeFaces(kept).map(face => ({
    piece,
    face,
    normal: turn(piece, face.normal),
    world: face.vertices.map(v => applyPlacement(state[piece]!, v)),
  })));
  const everywhere = placed.flatMap(face => face.world);
  const hinges = seams.map(seam =>
    seam.ends[0].map(v => applyPlacement(state[seam.pieces[0]]!, v)) as unknown as [Vec3, Vec3]);

  const all = VIEW_FRAMES.map(frame => {
    const project = (v: Vec3): Vec2 => [dot(v, frame.r), dot(v, frame.u)];
    const facing = placed
      .filter(face => dot(face.normal, frame.n) > 1e-6)
      .map(face => ({
        ...face,
        pts: face.world.map(project),
        depth: dot(mean(face.world), frame.n),
      }));
    const faces: SeenFace[] = facing
      .filter(face => {
        const middle = centroid2(face.pts);
        return !facing.some(nearer => nearer.depth > face.depth + 1e-9 && within(middle, nearer.pts));
      })
      .map(({ piece, face, pts }) => ({ piece, face, pts }));
    // The face of the ring this view looks at: a hinge lying in it, and not
    // end on to the eye, is a bar here.
    const front = Math.max(...everywhere.map(v => dot(v, frame.n)));
    const barred = hinges.flatMap((ends, hinge) => {
      if (!ends.every(v => Math.abs(dot(v, frame.n) - front) < 1e-9)) return [];
      const [a, b] = ends.map(project) as [Vec2, Vec2];
      return Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6 ? [{ hinge, a, b }] : [];
    });
    const pts = faces.flatMap(face => face.pts);
    const rs = pts.map(p => p[0]);
    const us = pts.map(p => p[1]);
    return {
      label: frame.label,
      frame,
      faces,
      barred,
      bars: barred.map(({ a, b }) => [a, b] as const),
      minR: Math.min(...rs),
      maxU: Math.max(...us),
      wide: Math.max(...rs) - Math.min(...rs),
      tall: Math.max(...us) - Math.min(...us),
    };
  });

  // From above and from below every piece of a flat ring is in sight, so those
  // two are the drawing; a side earns a view when a hinge stands on it.
  const shown = all.filter((view, index) => view.faces.length > 0 && (index < 2 || view.bars.length > 0));
  const barred = new Set(shown.flatMap(view => view.barred.map(bar => bar.hinge)));
  const above = VIEW_FRAMES[0]!;
  const dots = hinges
    .filter((_ends, hinge) => !barred.has(hinge))
    .map(ends => {
      const middle = mean([...ends]);
      return [dot(middle, above.r), dot(middle, above.u)] as Vec2;
    });
  return { state, shown, dots };
}

/**
 * The flat ring the side up that shows more squares.
 *
 * Laid flat, the star cube's plank has every kept corner on one side of the
 * layer: from that side each piece is a square of maze, from the other four
 * triangles meeting in a cross. The first view drawn is the one from above,
 * and a square reads as what it is where a cross of triangles does not, so
 * the ring is turned over if need be. Which way up a hand lays it out is no
 * part of the object.
 */
function squaresUp(mech: HalfCubeRingMechanism, state: KineticState): KineticState {
  const facing = (sign: number): number => mech.kept.reduce((count, kept, piece) =>
    count + halfCubeFaces(kept).filter(face => face.id < 3 &&
      sign * applyPlacement({ rot: state[piece]!.rot, offset: [0, 0, 0] }, face.normal)[2] > 0.5).length, 0);
  if (facing(1) >= facing(-1)) return state;
  // A half turn about the drawing's own x axis, back onto cells at the origin.
  const flip = (v: readonly number[]): Vec3 => [v[0]!, -v[1]!, -v[2]!];
  const turned = state.map(at => ({
    rot: [at.rot[0]!, at.rot[1]!.map(x => -x), at.rot[2]!.map(x => -x)] as unknown as KineticState[number]['rot'],
    offset: flip(at.offset),
  }));
  const low = [0, 1, 2].map(axis => Math.min(...turned.map(at => at.offset[axis]!)) - 0.5);
  return turned.map(at => ({
    rot: at.rot,
    offset: at.offset.map((x, axis) => x - low[axis]!) as unknown as Vec3,
  }));
}

/** The views, where `packDiagrams` put them, the real maze on every face. */
function drawViews(
  mech: HalfCubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  ends: PrintedEnds,
  views: Views,
  packed: { edge: number; at: readonly Vec2[] },
  left: number,
  top: number,
): PageItem[] {
  const { state } = views;
  const small = packed.edge;
  const cellsOf = new Map<string, number[]>();
  mech.sources.forEach((source, index) => {
    const key = `${source.piece}/${source.faceId}`;
    const list = cellsOf.get(key);
    if (list) list.push(index);
    else cellsOf.set(key, [index]);
  });

  const paper: PageItem[] = [];
  const marks: PageItem[] = [];
  const walls: PageItem[] = [];
  const rims: PageItem[] = [];
  const letters: PageItem[] = [];
  const labels: PageItem[] = [];
  const numbers: PageItem[] = [];
  const tape: PageItem[] = [];

  views.shown.forEach((view, index) => {
    const originX = left + packed.at[index]![0];
    const headTop = top + packed.at[index]![1];
    const originY = headTop + F.diagramLabelSize + 2.5;
    labels.push({
      kind: 'text', at: [originX, headTop + F.diagramLabelSize], text: view.label,
      size: F.diagramLabelSize, color: F.diagramLabelColor, align: 'left',
    });
    const place = ([r, u]: Vec2): Vec2 =>
      [originX + (r - view.minR) * small, originY + (view.maxU - u) * small];
    const project = (v: Vec3): Vec2 => place([dot(v, view.frame.r), dot(v, view.frame.u)]);
    const drawn = new Set<string>();

    for (const seen of view.faces) {
      paper.push({ kind: 'poly', pts: seen.pts.map(place), fill: F.paperColor });
      for (const cellIndex of cellsOf.get(`${seen.piece}/${seen.face.id}`) ?? []) {
        const corners = mech.cells[cellIndex]!.corners;
        const pts = corners.map(v => project(applyPlacement(state[seen.piece]!, v)));
        const marker = ends.start.includes(cellIndex) ? 'S'
          : ends.goal.includes(cellIndex) ? 'G'
          : null;
        if (marker) {
          marks.push({ kind: 'poly', pts, fill: marker === 'S' ? F.startColor : F.goalColor });
          letters.push({
            kind: 'text', at: centroid2(pts), text: marker,
            size: Math.min(F.markerTextSize, 1.2 * inradius(pts)),
            color: F.markerTextColor, bold: true,
          });
        }
        for (let side = 0; side < corners.length; side++) {
          if (isSideOpen(surface, design, cellIndex, side)) continue;
          const a = pts[side]!;
          const b = pts[(side + 1) % pts.length]!;
          const key = segmentKey(a, b);
          if (drawn.has(key)) continue;
          drawn.add(key);
          // On an edge of its face, a wall is the rim of the piece: heavier,
          // as the cube sheets draw it.
          const rim = onFaceEdge(seen.face, corners[side]!, corners[(side + 1) % corners.length]!);
          (rim ? rims : walls).push({
            kind: 'line', a, b,
            stroke: rim ? F.boundaryColor : F.wallColor,
            width: rim ? F.boundaryWidth : F.wallWidth,
            cap: 'round',
          });
        }
      }
    }

    for (const piece of new Set(view.faces.map(face => face.piece))) {
      numbers.push({
        kind: 'text', at: project(applyPlacement(state[piece]!, [0, 0, 0])), text: String(piece + 1),
        size: F.diagramNumberSize, color: F.diagramNumberColor, bold: true,
      });
    }
    for (const [a, b] of view.bars) {
      tape.push({ kind: 'line', a: place(a), b: place(b), stroke: F.tapeColor, width: F.tapeWidth });
    }
    if (index !== 0) return;
    for (const at of views.dots) {
      const [x, y] = place(at);
      const half = F.tapeWidth;
      tape.push({
        kind: 'poly',
        pts: [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]],
        fill: F.tapeColor,
      });
    }
  });
  // The letters are the puzzle, so they go over everything but the tape.
  return [...labels, ...paper, ...marks, ...walls, ...rims, ...numbers, ...letters, ...tape];
}

/** Whether a point lies in a convex polygon, its edges included. */
function within(p: Vec2, pts: readonly Vec2[]): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const turn = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(turn) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(turn);
    else if (Math.sign(turn) !== sign) return false;
  }
  return true;
}

function polygonArea(pts: readonly Vec2[]): number {
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(twice) / 2;
}

/** Twice the area over the perimeter: how much room a letter has in a cell. */
function inradius(pts: readonly Vec2[]): number {
  let perimeter = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return perimeter > 0 ? (2 * polygonArea(pts)) / perimeter : 0;
}

/** Whether the segment ab lies along one edge of the face. */
function onFaceEdge(face: Face, a: Vec3, b: Vec3): boolean {
  const k = face.vertices.length;
  for (let i = 0; i < k; i++) {
    const p = face.vertices[i]!;
    const q = face.vertices[(i + 1) % k]!;
    if (onSegment(p, q, a) && onSegment(p, q, b)) return true;
  }
  return false;
}

function onSegment(p: Vec3, q: Vec3, x: Vec3): boolean {
  const along = sub(q, p);
  const to = sub(x, p);
  const length = norm(along);
  const t = dot(to, along) / (length * length);
  if (t < -1e-9 || t > 1 + 1e-9) return false;
  const off = sub(to, [along[0] * t, along[1] * t, along[2] * t]);
  return norm(off) < 1e-9;
}

/** A drawn segment, either way round, to a tenth of a micron. */
function segmentKey(a: Vec2, b: Vec2): string {
  const one = `${Math.round(a[0] * 1e4)},${Math.round(a[1] * 1e4)}`;
  const two = `${Math.round(b[0] * 1e4)},${Math.round(b[1] * 1e4)}`;
  return one < two ? `${one}|${two}` : `${two}|${one}`;
}
