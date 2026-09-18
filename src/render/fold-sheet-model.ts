/**
 * The folding maze, as something to cut out: one cube net to a sheet, and a
 * sheet that says how they go together.
 *
 * DOM-free, like `stack-sheet-model.ts`, and it emits the same `PageItem`
 * primitives, so `pdf-face-page-painter.ts` paints it unchanged.
 *
 * Nothing here decides anything about the maze. A side is open or closed by
 * its class, exactly as on screen (`kinetic-geometry.ts`), and this is the
 * same rule applied to paper — which is what keeps the two honest about each
 * other. What it does decide is where the paper is cut, folded and taped.
 *
 * **The net is turned to suit the tape.** A cube has 24 ways of being laid out
 * as one net, and they are not equivalent here: two of the cube's twelve edges
 * are hinges, and an edge that comes out on the *boundary* of the net can be
 * labelled in the margin, where the label is cut away rather than printed on
 * the model. So all 24 are tried and one that puts both hinges on the boundary
 * is taken.
 *
 * **Nothing is written on the model.** Everything inside the cut line is maze.
 * That is why the first sheet draws the object in one of its shapes, from
 * every side that shows each cube in its own place, with its real walls on it:
 * by the time the cubes are built they are identical white cubes with mazes on
 * them, and the only thing that says which is which, and which way up, is the
 * drawing itself.
 */

import type { Vec2 } from '../core/vec2.ts';
import { scale2 } from '../core/vec2.ts';
import type { Vec3 } from '../core/types.ts';
import { add, cross, dot, scale, sub } from '../core/vec3.ts';
import type { PageItem } from './face-page-model.ts';
import { glueTabQuad } from './kinetic-sheet-parts.ts';
import type { SheetBox } from './kinetic-sheet-constants.ts';
import { A4_SHEET } from './kinetic-sheet-constants.ts';
import { FOLD_SHEET_STYLE as S, FOLD_SHEET_DEFAULTS as D } from './fold-sheet-constants.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign, PrintedEnds } from '../core/kinetic/maze.ts';
import { pickPrintedEnds, treeRate } from '../core/kinetic/maze.ts';
import type { CubeRingMechanism, TapeSeam } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { KineticState, Mat3 } from '../core/kinetic/types.ts';
import { applyPlacement } from '../core/kinetic/types.ts';

export interface FoldSheetOptions {
  /** Edge of one cube, in mm. Defaults to the largest the sheet allows. */
  edgeMm?: number;
  tabMm?: number;
  sheet?: SheetBox;
  title?: string;
  /** Where the markers are printed; found from the design if not given. */
  ends?: PrintedEnds;
}

export interface FoldSheet {
  readonly items: PageItem[];
  /** What the sheet is: the assembly notes, or one cube of the ring. */
  readonly piece: number | null;
}

export interface FoldSheetPlan {
  readonly sheets: FoldSheet[];
  readonly edgeMm: number;
  readonly cellMm: number;
  readonly perfectStates: number;
  readonly stateCount: number;
  /** Hinges whose edge did not come out on the boundary of its net. */
  readonly hingesOffBoundary: number;
}

/** Which way a face is drawn: the body directions that map to page right and up. */
interface Frame {
  readonly n: Vec3;
  readonly r: Vec3;
  readonly u: Vec3;
}

type Step = 'up' | 'down' | 'left' | 'right';

/**
 * The Latin cross, as a tree of squares: where each lands and what it hangs
 * off.
 *
 * Of the eleven nets a cube has, this one is chosen for its folds. Four of its
 * five creases run between two notches in the cut outline, so the builder has
 * two points to lay a ruler between and nothing has to be drawn across the
 * maze to say where the crease is — a line there would have to cross every
 * passage that crosses the crease, and a line across an opening reads as a
 * wall. Only the fifth crease, between the two squares at the foot, runs
 * through a straight stretch of outline, and that one gets a tick at each end,
 * which is what `stack-sheet-model.ts` does for a band with no shape of its
 * own to fold by.
 */
const CROSS: readonly { col: number; row: number; from: number; step: Step }[] = [
  // The middle square: laid down as it comes, which is what `from: -1` says.
  { col: 0, row: 0, from: -1, step: 'up' },
  { col: 0, row: 1, from: 0, step: 'up' },
  { col: 0, row: -1, from: 0, step: 'down' },
  { col: 0, row: -2, from: 2, step: 'down' },
  { col: -1, row: 0, from: 0, step: 'left' },
  { col: 1, row: 0, from: 0, step: 'right' },
];

const OPPOSITE: Record<Step, Step> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * The face across one edge of a face, unfolded flat.
 *
 * Going over the top edge of a square, the next square's outward normal is the
 * direction that *was* up, and what is now up on the page is the direction the
 * first square's normal pointed backwards along — the paper turning through a
 * right angle about their shared edge. The other three follow by turning the
 * frame.
 */
function unfold(frame: Frame, step: Step): Frame {
  const { n, r, u } = frame;
  switch (step) {
    case 'up': return { n: u, r, u: scale(n, -1) };
    case 'down': return { n: scale(u, -1), r, u: n };
    case 'left': return { n: scale(r, -1), r: n, u };
    default: return { n: r, r: scale(n, -1), u };
  }
}

