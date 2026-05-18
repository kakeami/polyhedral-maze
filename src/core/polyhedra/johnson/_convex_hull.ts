import type { Vec3 } from '../../types.ts';
import { cross, dot, mean, normalize, scale, sub } from '../../vec3.ts';

/** Distance above a face plane at which a point counts as outside (visible). */
const VISIBILITY_EPSILON = 1e-9;
/** Default tolerance for merging coplanar adjacent triangles. */
const DEFAULT_COPLANAR_TOL = 1e-6;

export interface HullFace {
  /** Vertex coordinates in CCW order around the outward normal. */
  vertices: Vec3[];
  /** Outward unit normal. */
  normal: Vec3;
}

interface Triangle {
  /** Vertex indices in CCW order around the outward normal. */
  v: [number, number, number];
  normal: Vec3;
  offset: number;
}

/**
 * 3D convex hull of `points`, with coplanar adjacent triangles merged into a
 * single polygonal face. For a polyhedron whose faces are regular polygons,
 * each face is recovered as one HullFace with vertices in CCW order around
 * the outward normal.
 *
 * Algorithm: seed tetrahedron, then incremental insertion with horizon
 * reconstruction. After hull construction, triangles that share an edge and
 * whose outward normals are parallel within `coplanarTol` are unioned and
 * their joint boundary extracted as the merged face.
 *
 * Points strictly interior to the hull are silently ignored. Caller must
 * supply a unique, non-coplanar point set (≥4 points).
 */
export function convexHull(
  points: Vec3[],
  coplanarTol: number = DEFAULT_COPLANAR_TOL,
): HullFace[] {
  if (points.length < 4) {
    throw new Error('convexHull: need at least 4 points');
  }
  const tris = incrementalHull(points);
  return mergeCoplanarFaces(tris, points, coplanarTol);
}

function incrementalHull(points: Vec3[]): Triangle[] {
  const seed = seedTetrahedron(points);
  const cen = mean([
    points[seed[0]]!,
    points[seed[1]]!,
    points[seed[2]]!,
    points[seed[3]]!,
  ]);

  const faces: [number, number, number][] = [
    [seed[0], seed[1], seed[2]],
    [seed[0], seed[1], seed[3]],
    [seed[0], seed[2], seed[3]],
    [seed[1], seed[2], seed[3]],
  ];
  const tris: Triangle[] = faces.map((f) => orientedTriangle(f, points, cen));

  for (let p = 0; p < points.length; p++) {
    if (seed.includes(p)) continue;
    addPoint(tris, p, points);
  }

  return tris;
}

function seedTetrahedron(points: Vec3[]): [number, number, number, number] {
  const i0 = 0;

  let i1 = -1;
  let best = -1;
  for (let i = 1; i < points.length; i++) {
    const d = sqDist(points[i0]!, points[i]!);
    if (d > best) { best = d; i1 = i; }
  }
  if (best < VISIBILITY_EPSILON) {
    throw new Error('convexHull: all points coincide');
  }

  let i2 = -1;
  best = -1;
  const dir = normalize(sub(points[i1]!, points[i0]!));
  for (let i = 0; i < points.length; i++) {
    if (i === i0 || i === i1) continue;
    const v = sub(points[i]!, points[i0]!);
    const proj = dot(v, dir);
    const perp = sub(v, scale(dir, proj));
    const d = dot(perp, perp);
    if (d > best) { best = d; i2 = i; }
  }
  if (best < VISIBILITY_EPSILON) {
    throw new Error('convexHull: all points collinear');
  }

  let i3 = -1;
  best = -1;
  const e1 = sub(points[i1]!, points[i0]!);
  const e2 = sub(points[i2]!, points[i0]!);
  const pn = normalize(cross(e1, e2));
  for (let i = 0; i < points.length; i++) {
    if (i === i0 || i === i1 || i === i2) continue;
    const v = sub(points[i]!, points[i0]!);
    const d = Math.abs(dot(v, pn));
    if (d > best) { best = d; i3 = i; }
  }
  if (best < VISIBILITY_EPSILON) {
    throw new Error('convexHull: all points coplanar');
  }

  return [i0, i1, i2, i3];
}

function orientedTriangle(
  face: [number, number, number],
  points: Vec3[],
  interior: Vec3,
): Triangle {
  const [a, b, c] = face;
  const v0 = points[a]!;
  const v1 = points[b]!;
  const v2 = points[c]!;
  let normal = normalize(cross(sub(v1, v0), sub(v2, v0)));
  let verts: [number, number, number] = [a, b, c];
  if (dot(normal, sub(v0, interior)) < 0) {
    normal = scale(normal, -1);
    verts = [a, c, b];
  }
  return { v: verts, normal, offset: dot(normal, v0) };
}

