/**
 * Generic BFS net unfolding for any closed polyhedral surface.
 * Places each face via trilateration across the shared edge.
 *
 * Placements that would overlap an already-placed face — or lie edge-flush
 * against an unrelated face — are deferred so the face can be reached through
 * a different neighbor instead. This matters for toroidal solids: their flat
 * (360°) vertices make naive BFS unfolding self-overlap and produce butted
 * cut edges whose walls and cut guides collide visually. Convex solids have
 * positive angle deficit everywhere, so neither rejection ever triggers and
 * their layout is identical to plain BFS.
 *
 * Two kinds of edge coincidence are distinguished in the result:
 * - A cut edge whose two occurrences land exactly on each other (e.g. a ring
 *   of coplanar faces closing up flat) is a "virtual fold": the paper is
 *   continuous there, so the pair is added to `foldPairs` and needs no cut
 *   guide or glue tab.
 * - A cut edge butted against an unrelated face is recorded in `flushEdges`
 *   so the renderer can avoid drawing misleading marks into the neighbor.
 */

import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face, Vec3 } from '../core/types.ts';
import { sub, dot, cross, norm } from '../core/vec3.ts';

import type { Vec2 } from '../core/vec2.ts';
import { sub2, len2 } from '../core/vec2.ts';
import { buildEdgeIndex } from './edge-index.ts';
import type { AdjEdge } from './edge-index.ts';

export type { Vec2 } from '../core/vec2.ts';

export interface NetFace {
  faceId: number;
  vertices2d: Vec2[];
}

export interface NetLayout {
  faces: NetFace[];
  width: number;
  height: number;
  /**
   * "min:max" face-ID pairs joined by fold edges: the BFS spanning tree plus
   * virtual folds (cut edges whose two occurrences coincide exactly, leaving
   * the paper continuous).
   */
  foldPairs: Set<string>;
  /** "faceId:edgeIdx" cut edges butted flush against an unrelated face. */
  flushEdges: Set<string>;
  /** "faceId:edgeIdx" — which occurrence of each cut edge carries the glue tab. */
  tabOwners: Set<string>;
}

// ─── Main entry ───────────────────────────────────────────────────