/** Face 2a is the +a side of a cube, 2a+1 the -a side: `cubeCells`'s order. */
export function faceNumberOf(normal: Vec3): number {
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(normal[axis]!) > 0.5) return axis * 2 + (normal[axis]! > 0 ? 0 : 1);
  }
  throw new Error(`not a face normal: ${normal.join(',')}`);
}

/** The 24 ways a cube can be laid down: a face to start from, and a turn. */
function everyFrame(): Frame[] {
  const axes: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const frames: Frame[] = [];
  for (const n of axes) {
    for (const candidate of axes) {
      if (Math.abs(dot(n, candidate)) > 0.5) continue;
      frames.push({ n, r: candidate, u: cross(n, candidate) });
    }
  }
  return frames;
}

/** A cube edge, named by its two ends, so that two faces can agree on it. */
function edgeKey(a: Vec3, b: Vec3): string {
  const one = a.map(x => x.toFixed(3)).join(',');
  const two = b.map(x => x.toFixed(3)).join(',');
  return one < two ? `${one}|${two}` : `${two}|${one}`;
}

/** The four corners of a face, in the order right-up, left-up, left-down, right-down. */
function faceCorners(frame: Frame): Vec3[] {
  const half = scale(frame.n, 0.5);
  return [
    add(half, add(scale(frame.r, 0.5), scale(frame.u, 0.5))),
    add(half, add(scale(frame.r, -0.5), scale(frame.u, 0.5))),
    add(half, add(scale(frame.r, -0.5), scale(frame.u, -0.5))),
    add(half, add(scale(frame.r, 0.5), scale(frame.u, -0.5))),
  ];
}

/** The cube edge along one side of a placed face. */
function sideEdge(frame: Frame, step: Step): [Vec3, Vec3] {
  const [ru, lu, ld, rd] = faceCorners(frame) as [Vec3, Vec3, Vec3, Vec3];
  switch (step) {
    case 'up': return [lu, ru];
    case 'down': return [ld, rd];
    case 'left': return [ld, lu];
    default: return [rd, ru];
  }
}

interface PlacedFace {
  readonly index: number;
  readonly frame: Frame;
  readonly col: number;
  readonly row: number;
  /** Which sides have a neighbour in the net — those are the folds. */
  readonly folds: ReadonlySet<Step>;
}

/** Lays the six faces of one cube out as a cross, from a starting frame. */
function layOut(start: Frame): PlacedFace[] {
  const frames: Frame[] = [];
  CROSS.forEach((slot, index) => {
    frames[index] = index === 0 ? start : unfold(frames[slot.from]!, slot.step);
  });
  const neighbours: Set<Step>[] = CROSS.map(() => new Set<Step>());
  CROSS.forEach((slot, index) => {
    if (slot.from < 0) return;
    neighbours[index]!.add(OPPOSITE[slot.step]);
    neighbours[slot.from]!.add(slot.step);
  });
  return CROSS.map((slot, index) => ({
    index,
    frame: frames[index]!,
    col: slot.col,
    row: slot.row,
    folds: neighbours[index]!,
  }));
}

const STEPS: readonly Step[] = ['up', 'down', 'left', 'right'];

/**
 * The net that suits this cube's two hinges best.
 *
 * A hinge on a *cut* edge of the net can be named in the margin, outside the
 * line the knife follows; a hinge that falls on one of the five creases has
 * nowhere to be named but across the maze, so it goes unlabelled and is left
 * to the plank diagrams. Both on the boundary beats one, which beats none, and
 * ties go to the first frame tried, so the choice is settled and repeatable.
 */
function bestLayout(hinges: readonly string[]): PlacedFace[] {
  let best: PlacedFace[] | null = null;
  let bestScore = -1;
  for (const frame of everyFrame()) {
    const faces = layOut(frame);
    const onFold = new Set<string>();
    for (const face of faces) {
      for (const step of face.folds) onFold.add(edgeKey(...sideEdge(face.frame, step)));
    }
    const score = hinges.filter(key => !onFold.has(key)).length;
    if (score > bestScore) {
      bestScore = score;
      best = faces;
    }
    if (bestScore === hinges.length) break;
  }
  if (!best) throw new Error('a cube has no layout, which cannot happen');
  return best;
}

/** One face of a cube, as the net lays it out. */
export interface NetFace {
  /** The cube's own face number, as `cellIndex` numbers them. */
  readonly face: number;
  /** Where the square sits in the cross, in edges from the middle one. */
  readonly col: number;
  readonly row: number;
  /** The body directions that map to page right, page up, and out of the page. */
  readonly right: Vec3;
  readonly up: Vec3;
  readonly normal: Vec3;
  /** Sides with a neighbour in the net: the creases, not the cuts. */
  readonly folds: readonly Step[];
}

/**
 * How one cube of the ring is laid out to be printed.
 *
 * The same answer `buildFoldSheets` draws from, handed over on its own because
 * it is the part that can be checked against the solid: unfold a cube and the
 * squares that end up side by side on the page must be the squares that share
 * an edge on the cube.
 */
export function foldNetFaces(mech: CubeRingMechanism, piece: number): NetFace[] {
  return bestLayout(hingeKeysOf(mech, piece)).map(face => ({
    face: faceNumberOf(face.frame.n),
    col: face.col,
    row: face.row,
    right: face.frame.r,
    up: face.frame.u,
    normal: face.frame.n,
    folds: [...face.folds],
  }));
}

