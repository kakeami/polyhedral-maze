/**
 * Generic BFS net unfolding for any convex polyhedron.
 * Places each face via trilateration across the shared edge.
 */

import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face, Vec3 } from '../core/types.ts';
import { sub, dot, cross, norm } from '../core/vec3.ts';

import type { Vec2 } from '../core/vec2.ts';
import { sub2, len2 } from '../core/vec2.ts';

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
}

// ─── Main entry ───────────────────────────────────────────────────

export function computeNetLayout(polyhedron: Polyhedron): NetLayout {
  const faces = polyhedron.faces();
  if (faces.length === 0) return { faces: [], width: 0, height: 0, foldPairs: new Set() };

  const adj = buildFaceAdjacency(faces);
  const placed = new Map<number, Vec2[]>();
  const foldPairs = new Set<string>();

  // BFS unfolding from face 0
  placed.set(0, projectFace(faces[0]!));
  const visited = new Set<number>([0]);
  const queue = [0];

  while (queue.length > 0) {
    const pid = queue.shift()!;
    for (const edge of adj.get(pid)!) {
      if (visited.has(edge.neighborId)) continue;
      visited.add(edge.neighborId);
      placed.set(
        edge.neighborId,
        unfoldFace(
          placed.get(pid)!, edge.parentIdx,
          faces[edge.neighborId]!, edge.childIdx,
        ),
      );
      // Record this parent-child edge as a fold edge
      const a = pid, b = edge.neighborId;
      foldPairs.add(a < b ? `${a}:${b}` : `${b}:${a}`);
      queue.push(edge.neighborId);
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

  return { faces: netFaces, width: maxX - minX, height: maxY - minY, foldPairs };
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

// ─── Face adjacency ───────────────────────────────────────────────

interface AdjEdge {
  neighborId: number;
  parentIdx: [number, number];
  childIdx: [number, number];
}

function buildFaceAdjacency(faces: Face[]): Map<number, AdjEdge[]> {
  const eps = 1e-6;
  const adj = new Map<number, AdjEdge[]>();
  for (const f of faces) adj.set(f.id, []);

  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const fi = faces[i]!, fj = faces[j]!;
      const mi: number[] = [], mj: number[] = [];
      for (let a = 0; a < fi.vertices.length; a++) {
        for (let b = 0; b < fj.vertices.length; b++) {
          const d = sub(fi.vertices[a]!, fj.vertices[b]!);
          if (Math.abs(d[0]) < eps && Math.abs(d[1]) < eps && Math.abs(d[2]) < eps) {
            mi.push(a); mj.push(b);
          }
        }
      }
      if (mi.length !== 2) continue;

      adj.get(fi.id)!.push({
        neighborId: fj.id,
        parentIdx: [mi[0]!, mi[1]!],
        childIdx: [mj[0]!, mj[1]!],
      });
      adj.get(fj.id)!.push({
        neighborId: fi.id,
        parentIdx: [mj[0]!, mj[1]!],
        childIdx: [mi[0]!, mi[1]!],
      });
    }
  }
  return adj;
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