export function computeNetLayout(polyhedron: Polyhedron): NetLayout {
  const faces = polyhedron.faces();
  if (faces.length === 0) {
    return {
      faces: [], width: 0, height: 0,
      foldPairs: new Set(), flushEdges: new Set(), tabOwners: new Set(),
    };
  }

  const adj = buildEdgeIndex(faces).adjacencies();

  // Tolerances relative to edge scale so layouts stay scale-invariant.
  let maxEdge = 0;
  for (const f of faces) {
    const nv = f.vertices.length;
    for (let i = 0; i < nv; i++) {
      const d = norm(sub(f.vertices[(i + 1) % nv]!, f.vertices[i]!));
      if (d > maxEdge) maxEdge = d;
    }
  }
  const eps = maxEdge * 1e-7;
  const flushTol = maxEdge * 1e-6;

  // Root 0 succeeds without any compromise for convex solids. Toroidal solids
  // can paint themselves into a corner, in which case the unfolding is
  // retried from every other root and the cleanest layout wins.
  const score = (r: UnfoldResult) => r.overlapForced * 1e6 + r.flushAccepted;
  let best = unfoldFrom(faces, adj, 0, eps, flushTol);
  for (let root = 1; root < faces.length && score(best) > 0; root++) {
    const attempt = unfoldFrom(faces, adj, root, eps, flushTol);
    if (score(attempt) < score(best)) best = attempt;
  }
  const { placed, foldPairs } = best;

  const edgeSeg = (fid: number, i: number): [Vec2, Vec2] => {
    const vs = placed.get(fid)!;
    return [vs[i]!, vs[(i + 1) % vs.length]!];
  };

  // Virtual folds: 3D-adjacent faces whose shared (cut) edge lands on itself.
  for (const [fid, edges] of adj) {
    for (const e of edges) {
      if (e.neighborId <= fid) continue; // handle each pair once
      const pairKey = `${fid}:${e.neighborId}`;
      if (foldPairs.has(pairKey)) continue;
      const [a, b] = edgeSeg(fid, edgeIdxOf(e.parentIdx));
      const [c, d] = edgeSeg(e.neighborId, edgeIdxOf(e.childIdx));
      if (sameSegment(a, b, c, d, flushTol)) foldPairs.add(pairKey);
    }
  }

  const isFoldEdge = (fid: number, nb: number): boolean => {
    const key = fid < nb ? `${fid}:${nb}` : `${nb}:${fid}`;
    return foldPairs.has(key);
  };

  // Flush cut edges: butted against some unrelated face in the layout.
  const flushEdges = new Set<string>();
  for (const f of faces) {
    const nv = placed.get(f.id)!.length;
    const partnerByEdge = new Map<number, number>();
    for (const e of adj.get(f.id)!) partnerByEdge.set(edgeIdxOf(e.parentIdx), e.neighborId);
    for (let i = 0; i < nv; i++) {
      const partner = partnerByEdge.get(i);
      if (partner !== undefined && isFoldEdge(f.id, partner)) continue;
      const [a, b] = edgeSeg(f.id, i);
      outer: for (const g of faces) {
        if (g.id === f.id) continue;
        const gv = placed.get(g.id)!;
        for (let j = 0; j < gv.length; j++) {
          const [c, d] = edgeSeg(g.id, j);
          if (collinearOverlapLen(a, b, c, d, flushTol) > flushTol) {
            flushEdges.add(`${f.id}:${i}`);
            break outer;
          }
        }
      }
    }
  }

  // Tab ownership: each cut edge appears twice in the net; put the glue tab
  // on an occurrence with open space outside (not flush), falling back to
  // the smaller face id.
  const tabOwners = new Set<string>();
  for (const [fid, edges] of adj) {
    for (const e of edges) {
      if (e.neighborId <= fid) continue;
      if (isFoldEdge(fid, e.neighborId)) continue;
      const iA = edgeIdxOf(e.parentIdx);
      const iB = edgeIdxOf(e.childIdx);
      const flushA = flushEdges.has(`${fid}:${iA}`);
      const flushB = flushEdges.has(`${e.neighborId}:${iB}`);
      if (flushA && !flushB) tabOwners.add(`${e.neighborId}:${iB}`);
      else if (flushB && !flushA) tabOwners.add(`${fid}:${iA}`);
      else tabOwners.add(fid < e.neighborId ? `${fid}:${iA}` : `${e.neighborId}:${iB}`);
    }
  }

  // Bounding box → normalize to origin
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const vs of placed.values()) {
    for (const [x, y] of vs) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }

  const netFaces: NetFace[] = faces.map(f => ({
    faceId: f.id,
    vertices2d: placed.get(f.id)!.map(([x, y]) => [x - minX, y - minY] as Vec2),
  }));

  return {
    faces: netFaces, width: maxX - minX, height: maxY - minY,
    foldPairs, flushEdges, tabOwners,
  };
}

/** Edge index from an AdjEdge vertex-index pair ({i, i+1 mod nv} in either order). */
function edgeIdxOf(vIdx: [number, number]): number {
  const [x, y] = vIdx;
  if (y === x + 1) return x;
  if (x === y + 1) return y;
  return Math.max(x, y); // wraparound pair {0, nv-1} → edge nv-1
}

// ─── Overlap-aware unfolding from a given root face ───────────────

interface UnfoldResult {
  placed: Map<number, Vec2[]>;
  foldPairs: Set<string>;
  /** Faces placed overlapping another face (0 = clean net). */
  overlapForced: number;
  /** Faces placed butted flush against an unrelated face. */
  flushAccepted: number;
}