/** The two hinge edges of one cube, in its own frame, keyed as edges are. */
function hingeKeysOf(mech: CubeRingMechanism, piece: number): string[] {
  return mech.tapeSeams()
    .filter(seam => seam.pieces.includes(piece))
    .map(seam => {
      const side = seam.pieces[0] === piece ? 0 : 1;
      return edgeKey(seam.ends[side]![0]!, seam.ends[side]![1]!);
    });
}

export function buildFoldSheets(
  mech: CubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  options: FoldSheetOptions = {},
): FoldSheetPlan {
  const sheet = options.sheet ?? A4_SHEET;
  const tab = options.tabMm ?? D.tabMm;
  const edge = options.edgeMm ?? largestEdge(sheet, tab);
  if (edge < D.minEdgeMm) {
    throw new Error(
      `a cube of ${edge.toFixed(1)} mm is smaller than the ${D.minEdgeMm} mm this can be cut at`,
    );
  }
  const cells = mech.cellsPerFace;
  const ends = options.ends ?? pickPrintedEnds(surface, design);
  const rate = treeRate(surface, design);
  const seams = mech.tapeSeams();

  const sheets: FoldSheet[] = [];
  let offBoundary = 0;

  sheets.push({
    piece: null,
    items: assemblySheet(mech, surface, design, ends, seams, sheet, edge, rate.perfect),
  });

  for (let piece = 0; piece < mech.pieceCount; piece++) {
    const mine = seams.filter(seam => seam.pieces.includes(piece));
    const hinges = hingeKeysOf(mech, piece);
    const faces = bestLayout(hinges);
    const { items, unlabelled } = cubeSheet(
      mech, surface, design, ends, { piece, faces, seams: mine, hinges }, sheet, edge, tab,
    );
    offBoundary += unlabelled;
    sheets.push({ piece, items });
  }

  return {
    sheets,
    edgeMm: edge,
    cellMm: edge / cells,
    perfectStates: rate.perfect,
    stateCount: surface.stateCount,
    hingesOffBoundary: offBoundary,
  };
}

/** The biggest cube whose cross, tabs and header all fit the sheet. */
function largestEdge(sheet: SheetBox, tab: number): number {
  const across = (sheet.width - 2 * sheet.margin - 2 * tab) / 3;
  const down = (sheet.height - 2 * sheet.margin - D.headerMm - 2 * tab) / 4;
  return Math.floor(Math.min(across, down) * 2) / 2;
}

interface CubeLayout {
  readonly piece: number;
  readonly faces: readonly PlacedFace[];
  readonly seams: readonly TapeSeam[];
  /** The hinge edges of this cube, keyed as `edgeKey` keys them. */
  readonly hinges: readonly string[];
}

/**
 * One cube: the net, its tabs, its creases and the marks round the outside.
 *
 * The tab of a pair of cut edges goes on whichever face was laid down later,
 * which on the cross puts all seven on the three outer squares — the flaps a
 * pair of hands folds up last anyway — and leaves the edges beside the two
 * crease ticks clear.
 */
