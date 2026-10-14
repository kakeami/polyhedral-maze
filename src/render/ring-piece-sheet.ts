/**
 * What every printed ring of solids shares: a piece's net chosen to suit its
 * tape, and the tape named outside the cut line.
 *
 * A ring is assembled from its labels — given which piece each taped edge goes
 * to, the object is determined — so the two things a sheet has to get right
 * are that every taped edge comes out on the cut line of the net (a label on a
 * fold would be printed on the model) and that both copies of such an edge say
 * where they go. The ring of prisms (`honeycomb-sheet-model.ts`) and the ring
 * of half cubes (`half-cube-sheet-model.ts`) unfold different solids and say
 * different things in their notes, and do this part the same way.
 *
 * DOM-free, like everything else in the sheet models.
 */

import type { Vec2 } from '../core/vec2.ts';
import { centroid2 } from '../core/vec2.ts';
import type { Face, Vec3 } from '../core/types.ts';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { PageItem } from './face-page-model.ts';
import { layOutPiece } from './piece-net-model.ts';
import type { PieceLayout } from './piece-net-model.ts';
import {
  FOLD_SHEET_DEFAULTS as FD, FOLD_SHEET_STYLE as F,
} from './fold-sheet-constants.ts';

/** One strip of tape between two pieces, as the mechanism hands it over. */
export interface RingSeam {
  readonly seam: number;
  readonly pieces: readonly [number, number];
  /** The taped edge in the body frame of `pieces[0]`, then of `pieces[1]`. */
  readonly ends: readonly [readonly [Vec3, Vec3], readonly [Vec3, Vec3]];
}

/** One hinge, as the piece it is printed on sees it. */
export interface Hinge {
  readonly seam: number;
  /** The piece at the other end of the strip. */
  readonly to: number;
  /** The taped edge, in this piece's body frame. */
  readonly edge: readonly [Vec3, Vec3];
}

const EPS = 1e-7;
export const sameVec = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;
const same2 = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/** The hinges of each piece, read off the tape seams. */
export function hingesByPiece(seams: readonly RingSeam[], pieces: number): Hinge[][] {
  const out: Hinge[][] = Array.from({ length: pieces }, () => []);
  for (const seam of seams) {
    const [a, b] = seam.pieces;
    out[a]!.push({ seam: seam.seam, to: b, edge: seam.ends[0] });
    out[b]!.push({ seam: seam.seam, to: a, edge: seam.ends[1] });
  }
  return out;
}

/** Where an edge of the solid comes out in a net, face by face. */
export function edgeInNet(
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
export function onCutLine(places: readonly { segment: readonly [Vec2, Vec2] }[]): boolean {
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
export function turnLayout(piece: PieceLayout): PieceLayout {
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
 *
 * `mayFold` is handed to the unfolder for a piece that needs it (a half cube:
 * see `computeNetLayout`).
 */
export function bestLayout(
  solid: Polyhedron,
  faces: readonly Face[],
  hinges: readonly Hinge[],
  room: { width: number; height: number },
  mayFold?: (a: Face, b: Face) => boolean,
): { layout: PieceLayout; offBoundary: number } {
  let best: { layout: PieceLayout; offBoundary: number; fits: number } | null = null;
  for (let start = 0; start < faces.length; start++) {
    const ordered = [...faces.slice(start), ...faces.slice(0, start)];
    const laid = layOutPiece(solid, ordered, mayFold);
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
 * The tape bars and their labels for one piece, outside its cut line.
 *
 * An edge of the solid comes out twice in a net that folds nowhere along it,
 * and both copies are labelled — a builder reads whichever is in front of
 * them. The two labels are pushed to opposite thirds of the edge so that the
 * copies, which meet at a corner of the net, do not write over each other.
 */
export function tapeLabels(
  layout: PieceLayout,
  hinges: readonly Hinge[],
  place: (point: Vec2) => Vec2,
): PageItem[] {
  const items: PageItem[] = [];
  for (const hinge of hinges) {
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
      items.push({
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
      items.push({
        kind: 'text', at: at2, text: `tape to piece ${hinge.to + 1}`,
        size: F.tapeLabelSize, color: F.tapeColor,
        angle: angle > 90 || angle < -90 ? angle + 180 : angle,
      });
    });
  }
  return items;
}

/**
 * A line of notes, broken to fit the sheet.
 *
 * `SheetFlow.notes` draws what it is given and does not measure it, so a long
 * sentence runs off the right margin and is silently cut. The width here is in
 * characters rather than millimetres because the note face is the one size:
 * ninety-five of them is the sheet's usable width at `noteSize`, measured.
 */
export function wrapped(lines: readonly string[], columns = 95): string[] {
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
export function awayFrom(inside: Vec2, at: Vec2): Vec2 {
  const dx = at[0] - inside[0];
  const dy = at[1] - inside[1];
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}
