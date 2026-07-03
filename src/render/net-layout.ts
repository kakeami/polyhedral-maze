/**
 * Generic BFS net unfolding for any closed polyhedral surface.
 * Places each face via trilateration across the shared edge.
 *
 * Placements that would overlap an already-placed face are deferred so the
 * face can be reached through a different neighbor instead — necessary for
 * nonconvex and toroidal solids, where naive BFS unfolding self-overlaps.
 * For convex solids no deferral ever triggers, so the layout is identical
 * to plain BFS.
 *
 * Toroidal solids additionally split into multiple pieces: the tunnel-lining
 * faces (outward normal pointing back toward the solid's center) unfold as
 * their own strip, because a one-piece net of a genus-1 surface is nearly
 * impossible to assemble as papercraft.
 */

import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face, Vec3 } from '../core/types.ts';
import { sub, dot, cross, norm, mean } from '../core/vec3.ts';

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
  /** "min:max" face-ID pairs connected by fold edges in the BFS tree. */
  foldPairs: Set<string>;
  /** Face-id groups laid out as separate net pieces (1 group for genus-0 solids). */
  pieces: number[][];
}

// ─── Main entry ───────────────────────────────────────────────────

export function computeNetLayout(polyhedron: Polyhedron): NetLayout {
  const faces = polyhedron.faces();
  if (faces.length === 0) {
    return { faces: [], width: 0, height: 0, foldPairs: new Set(), pieces: [] };
  }

  const adj = buildEdgeIndex(faces).adjacencies();

  // Overlap tolerance: relative to edge scale so layouts stay scale-invariant.
  let maxEdge = 0;
  for (const f of faces) {
    const nv = f.vertices.length;
    for (let i = 0; i < nv; i++) {
      const d = norm(sub(f.vertices[(i + 1) % nv]!, f.vertices[i]!));
      if (d > maxEdge) maxEdge = d;
    }
  }
  const eps = maxEdge * 1e-7;

  // Split off tunnel-lining faces (normal pointing back toward the center):
  // they become separate net pieces. Convex solids have none, giving the
  // usual single-piece net.
  const center = vertexCentroid(faces);
  const isInward = (f: Face) => dot(f.normal, sub(mean(f.vertices), center)) < 0;
  const pieces: number[][] = [
    ...connectedComponents(faces.filter((f) => !isInward(f)), adj),
    ...connectedComponents(faces.filter(isInward), adj),
  ];

  // Unfold each piece. Root ids[0] succeeds without any forced overlap for
  // convex solids. Toroidal solids can paint themselves into a corner, in
  // which case the unfolding is retried from every other root within the
  // piece and the cleanest layout wins.
  const foldPairs = new Set<string>();
  const placed = new Map<number, Vec2[]>();
  const gap = maxEdge * 0.6;
  let xOffset = 0;

  for (const ids of pieces) {
    const allowed = new Set(ids);
    let best = unfoldFrom(faces, adj, ids[0]!, eps, allowed);
    for (let r = 1; r < ids.length && best.forced > 0; r++) {
      const attempt = unfoldFrom(faces, adj, ids[r]!, eps, allowed);
      if (attempt.forced < best.forced) best = attempt;
    }

    // Pack pieces left-to-right, each normalized to y = 0.
    let minX = Infinity, minY = Infinity, maxX = -Infinity;
    for (const vs of best.placed.values()) {
      for (const [x, y] of vs) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y;
      }
    }
    for (const [fid, vs] of best.placed) {
      placed.set(fid, vs.map(([x, y]) => [x - minX + xOffset, y - minY] as Vec2));
    }
    for (const fp of best.foldPairs) foldPairs.add(fp);
    xOffset += maxX - minX + gap;
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

  return { faces: netFaces, width: maxX - minX, height: maxY - minY, foldPairs, pieces };
}

/** Mean of the polyhedron's unique vertices. */
function vertexCentroid(faces: Face[]): Vec3 {
  const seen = new Set<string>();
  const unique: Vec3[] = [];
  for (const f of faces) {
    for (const v of f.vertices) {
      const key = v.map((x) => x.toFixed(10)).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(v);
      }
    }
  }
  return mean(unique);
}

/** Connected components of a face subset under shared-edge adjacency. */
function connectedComponents(
  subset: Face[],
  adj: ReadonlyMap<number, AdjEdge[]>,
): number[][] {
  const remaining = new Set(subset.map((f) => f.id));
  const components: number[][] = [];
  while (remaining.size > 0) {
    const root = remaining.values().next().value!;
    remaining.delete(root);
    const component = [root];
    const queue = [root];
    while (queue.length > 0) {
      const fid = queue.shift()!;
      for (const edge of adj.get(fid)!) {
        if (remaining.has(edge.neighborId)) {
          remaining.delete(edge.neighborId);
          component.push(edge.neighborId);
          queue.push(edge.neighborId);
        }
      }
    }
    components.push(component.sort((a, b) => a - b));
  }
  return components;
}

// ─── Overlap-aware unfolding from a given root face ───────────────

interface UnfoldResult {
  placed: Map<number, Vec2[]>;
  foldPairs: Set<string>;
  /** Number of faces that had to be placed overlapping (0 = clean net). */
  forced: number;
}

function unfoldFrom(
  faces: Face[],
  adj: ReadonlyMap<number, AdjEdge[]>,
  root: number,
  eps: number,
  allowed: ReadonlySet<number>,
): UnfoldResult {
  const placed = new Map<number, Vec2[]>();
  const foldPairs = new Set<string>();
  let forced = 0;

  const overlapsPlaced = (cand: Vec2[]): boolean => {
    for (const verts of placed.values()) {
      if (polygonsOverlap(cand, verts, eps)) return true;
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
        if (!allowed.has(edge.neighborId) || placed.has(edge.neighborId)) continue;
        const cand = unfold(pid, edge);
        if (overlapsPlaced(cand)) {
          // Defer: the face may unfold cleanly across a different edge.
          deferred.push({ pid, edge });
          continue;
        }
        commit(pid, edge, cand);
      }
    }
    if (placed.size >= allowed.size) break;
    // Every remaining reachable face overlaps from all its placed neighbors.
    // Force the earliest deferral so the layout is still complete.
    const idx = deferred.findIndex((d) => !placed.has(d.edge.neighborId));
    if (idx === -1) break; // not edge-connected
    const { pid, edge } = deferred.splice(idx, 1)[0]!;
    commit(pid, edge, unfold(pid, edge));
    forced++;
  }

  return { placed, foldPairs, forced };
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