function cubeSheet(
  mech: CubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  ends: PrintedEnds,
  layout: CubeLayout,
  sheet: SheetBox,
  edge: number,
  tab: number,
): { items: PageItem[]; unlabelled: number } {
  const items: PageItem[] = [];
  const { piece, faces } = layout;

  const left = sheet.margin + tab;
  const top = sheet.margin + D.headerMm + tab;
  // The cross is three wide and four tall, with the middle square at its own
  // column and row; page y runs down, net rows run up.
  const centreOf = (face: PlacedFace): Vec2 => [
    left + (face.col + 1.5) * edge,
    top + (1 - face.row + 0.5) * edge,
  ];

  items.push({
    kind: 'text', at: [sheet.margin, sheet.margin + S.titleSize],
    text: `Cube ${piece + 1} of ${mech.pieceCount}`,
    size: S.titleSize, color: S.titleColor, align: 'left', bold: true,
  });
  items.push({
    kind: 'text', at: [sheet.margin, sheet.margin + S.titleSize + 5],
    text:
      `Print at 100%: one cube, ${edge.toFixed(1)} mm on a side. Cut the outline, ` +
      `score every crease, fold, and glue the shaded tabs inside.`,
    size: S.noteSize, color: S.noteColor, align: 'left',
  });

  // Tabs first, so that anything they reach over is drawn on top of them.
  const tabbed = new Set<string>();
  /** Which sides ended up carrying one, so a tape label can clear it. */
  const carriesTab = new Set<string>();
  for (const face of faces) {
    for (const step of STEPS) {
      if (face.folds.has(step)) continue;
      const key = edgeKey(...sideEdge(face.frame, step));
      // Of the two boundary sides that become one cube edge, the second one
      // met carries the tab.
      if (!tabbed.has(key)) {
        tabbed.add(key);
        continue;
      }
      const [a, b] = sidePoints(step, centreOf(face), edge);
      carriesTab.add(`${face.index}:${step}`);
      items.push({
        kind: 'poly',
        pts: glueTabQuad(a, b, tab, tab + D.tabClearanceMm, centreOf(face)),
        fill: S.glueFill,
      });
    }
  }

  // Cut outline: every side of a face with no neighbour in the net.
  for (const face of faces) {
    for (const step of STEPS) {
      if (face.folds.has(step)) continue;
      const [a, b] = sidePoints(step, centreOf(face), edge);
      items.push({ kind: 'line', a, b, stroke: S.cutColor, width: S.cutWidth, dash: S.cutDash });
    }
  }

  // The maze itself.
  const drawn = new Set<string>();
  for (const face of faces) {
    paintFace(items, {
      mech, surface, design, ends, piece,
      frame: face.frame, centre: centreOf(face), edge, drawn,
      cutSides: new Set(STEPS.filter(step => !face.folds.has(step))),
    });
  }

  // Where the tape goes, in the margin beside the edge it goes on.
  let unlabelled = 0;
  for (const seam of layout.seams) {
    const side = seam.pieces[0] === piece ? 0 : 1;
    const other = seam.pieces[side === 0 ? 1 : 0]!;
    const key = edgeKey(seam.ends[side]![0]!, seam.ends[side]![1]!);
    const found = faces.flatMap(face => STEPS
      .filter(step => !face.folds.has(step) && edgeKey(...sideEdge(face.frame, step)) === key)
      .map(step => ({ face, step })));
    if (found.length === 0) {
      unlabelled++;
      continue;
    }
    for (const { face, step } of found) {
      const [a, b] = sidePoints(step, centreOf(face), edge);
      const out = outward(step);
      // Hard against the cut line, where the tape will be: a bar standing off
      // beyond the tabs would meet the bar of the same edge's other half at
      // the corner they share, and read as two hinges rather than one.
      const stand = D.tapeStandMm;
      const bar: [Vec2, Vec2] = [
        [a[0] + out[0] * stand, a[1] + out[1] * stand],
        [b[0] + out[0] * stand, b[1] + out[1] * stand],
      ];
      const away = carriesTab.has(`${face.index}:${step}`)
        ? tab + D.tapeLabelStandMm
        : D.tapeLabelStandMm;
      items.push({
        kind: 'line', a: bar[0], b: bar[1], stroke: S.tapeColor, width: S.tapeWidth,
      });
      const mid: Vec2 = [(bar[0][0] + bar[1][0]) / 2, (bar[0][1] + bar[1][1]) / 2];
      const along = Math.abs(bar[1][0] - bar[0][0]) > Math.abs(bar[1][1] - bar[0][1]);
      items.push({
        kind: 'text',
        at: [mid[0] + out[0] * away, mid[1] + out[1] * away],
        text: `tape to cube ${other + 1}`,
        size: S.tapeLabelSize, color: S.tapeColor,
        angle: along ? 0 : 90,
      });
    }
  }

  // Creases the outline does not already name, as a tick at each end. Last,
  // so that a tick at the end of an edge that also takes tape is drawn over
  // the bar rather than under it.
  for (const face of faces) {
    for (const step of face.folds) {
      if (step === 'down' || step === 'left') continue; // once per pair of faces
      for (const [a, b] of creaseTicks(faces, face, step, centreOf(face), edge)) {
        items.push({ kind: 'line', a, b, stroke: S.foldColor, width: D.tickWidth });
      }
    }
  }

  return { items, unlabelled };
}

/** The two ends of one side of a square, in page mm. */
function sidePoints(step: Step, centre: Vec2, edge: number): [Vec2, Vec2] {
  const half = edge / 2;
  const corners: Record<'ru' | 'lu' | 'ld' | 'rd', Vec2> = {
    ru: [centre[0] + half, centre[1] - half],
    lu: [centre[0] - half, centre[1] - half],
    ld: [centre[0] - half, centre[1] + half],
    rd: [centre[0] + half, centre[1] + half],
  };
  switch (step) {
    case 'up': return [corners.lu, corners.ru];
    case 'down': return [corners.ld, corners.rd];
    case 'left': return [corners.ld, corners.lu];
    default: return [corners.rd, corners.ru];
  }
}

/** Which way is out of the net, on the page, from one side of a face. */
function outward(step: Step): Vec2 {
  switch (step) {
    case 'up': return [0, -1];
    case 'down': return [0, 1];
    case 'left': return [-1, 0];
    default: return [1, 0];
  }
}

/**
 * Ticks for a crease, at whichever of its ends the cut line runs straight past.
 *
 * An end where exactly one of the two squares beyond it is part of the net is
 * a notch in the outline, and the crease runs between two notches: there is
 * nothing to draw, the shape says it. An end with neither square is a point in
 * the middle of a straight cut, which says nothing at all, so a tick stands
 * off it in line with the crease.
 */
function creaseTicks(
  faces: readonly PlacedFace[],
  face: PlacedFace,
  step: Step,
  centre: Vec2,
  edge: number,
): [Vec2, Vec2][] {
  const taken = (col: number, row: number) => faces.some(f => f.col === col && f.row === row);
  const [a, b] = sidePoints(step, centre, edge);
  const vertical = step === 'left' || step === 'right';
  const beside: [[number, number], [number, number]] = vertical
    ? [[0, 1], [0, -1]]
    : [[-1, 0], [1, 0]];
  const near = step === 'up' ? [face.col, face.row + 1]
    : step === 'down' ? [face.col, face.row - 1]
    : step === 'left' ? [face.col - 1, face.row]
    : [face.col + 1, face.row];
  const ticks: [Vec2, Vec2][] = [];
  [a, b].forEach((end, which) => {
    const [dc, dr] = beside[which]!;
    if (taken(face.col + dc, face.row + dr) || taken(near[0]! + dc, near[1]! + dr)) return;
    const away: Vec2 = vertical ? [0, which === 0 ? 1 : -1] : [which === 0 ? -1 : 1, 0];
    ticks.push([end, [end[0] + away[0] * D.tickMm, end[1] + away[1] * D.tickMm]]);
  });
  return ticks;
}