function addPoint(tris: Triangle[], p: number, points: Vec3[]): void {
  const pv = points[p]!;
  const visible = tris.map((t) => dot(t.normal, pv) - t.offset > VISIBILITY_EPSILON);
  if (!visible.some((v) => v)) return;

  const edgeOwner = new Map<string, number>();
  for (let i = 0; i < tris.length; i++) {
    const [a, b, c] = tris[i]!.v;
    edgeOwner.set(`${a},${b}`, i);
    edgeOwner.set(`${b},${c}`, i);
    edgeOwner.set(`${c},${a}`, i);
  }

  const horizon: [number, number][] = [];
  for (let i = 0; i < tris.length; i++) {
    if (!visible[i]) continue;
    const [a, b, c] = tris[i]!.v;
    for (const [x, y] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const opp = edgeOwner.get(`${y},${x}`);
      if (opp !== undefined && !visible[opp]) {
        horizon.push([x, y]);
      }
    }
  }

  for (let i = tris.length - 1; i >= 0; i--) {
    if (visible[i]) tris.splice(i, 1);
  }

  for (const [x, y] of horizon) {
    const v0 = points[x]!;
    const v1 = points[y]!;
    const v2 = pv;
    const normal = normalize(cross(sub(v1, v0), sub(v2, v0)));
    tris.push({ v: [x, y, p], normal, offset: dot(normal, v0) });
  }
}

function mergeCoplanarFaces(
  tris: Triangle[],
  points: Vec3[],
  coplanarTol: number,
): HullFace[] {
  const n = tris.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const unite = (i: number, j: number) => {
    const a = find(i), b = find(j);
    if (a !== b) parent[a] = b;
  };

  const edgeOwner = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const [a, b, c] = tris[i]!.v;
    edgeOwner.set(`${a},${b}`, i);
    edgeOwner.set(`${b},${c}`, i);
    edgeOwner.set(`${c},${a}`, i);
  }

  for (let i = 0; i < n; i++) {
    const [a, b, c] = tris[i]!.v;
    for (const [x, y] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const j = edgeOwner.get(`${y},${x}`);
      if (j === undefined || j === i) continue;
      if (1 - dot(tris[i]!.normal, tris[j]!.normal) < coplanarTol) {
        unite(i, j);
      }
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r)!.push(i);
  }

  const result: HullFace[] = [];
  for (const members of clusters.values()) {
    result.push(extractBoundary(members, tris, points));
  }
  return result;
}

function extractBoundary(
  members: number[],
  tris: Triangle[],
  points: Vec3[],
): HullFace {
  const directed = new Set<string>();
  for (const i of members) {
    const [a, b, c] = tris[i]!.v;
    directed.add(`${a},${b}`);
    directed.add(`${b},${c}`);
    directed.add(`${c},${a}`);
  }

  const next = new Map<number, number>();
  for (const key of directed) {
    const [aS, bS] = key.split(',');
    const a = Number(aS), b = Number(bS);
    if (!directed.has(`${b},${a}`)) {
      if (next.has(a)) {
        throw new Error(`extractBoundary: vertex ${a} has multiple outgoing boundary edges`);
      }
      next.set(a, b);
    }
  }

  if (next.size === 0) {
    throw new Error('extractBoundary: cluster has no boundary');
  }

  const start = next.keys().next().value!;
  const order: number[] = [];
  let cur = start;
  while (true) {
    order.push(cur);
    const nxt = next.get(cur);
    if (nxt === undefined) {
      throw new Error('extractBoundary: open boundary chain');
    }
    cur = nxt;
    if (cur === start) break;
    if (order.length > next.size) {
      throw new Error('extractBoundary: boundary chain did not close');
    }
  }

  const cleaned = stripCollinear(order, points);

  let nx = 0, ny = 0, nz = 0;
  for (const i of members) {
    nx += tris[i]!.normal[0];
    ny += tris[i]!.normal[1];
    nz += tris[i]!.normal[2];
  }
  const len = Math.hypot(nx, ny, nz);
  const normal: Vec3 = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];

  return { vertices: cleaned.map((i) => points[i]!), normal };
}

function stripCollinear(indices: number[], points: Vec3[], tol = 1e-9): number[] {
  const n = indices.length;
  if (n < 4) return indices;
  const keep: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[indices[(i - 1 + n) % n]!]!;
    const cur = points[indices[i]!]!;
    const next = points[indices[(i + 1) % n]!]!;
    const c = cross(sub(cur, prev), sub(next, cur));
    if (dot(c, c) > tol) keep.push(indices[i]!);
  }
  return keep.length >= 3 ? keep : indices;
}

function sqDist(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}