function unfoldFrom(
  faces: Face[],
  adj: ReadonlyMap<number, AdjEdge[]>,
  root: number,
  eps: number,
  flushTol: number,
): UnfoldResult {
  const placed = new Map<number, Vec2[]>();
  const foldPairs = new Set<string>();
  let overlapForced = 0;
  let flushAccepted = 0;

  const overlapsPlaced = (cand: Vec2[]): boolean => {
    for (const verts of placed.values()) {
      if (polygonsOverlap(cand, verts, eps)) return true;
    }
    return false;
  };

  // True if the candidate lies edge-flush against a placed face, other than
  // exactly closing up with its own 3D partner edge (which is harmless — the
  // paper is simply continuous there).
  const unrelatedFlush = (cand: Vec2[], candId: number): boolean => {
    const nv = cand.length;
    for (const [fid, verts] of placed) {
      const gv = verts.length;
      for (let i = 0; i < nv; i++) {
        const a = cand[i]!, b = cand[(i + 1) % nv]!;
        for (let j = 0; j < gv; j++) {
          const c = verts[j]!, d = verts[(j + 1) % gv]!;
          if (collinearOverlapLen(a, b, c, d, flushTol) <= flushTol) continue;
          const aligned =
            sameSegment(a, b, c, d, flushTol) &&
            adj.get(candId)!.some(
              (e) => e.neighborId === fid &&
                edgeIdxOf(e.parentIdx) === i && edgeIdxOf(e.childIdx) === j,
            );
          if (!aligned) return true;
        }
      }
    }
    return false;
  };

  const unfold = (pid: number, edge: AdjEdge): Vec2[] =>
    unfoldFace(
      placed.get(pid)!, edge.parentIdx,
      faces[edge.neighborId]!, edge.childIdx,
    );

  const queue = [root];
  const deferred: { pid: number; edge: AdjEdge }[] = [];
  placed.set(root, projectFace(faces[root]!));

  const commit = (pid: number, edge: AdjEdge, verts: Vec2[]): void => {
    placed.set(edge.neighborId, verts);
    const a = pid, b = edge.neighborId;
    foldPairs.add(a < b ? `${a}:${b}` : `${b}:${a}`);
    queue.push(edge.neighborId);
  };

  for (;;) {
    while (queue.length > 0) {
      const pid = queue.shift()!;
      for (const edge of adj.get(pid)!) {
        if (placed.has(edge.neighborId)) continue;
        const cand = unfold(pid, edge);
        if (overlapsPlaced(cand) || unrelatedFlush(cand, edge.neighborId)) {
          // Defer: the face may unfold cleanly across a different edge.
          deferred.push({ pid, edge });
          continue;
        }
        commit(pid, edge, cand);
      }
    }
    if (placed.size >= faces.length) break;
    // Every remaining reachable face is compromised from all its placed
    // neighbors. Prefer a flush-but-not-overlapping placement; overlap only
    // as a last resort. The layout must always complete.
    let pick = -1;
    let pickOverlaps = false;
    for (let k = 0; k < deferred.length; k++) {
      const d = deferred[k]!;
      if (placed.has(d.edge.neighborId)) continue;
      if (!overlapsPlaced(unfold(d.pid, d.edge))) { pick = k; break; }
      if (pick === -1) { pick = k; pickOverlaps = true; }
    }
    if (pick === -1) break; // not edge-connected
    const { pid, edge } = deferred.splice(pick, 1)[0]!;
    commit(pid, edge, unfold(pid, edge));
    if (pickOverlaps) overlapForced++;
    else flushAccepted++;
  }

  return { placed, foldPairs, overlapForced, flushAccepted };
}

// ─── Project first face onto its own plane ────────────────────────

function projectFace(face: Face): Vec2[] {
  const v = face.vertices;
  const o = v[0]!;
  const e = sub(v[1]!, o);
  const eLen = norm(e);
  const ux: Vec3 = [e[0] / eLen, e[1] / eLen, e[2] / eLen];
  // uy = cross(normal, ux) — lies in face plane, perpendicular to ux
  const uy: Vec3 = cross(face.normal, ux);

  return v.map(p => {
    const d = sub(p, o);
    return [dot(d, ux), dot(d, uy)] as Vec2;
  });
}

// ─── Unfold a child face across a shared edge ─────────────────────