interface FacePaint {
  mech: CubeRingMechanism;
  surface: KineticSurface;
  design: Pick<KineticDesign, 'open'>;
  ends: PrintedEnds | null;
  piece: number;
  frame: Frame;
  centre: Vec2;
  edge: number;
  /** Segments already drawn, so a wall on a crease is not drawn twice. */
  drawn: Set<string>;
  /** Sides of this face that the knife goes along, so the rim is inset there. */
  cutSides: ReadonlySet<Step>;
}

/**
 * One face of one cube, drawn where the page says.
 *
 * Everything is read off the mechanism's own cells and projected with the
 * frame, rather than worked out from row and column arithmetic: a face's rows
 * run along one body axis and its columns along another, the pair of them
 * differs from face to face, and the drawing must not care. Project the
 * corners and the layout comes out right for all six.
 */
function paintFace(items: PageItem[], p: FacePaint): void {
  const { mech, surface, design, frame, centre, edge, drawn } = p;
  const cells = mech.cellsPerFace;
  const face = faceNumberOf(frame.n);
  const project = (v: Vec3): Vec2 => [
    centre[0] + dot(v, frame.r) * edge,
    centre[1] - dot(v, frame.u) * edge,
  ];

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const index = mech.cellIndex(p.piece, face, row, col);
      const cell = mech.cells[index]!;
      const corners = cell.corners.map(project);
      const base = surface.sideStart[index]!;

      for (let side = 0; side < cell.corners.length; side++) {
        const classId = surface.classOf[base + side]!;
        const from = cell.corners[side]!;
        const to = cell.corners[(side + 1) % cell.corners.length]!;
        // A side of the cube, or a side inside the face: told apart by where
        // it lies in the face's own frame, not by which index it has.
        const onEdge = edgeOfFace(frame, from, to);
        if (design.open.has(classId)) continue;

        let a = corners[side]!;
        let b = corners[(side + 1) % corners.length]!;
        if (onEdge && p.cutSides.has(onEdge)) {
          const inset = scale2(outward(onEdge), -S.boundaryInset);
          a = [a[0] + inset[0], a[1] + inset[1]];
          b = [b[0] + inset[0], b[1] + inset[1]];
        }
        const key = segmentKey(a, b);
        if (drawn.has(key)) continue;
        drawn.add(key);
        items.push({
          kind: 'line', a, b,
          stroke: onEdge ? S.boundaryColor : S.wallColor,
          width: onEdge ? S.boundaryWidth : S.wallWidth,
          cap: 'round',
        });
      }

      const marker = p.ends?.start.includes(index) ? 'start'
        : p.ends?.goal.includes(index) ? 'goal'
        : null;
      if (marker) {
        const middle = project(cellCentreOf(cell.corners));
        const half = (edge / cells) * 0.32;
        items.push({
          kind: 'poly',
          pts: [
            [middle[0] - half, middle[1] - half], [middle[0] + half, middle[1] - half],
            [middle[0] + half, middle[1] + half], [middle[0] - half, middle[1] + half],
          ],
          fill: marker === 'start' ? S.startColor : S.goalColor,
        });
        items.push({
          kind: 'text', at: middle, text: marker === 'start' ? 'S' : 'G',
          size: S.markerTextSize, color: S.markerTextColor, bold: true,
        });
      }
    }
  }
}

function cellCentreOf(corners: readonly Vec3[]): Vec3 {
  let sum: Vec3 = [0, 0, 0];
  for (const v of corners) sum = add(sum, v);
  return scale(sum, 1 / corners.length);
}

/** Which side of its face a segment lies on, or null if it is inside it. */
function edgeOfFace(frame: Frame, a: Vec3, b: Vec3): Step | null {
  const ar = dot(a, frame.r);
  const br = dot(b, frame.r);
  const au = dot(a, frame.u);
  const bu = dot(b, frame.u);
  const at = (x: number, y: number, value: number) =>
    Math.abs(x - value) < 1e-9 && Math.abs(y - value) < 1e-9;
  if (at(ar, br, 0.5)) return 'right';
  if (at(ar, br, -0.5)) return 'left';
  if (at(au, bu, 0.5)) return 'up';
  if (at(au, bu, -0.5)) return 'down';
  return null;
}

/** A drawn segment, either way round, to a tenth of a micron. */
function segmentKey(a: Vec2, b: Vec2): string {
  const one = `${Math.round(a[0] * 1e4)},${Math.round(a[1] * 1e4)}`;
  const two = `${Math.round(b[0] * 1e4)},${Math.round(b[1] * 1e4)}`;
  return one < two ? `${one}|${two}` : `${two}|${one}`;
}

/**
 * The sheet that says how the cubes go together.
 *
 * Views of the object in one of its shapes — from above, from below, and from
 * whichever sides have something to add — with the real maze on them and a
 * bar across every edge that takes tape. It has to be the real maze: cubes of
 * the same size with no writing anywhere on them are told apart only by what
 * is printed on them, and which way up each one goes is the same question
 * again.
 *
 * Which shape, which views and what the notes say are all read off the object
 * (`drawnArrangement`), because the objects differ in what a pair of hands can
 * do with them: a ring taped on a plank is laid out and taped where it lies,
 * and one whose every shape presses some hinge into a crack has to be taped in
 * ring order, with the drawing left as something to check against.
 */
function assemblySheet(
  mech: CubeRingMechanism,
  surface: KineticSurface,
  design: KineticDesign,
  ends: PrintedEnds,
  seams: readonly TapeSeam[],
  sheet: SheetBox,
  edge: number,
  perfect: number,
): PageItem[] {
  const items: PageItem[] = [];
  let y = sheet.margin;

  const pieces = mech.pieceCount;
  const shape = drawnArrangement(mech, seams);
  items.push({
    kind: 'text', at: [sheet.margin, y + S.titleSize],
    text: `Folding maze — ${countWord(pieces)} cubes taped into a ring`,
    size: S.titleSize, color: S.titleColor, align: 'left', bold: true,
  });
  y += S.titleSize + 3;

  const axes: { label: string; frame: Frame }[] = [
    { label: 'From above', frame: { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] } },
    { label: 'From below (turned over towards you)', frame: { n: [0, 0, -1], r: [1, 0, 0], u: [0, -1, 0] } },
    { label: 'The near side', frame: { n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] } },
    { label: 'The far side', frame: { n: [0, 1, 0], r: [-1, 0, 0], u: [0, 0, 1] } },
    { label: 'The left side', frame: { n: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] } },
    { label: 'The right side', frame: { n: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1] } },
  ];

  // Measured before anything is drawn, because the shape decides both which
  // views are worth having and how large they can be: a 2 by 6 plank is long
  // and low, a 3 by 4 frame is half as wide and twice as tall, and four of the
  // latter stacked one under another run off the bottom of the sheet.
  const measured = axes.map(view => {
    const spots = shape.cells
      .map((cell, piece) => ({ cell, piece }))
      .filter(({ cell }) => outsideOf(shape.cells, cell, view.frame.n))
      .map(({ cell, piece }) => {
        const centre = add(cell, [0.5, 0.5, 0.5]);
        return { piece, at: [dot(centre, view.frame.r), dot(centre, view.frame.u)] as Vec2 };
      });
    return {
      view,
      spots,
      // Two cubes on the same spot would be a drawing of neither. It happens
      // the moment a shape has a notch or a hole in it: looking along the
      // notch, the cube at the bottom of it stands in front of one of the
      // cubes on the far side.
      oneEach: new Set(spots.map(spot => spot.at.join(','))).size === spots.length,
      // Only worth counting when the tape can go on in this shape at all: a
      // ring taped in order is checked against the drawing rather than built
      // from it, and two views of a flat shape show every cube it has.
      tapes: shape.tapeable
        ? shape.tapes.filter(tape => tape.free && sameWay(tape.normal, view.frame.n))
        : [],
    };
  });

  // From above and from below every cube of a shape one layer thick is in
  // sight, so those two are the drawing; a side is worth a view of its own
  // when it is the only one that can show a strip of tape.
  const kept = measured.filter((shown, index) =>
    shown.spots.length > 0 && shown.oneEach && (index < 2 || shown.tapes.length > 0));
  const seen = kept.length > 0 ? kept : measured.filter(shown => shown.spots.length > 0).slice(0, 1);

  // A strip whose own view is not drawn: it runs down a vertical corner, which
  // is a point rather than a line seen from above, so it is marked as one.
  const dotted = shape.tapes.filter(tape =>
    tape.free && !seen.some(shown => sameWay(tape.normal, shown.view.frame.n)));

  const notes = [
    `Print at 100%. ${capitalise(countWord(pieces))} more sheets follow, one cube each, ` +
      `${edge.toFixed(1)} mm on a side.`,
    'Glue each sheet to thin card, cut the outline, score the creases and glue the cube up.',
    'Four creases run between two notches in the outline; the fifth is marked by a tick at each end.',
    ...tapingNotes(mech, shape, dotted.length > 0),
    shapesSentence(mech, perfect),
    'Two squares carry an S and two carry a G: whichever way it is folded, one of each is outside.',
  ];
  for (const note of notes) {
    items.push({
      kind: 'text', at: [sheet.margin, y + S.noteSize], text: note,
      size: S.noteSize, color: S.noteColor, align: 'left',
    });
    y += S.noteLeading;
  }
  y += 3;

  const plan = packDiagrams(
    seen.map(shown => {
      const across = shown.spots.map(spot => spot.at[0]);
      const up = shown.spots.map(spot => spot.at[1]);
      return {
        wide: Math.max(...across) - Math.min(...across) + 1,
        tall: Math.max(...up) - Math.min(...up) + 1,
      };
    }),
    sheet.width - 2 * sheet.margin,
    sheet.height - sheet.margin - y,
  );
  const small = plan.edge;

  seen.forEach((shown, index) => {
    const { view, spots } = shown;
    const minR = Math.min(...spots.map(spot => spot.at[0]));
    const maxU = Math.max(...spots.map(spot => spot.at[1]));
    const originX = sheet.margin + plan.at[index]![0];
    const top = y + plan.at[index]![1];
    const originY = top + S.diagramLabelSize + 2.5;

    items.push({
      kind: 'text', at: [originX, top + S.diagramLabelSize], text: view.label,
      size: S.diagramLabelSize, color: S.diagramLabelColor, align: 'left',
    });

    const place = (at: Vec2): Vec2 => [
      originX + (at[0] - minR + 0.5) * small,
      originY + (maxU - at[1] + 0.5) * small,
    ];
    const project = (point: Vec3): Vec2 =>
      place([dot(point, view.frame.r), dot(point, view.frame.u)]);

    const drawn = new Set<string>();
    for (const spot of spots) {
      const centre = place(spot.at);
      paintFace(items, {
        mech, surface, design, ends, piece: spot.piece,
        // The cubes are turned in this shape, so which face of a cube looks
        // this way is a question for that cube's own frame.
        frame: inBodyFrame(shape.state[spot.piece]!.rot, view.frame),
        centre, edge: small, drawn,
        cutSides: new Set<Step>(),
      });
      items.push({
        kind: 'text', at: centre, text: String(spot.piece + 1),
        size: S.diagramNumberSize, color: S.diagramNumberColor, bold: true,
      });
    }

    // The tape, where this view can see it — and only when the tape can go on
    // in this shape at all, since a bar drawn where no hand can reach is worse
    // than none.
    if (!shape.tapeable) return;
    for (const tape of shown.tapes) {
      const [a, b] = tape.ends.map(project);
      items.push({ kind: 'line', a: a!, b: b!, stroke: S.tapeColor, width: S.tapeWidth });
    }
    if (index !== 0) return;
    for (const tape of dotted) {
      const middle = project(scale(add(tape.ends[0], tape.ends[1]), 0.5));
      const half = S.tapeWidth;
      items.push({
        kind: 'poly',
        pts: [
          [middle[0] - half, middle[1] - half], [middle[0] + half, middle[1] - half],
          [middle[0] + half, middle[1] + half], [middle[0] - half, middle[1] + half],
        ],
        fill: S.tapeColor,
      });
    }
  });

  return items;
}