function unfoldFace(
  parentVerts2d: Vec2[], parentIdx: [number, number],
  childFace: Face, childIdx: [number, number],
): Vec2[] {
  const nv = childFace.vertices.length;
  const result: Vec2[] = new Array(nv);

  // Shared edge: child vertex childIdx[k] matches parent vertex parentIdx[k]
  const a2d = parentVerts2d[parentIdx[0]!]!;
  const b2d = parentVerts2d[parentIdx[1]!]!;
  result[childIdx[0]!] = a2d;
  result[childIdx[1]!] = b2d;

  // Parent face centroid — non-shared vertices go on opposite side
  const pcx = parentVerts2d.reduce((s, v) => s + v[0], 0) / parentVerts2d.length;
  const pcy = parentVerts2d.reduce((s, v) => s + v[1], 0) / parentVerts2d.length;
  const parentCenter: Vec2 = [pcx, pcy];

  for (let i = 0; i < nv; i++) {
    if (i === childIdx[0] || i === childIdx[1]) continue;
    const v3d = childFace.vertices[i]!;
    const da = norm(sub(v3d, childFace.vertices[childIdx[0]!]!));
    const db = norm(sub(v3d, childFace.vertices[childIdx[1]!]!));
    result[i] = trilaterate(a2d, da, b2d, db, parentCenter);
  }

  return result;
}

// ─── Convex polygon overlap (separating axis test) ────────────────

/**
 * True if two convex polygons overlap by more than `eps` (touching along a
 * shared edge or vertex does not count). Used to validate that an unfolded
 * net has no colliding faces.
 */
export function polygonsOverlap(a: Vec2[], b: Vec2[], eps: number): boolean {
  return !hasSeparatingAxis(a, b, eps) && !hasSeparatingAxis(b, a, eps);
}

function hasSeparatingAxis(poly: Vec2[], other: Vec2[], eps: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 1e-12) continue;
    // Unit normal of edge pq
    const ax = (p[1] - q[1]) / len;
    const ay = (q[0] - p[0]) / len;

    let minA = Infinity, maxA = -Infinity;
    for (const v of poly) {
      const d = v[0] * ax + v[1] * ay;
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }
    let minB = Infinity, maxB = -Infinity;
    for (const v of other) {
      const d = v[0] * ax + v[1] * ay;
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }
    if (Math.min(maxA, maxB) - Math.max(minA, minB) <= eps) return true;
  }
  return false;
}

// ─── Segment coincidence helpers ───────────────────────────────────

/** Length of the collinear overlap of segment cd with segment ab (0 if not collinear). */
export function collinearOverlapLen(
  a: Vec2, b: Vec2, c: Vec2, d: Vec2, tol: number,
): number {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const len = Math.hypot(abx, aby);
  if (len < tol) return 0;
  const ux = abx / len, uy = aby / len;
  // Both endpoints of cd must lie on the ab line
  const distC = Math.abs((c[0] - a[0]) * uy - (c[1] - a[1]) * ux);
  const distD = Math.abs((d[0] - a[0]) * uy - (d[1] - a[1]) * ux);
  if (distC > tol || distD > tol) return 0;
  const tc = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy;
  const td = (d[0] - a[0]) * ux + (d[1] - a[1]) * uy;
  const lo = Math.max(0, Math.min(tc, td));
  const hi = Math.min(len, Math.max(tc, td));
  return Math.max(0, hi - lo);
}

/** True if segments ab and cd have the same endpoints (either orientation). */
export function sameSegment(a: Vec2, b: Vec2, c: Vec2, d: Vec2, tol: number): boolean {
  const close = (p: Vec2, q: Vec2) =>
    Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
  return (close(a, c) && close(b, d)) || (close(a, d) && close(b, c));
}

// ─── Trilateration: intersect two circles, pick side away from ref ─

function trilaterate(a: Vec2, da: number, b: Vec2, db: number, awayFrom: Vec2): Vec2 {
  const ab = sub2(b, a);
  const d = len2(ab);
  if (d < 1e-12) return a;

  const x = (da * da - db * db + d * d) / (2 * d);
  const y = Math.sqrt(Math.max(0, da * da - x * x));

  const ux = ab[0] / d, uy = ab[1] / d;
  const vx = -uy, vy = ux;

  const p1: Vec2 = [a[0] + x * ux + y * vx, a[1] + x * uy + y * vy];
  const p2: Vec2 = [a[0] + x * ux - y * vx, a[1] + x * uy - y * vy];

  // Choose point on opposite side of AB line from awayFrom
  const crossRef = ab[0] * (awayFrom[1] - a[1]) - ab[1] * (awayFrom[0] - a[0]);
  const crossP1 = ab[0] * (p1[1] - a[1]) - ab[1] * (p1[0] - a[0]);
  return crossP1 * crossRef < 0 ? p1 : p2;
}