/** One strip of tape, where a shape of the object puts it. */
interface Tape {
  readonly seam: TapeSeam;
  /** The taped edge, in the coordinates the shape is drawn in. */
  readonly ends: readonly [Vec3, Vec3];
  /** Which way the strip faces: the two cube faces it is pressed onto. */
  readonly normal: Vec3;
  /** Whether both of those faces are free with the cubes in this shape. */
  readonly free: boolean;
}

/** The cubes as one shape puts them, and where the tape goes on them there. */
interface Arrangement {
  readonly state: KineticState;
  /** Where each cube sits, one lattice cell each. */
  readonly cells: readonly Vec3[];
  readonly tapes: readonly Tape[];
  /** One layer thick: a shape that can be laid on a table and looked down on. */
  readonly flat: boolean;
  /** Whether every strip can be laid on with the cubes in this shape. */
  readonly tapeable: boolean;
}

/**
 * The shape the first sheet draws — chosen for the tape rather than named.
 *
 * The easiest way to build one of these is to lay the cubes out and tape them
 * where they lie, and the layout an object is defined in is usually the shape
 * to do it in. Usually, not always, and the difference is not a matter of
 * taste: a strip has to be pressed onto the two faces that meet at its edge,
 * and a shape can have a third cube lying against one of them. A ring taped on
 * a plank never does. A ring taped round a frame does it twice, and one whose
 * hinges run down the corners of a staircase does it eight times out of ten,
 * so there is no shape at all it can be taped in while lying flat — it is
 * taped in ring order instead, a pair at a time, and the drawing is left as
 * something to check the finished object against.
 *
 * So: the flattest shape that leaves the most tape reachable, the shapes taken
 * in the order the object reports them, which puts the layout first where the
 * layout works.
 */
function drawnArrangement(
  mech: CubeRingMechanism,
  seams: readonly TapeSeam[],
): Arrangement {
  const closures = mech.closures();
  const rank = (shape: Arrangement): number =>
    (shape.flat ? 1000 : 0) + shape.tapes.filter(tape => tape.free).length;
  let best: Arrangement | null = null;
  for (const pose of mech.poses) {
    const made = arrangementAt(seams, closures[pose.closure]!);
    if (!best || rank(made) > rank(best)) best = made;
  }
  return best ?? arrangementAt(seams, closures[0]!);
}

function arrangementAt(seams: readonly TapeSeam[], state: KineticState): Arrangement {
  const cells = state.map(at =>
    at.offset.map(x => Math.round(x - 0.5)) as unknown as Vec3);
  const filled = new Set(cells.map(cell => cell.join(',')));
  const tapes = seams.map((seam): Tape => {
    const [a, b] = seam.pieces;
    const ends = seam.ends[0].map(point => applyPlacement(state[a]!, point)) as [Vec3, Vec3];
    // A strip lies along one edge of the face the two cubes share, so which
    // way it faces is which way that edge is offset from the middle of that
    // face: half a cube along one axis and nothing along the others.
    const middle = scale(add(ends[0], ends[1]), 0.5);
    const shared = scale(add(state[a]!.offset, state[b]!.offset), 0.5);
    const normal = sub(middle, shared).map(x => Math.round(x * 2)) as unknown as Vec3;
    const free = !seam.pieces.some(piece => filled.has(add(cells[piece]!, normal).join(',')));
    return { seam, ends, normal, free };
  });
  const span = [0, 1, 2].map(axis =>
    Math.max(...cells.map(cell => cell[axis]!)) - Math.min(...cells.map(cell => cell[axis]!)));
  return {
    state,
    cells,
    tapes,
    flat: Math.min(...span) === 0,
    tapeable: tapes.every(tape => tape.free),
  };
}

/** How the cubes are taped together, in words, read off the shape drawn. */
function tapingNotes(
  mech: CubeRingMechanism,
  shape: Arrangement,
  dotted: boolean,
): string[] {
  const pieces = mech.pieceCount;
  if (!shape.tapeable) {
    return [
      `Then tape the cubes together in ring order — 1 to 2, 2 to 3, and on round to ${pieces} and 1`,
      '— joining the two edges their own sheets name, on the outside, one strip an edge, slack',
      'enough to fold both ways. This ring cannot be taped lying flat: in every shape it takes,',
      'some of those edges are pressed against a third cube, so each pair is taped before the ring',
      'is closed. The views below are the finished ring in one of its shapes, to check against.',
    ];
  }
  return [
    `Then lay the ${countWord(pieces)} cubes out as the views below show — they are the real`,
    'drawing, so a cube goes where its own pattern is — and hinge them with clear tape along the',
    dotted
      ? 'orange bars and down the corner at each orange dot. Tape on the outside, one strip an edge,'
      : 'orange bars. Tape on the outside, one strip an edge, slack enough to fold both ways.',
    ...(dotted ? ['slack enough to fold both ways.'] : []),
  ];
}

/** Whether two axis directions are the same one. */
const sameWay = (a: Vec3, b: Vec3): boolean =>
  a.every((x, axis) => Math.abs(x - b[axis]!) < 1e-9);

/**
 * A view direction in the frame of one cube: which of its faces looks that
 * way, once the shape has turned it.
 *
 * The rotation of a placement is a signed permutation, so its inverse is its
 * transpose and the answer is exact — which matters, because the face is then
 * chosen by which axis the direction points along.
 */
function inBodyFrame(rot: Mat3, frame: Frame): Frame {
  const back = (v: Vec3): Vec3 => [
    rot[0]![0]! * v[0] + rot[1]![0]! * v[1] + rot[2]![0]! * v[2],
    rot[0]![1]! * v[0] + rot[1]![1]! * v[1] + rot[2]![1]! * v[2],
    rot[0]![2]! * v[0] + rot[1]![2]! * v[1] + rot[2]![2]! * v[2],
  ];
  return { n: back(frame.n), r: back(frame.r), u: back(frame.u) };
}

/**
 * Where the views of the layout go on the first sheet, and how large.
 *
 * Shelved across the width and then down, at the largest size that leaves them
 * all on the sheet — `diagramEdgeMm` being the size they are worth drawing at
 * and never bettered. Both halves of that are the object rather than a
 * setting: the views of a long plank are too wide to sit side by side and fall
 * back into the column they have always been drawn in, while the views of a
 * frame are narrow and tall, pair up across the sheet, and would otherwise run
 * off the bottom of it — at four views of four cells each, a stack is longer
 * than the page whatever is written above it.
 */
function packDiagrams(
  sizes: readonly { wide: number; tall: number }[],
  width: number,
  height: number,
): { edge: number; at: Vec2[] } {
  const header = S.diagramLabelSize + 2.5;
  const shelve = (edge: number): { at: Vec2[]; wide: number; tall: number } => {
    const at: Vec2[] = [];
    let x = 0;
    let top = 0;
    let rowTall = 0;
    let widest = 0;
    for (const size of sizes) {
      if (at.length > 0 && x + size.wide * edge > width) {
        top += header + rowTall * edge + D.gapMm;
        x = 0;
        rowTall = 0;
      }
      at.push([x, top]);
      x += size.wide * edge + D.gapMm;
      widest = Math.max(widest, x - D.gapMm);
      rowTall = Math.max(rowTall, size.tall);
    }
    return { at, wide: widest, tall: top + header + rowTall * edge };
  };

  // Down in quarter millimetres from the size these are drawn at elsewhere:
  // the first that fits is the answer, and for every object whose views are a
  // column that is the first one tried.
  for (let edge = D.diagramEdgeMm; edge > D.minDiagramEdgeMm; edge -= 0.25) {
    const tried = shelve(edge);
    if (tried.wide <= width && tried.tall <= height) return { edge, at: tried.at };
  }
  const floor = shelve(D.minDiagramEdgeMm);
  return { edge: D.minDiagramEdgeMm, at: floor.at };
}

/**
 * What the ring shuts into, in words, read off the poses it reports.
 *
 * The builder is told what the thing does before they build it, and no two
 * objects here do the same: eight cubes give four planks and two cubes, ten
 * give a plank and a frame built two ways round — or sixteen planks and
 * nothing else — and twelve give a frame with a hole through it, a solid
 * block, and one plank or three.
 */
function shapesSentence(mech: CubeRingMechanism, perfect: number): string {
  const kinds = new Map<string, number>();
  for (const pose of mech.poses) {
    const kind = pose.label.split(' ')[0]!.toLowerCase();
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  const parts = [...kinds].map(([kind, count]) =>
    (count === 1 ? `a ${kind}` : `${countWord(count)} ${kind}s`));
  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0] ?? '';
  const total = mech.poses.length;
  return `The ring shuts into ${countWord(total)} shapes: ${list}. ` + (perfect === total
    ? 'Every one is a perfect maze.'
    : `Of them ${perfect} are perfect mazes.`);
}

const NUMBERS = [
  'no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

const countWord = (n: number): string => NUMBERS[n] ?? String(n);

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Whether a cube of a shape has that face on the outside of it. */
function outsideOf(cells: readonly Vec3[], cell: Vec3, normal: Vec3): boolean {
  const beyond = add(cell, normal);
  return !cells.some(other => other.every((x, axis) => x === beyond[axis]));
}

