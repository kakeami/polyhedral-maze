import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { cross, mean, normalize, sub, norm } from '../../vec3.ts';

const VERTEX_TOL = 1e-9;

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Indices into the canonical icosahedron vertex layout below. Used by
 * diminished-icosahedron Johnson shapes (J62/J63/J64) to pick removal targets
 * by symbolic name rather than raw coordinates.
 */
export const ICOSA_VERTEX: Record<string, Vec3> = {
  v0: [0, 1, PHI],
  v1: [0, -1, PHI],
  v2: [0, 1, -PHI],
  v3: [0, -1, -PHI],
  v4: [1, PHI, 0],
  v5: [-1, PHI, 0],
  v6: [1, -PHI, 0],
  v7: [-1, -PHI, 0],
  v8: [PHI, 0, 1],
  v9: [-PHI, 0, 1],
  v10: [PHI, 0, -1],
  v11: [-PHI, 0, -1],
};

/**
 * Unit-edge regular icosahedron face list (edge length 2 in raw coordinates).
 * Used by diminished-icosahedron Johnson shapes; downstream callers should
 * apply `normalizeFaces(_, 1)` to rescale to unit-circumradius.
 */
export function rawIcosahedronFaces(): Face[] {
  const V = ICOSA_VERTEX;
  const faceIndices: [keyof typeof V, keyof typeof V, keyof typeof V][] = [
    ['v0', 'v1', 'v8'], ['v0', 'v8', 'v4'], ['v0', 'v4', 'v5'], ['v0', 'v5', 'v9'], ['v0', 'v9', 'v1'],
    ['v3', 'v6', 'v10'], ['v3', 'v10', 'v2'], ['v3', 'v2', 'v11'], ['v3', 'v11', 'v7'], ['v3', 'v7', 'v6'],
    ['v1', 'v6', 'v8'], ['v8', 'v6', 'v10'], ['v8', 'v10', 'v4'], ['v4', 'v10', 'v2'], ['v4', 'v2', 'v5'],
    ['v5', 'v2', 'v11'], ['v5', 'v11', 'v9'], ['v9', 'v11', 'v7'], ['v9', 'v7', 'v1'], ['v1', 'v7', 'v6'],
  ];
  return faceIndices.map(([a, b, c], id) => makeFace(id, [V[a]!, V[b]!, V[c]!]));
}

function approxEqual(a: Vec3, b: Vec3, tol = VERTEX_TOL): boolean {
  return (
    Math.abs(a[0] - b[0]) < tol &&
    Math.abs(a[1] - b[1]) < tol &&
    Math.abs(a[2] - b[2]) < tol
  );
}

/**
 * Remove a vertex from an icosahedron-like polyhedron and replace the ring of
 * 5 triangles around it with a single pentagonal face. The polyhedron must
 * have exactly 5 triangular faces incident to the target vertex (i.e. a
 * vertex of degree 5 in an equilateral-triangle face). Returns a fresh face
 * list with contiguous ids reassigned from 0.
 */
export function diminishVertex(faces: Face[], target: Vec3): Face[] {
  const ringEdges: [Vec3, Vec3][] = [];
  const keep: Face[] = [];
  for (const f of faces) {
    const idx = f.vertices.findIndex((v) => approxEqual(v, target));
    if (idx < 0) {
      keep.push(f);
      continue;
    }
    if (f.vertices.length !== 3) {
      throw new Error(
        `diminishVertex: face containing target is ${f.vertices.length}-gon, expected triangle`,
      );
    }
    const others = f.vertices.filter((v) => !approxEqual(v, target));
    if (others.length !== 2) {
      throw new Error('diminishVertex: degenerate triangle around target');
    }
    ringEdges.push([others[0]!, others[1]!]);
  }
  if (ringEdges.length !== 5) {
    throw new Error(
      `diminishVertex: expected 5 triangles around target (got ${ringEdges.length})`,
    );
  }

  const ring: Vec3[] = [ringEdges[0]![0], ringEdges[0]![1]];
  const used = new Array<boolean>(ringEdges.length).fill(false);
  used[0] = true;
  while (ring.length < ringEdges.length) {
    const last = ring[ring.length - 1]!;
    let found = false;
    for (let i = 0; i < ringEdges.length; i++) {
      if (used[i]) continue;
      const [a, b] = ringEdges[i]!;
      if (approxEqual(a, last)) {
        ring.push(b);
        used[i] = true;
        found = true;
        break;
      }
      if (approxEqual(b, last)) {
        ring.push(a);
        used[i] = true;
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error('diminishVertex: cannot complete pentagonal ring');
    }
  }

  const out: Face[] = [];
  const id = { value: 0 };
  for (const f of keep) {
    out.push({ id: id.value++, vertices: f.vertices, normal: f.normal });
  }
  out.push(makeFace(id.value++, ring));
  return out;
}

function countShared(
  candidate: Vec3[],
  reference: Vec3[],
): number {
  let count = 0;
  for (const v of candidate) {
    if (reference.some((r) => approxEqual(v, r))) count++;
  }
  return count;
}

interface PentagonalCap {
  pentagon: Face;
  squares: Face[];
  triangles: Face[];
  /** Decagonal boundary in CCW order, length 10. */
  decagon: Vec3[];
}

/**
 * Identify the pentagonal-cupola cap around a pentagonal face in a
 * rhombicosidodecahedron-like polyhedron. The cap has:
 *   - 1 pentagonal top face (the input)
 *   - 5 square faces (each sharing an edge with the pentagon)
 *   - 5 triangular faces (each sharing only a vertex with the pentagon)
 *
 * Returns the cap faces plus the 10 boundary-decagon vertices in CCW order.
 */
function findPentagonalCap(faces: Face[], pentagonFaceId: number): PentagonalCap {
  const pentagon = faces.find((f) => f.id === pentagonFaceId);
  if (!pentagon || pentagon.vertices.length !== 5) {
    throw new Error(
      `findPentagonalCap: face ${pentagonFaceId} is not a pentagon`,
    );
  }
  const pentVerts = pentagon.vertices;

  const squares: Face[] = [];
  for (const f of faces) {
    if (f.id === pentagonFaceId) continue;
    if (f.vertices.length !== 4) continue;
    if (countShared(f.vertices, pentVerts) === 2) squares.push(f);
  }
  if (squares.length !== 5) {
    throw new Error(
      `findPentagonalCap: expected 5 adjacent squares, got ${squares.length}`,
    );
  }

  // Cupola vertex set: 5 pentagon + 10 outer (square outer corners)
  const cupolaVerts: Vec3[] = [...pentVerts];
  for (const sq of squares) {
    for (const v of sq.vertices) {
      if (pentVerts.some((pv) => approxEqual(v, pv))) continue;
      if (cupolaVerts.some((cv) => approxEqual(cv, v))) continue;
      cupolaVerts.push(v);
    }
  }
  if (cupolaVerts.length !== 15) {
    throw new Error(
      `findPentagonalCap: expected 15 cap vertices, got ${cupolaVerts.length}`,
    );
  }

  const triangles: Face[] = [];
  for (const f of faces) {
    if (f.id === pentagonFaceId) continue;
    if (f.vertices.length !== 3) continue;
    const inCap = f.vertices.every((v) =>
      cupolaVerts.some((cv) => approxEqual(cv, v)),
    );
    if (!inCap) continue;
    if (countShared(f.vertices, pentVerts) !== 1) continue;
    triangles.push(f);
  }
  if (triangles.length !== 5) {
    throw new Error(
      `findPentagonalCap: expected 5 corner triangles, got ${triangles.length}`,
    );
  }

  const capFaces = [pentagon, ...squares, ...triangles];

  // Boundary edges: edges that appear in exactly 1 cap face.
  const edgeKey = (a: Vec3, b: Vec3): string => {
    const ak = `${a[0].toFixed(9)},${a[1].toFixed(9)},${a[2].toFixed(9)}`;
    const bk = `${b[0].toFixed(9)},${b[1].toFixed(9)},${b[2].toFixed(9)}`;
    return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
  };
  const edgeData = new Map<string, [Vec3, Vec3, number]>();
  for (const f of capFaces) {
    const k = f.vertices.length;
    for (let i = 0; i < k; i++) {
      const a = f.vertices[i]!;
      const b = f.vertices[(i + 1) % k]!;
      const key = edgeKey(a, b);
      const prev = edgeData.get(key);
      if (prev) {
        edgeData.set(key, [prev[0], prev[1], prev[2] + 1]);
      } else {
        edgeData.set(key, [a, b, 1]);
      }
    }
  }
  const boundaryEdges: [Vec3, Vec3][] = [];
  for (const [, [a, b, n]] of edgeData) {
    if (n === 1) boundaryEdges.push([a, b]);
  }
  if (boundaryEdges.length !== 10) {
    throw new Error(
      `findPentagonalCap: expected 10 boundary edges, got ${boundaryEdges.length}`,
    );
  }

  const decagon: Vec3[] = [boundaryEdges[0]![0], boundaryEdges[0]![1]];
  const used = new Array<boolean>(boundaryEdges.length).fill(false);
  used[0] = true;
  while (decagon.length < 10) {
    const last = decagon[decagon.length - 1]!;
    let found = false;
    for (let i = 0; i < boundaryEdges.length; i++) {
      if (used[i]) continue;
      const [a, b] = boundaryEdges[i]!;
      if (approxEqual(a, last)) {
        decagon.push(b);
        used[i] = true;
        found = true;
        break;
      }
      if (approxEqual(b, last)) {
        decagon.push(a);
        used[i] = true;
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error('findPentagonalCap: cannot complete decagon');
    }
  }

  return { pentagon, squares, triangles, decagon };
}

/**
 * Remove the pentagonal-cupola cap (1 ⬠ + 5 □ + 5 △) around the given
 * pentagonal face id, replacing it with a single decagonal opening. Returns
 * a fresh face list with contiguous ids reassigned from 0. Used to construct
 * the diminished rhombicosidodecahedra (J76, J80-J83 and the diminished
 * components of J77-J79, J82).
 */
export function diminishPentagonalCap(
  faces: Face[],
  pentagonFaceId: number,
): Face[] {
  const cap = findPentagonalCap(faces, pentagonFaceId);
  const capIds = new Set<number>([
    cap.pentagon.id,
    ...cap.squares.map((f) => f.id),
    ...cap.triangles.map((f) => f.id),
  ]);

  const out: Face[] = [];
  const id = { value: 0 };
  for (const f of faces) {
    if (capIds.has(f.id)) continue;
    out.push({ id: id.value++, vertices: f.vertices, normal: f.normal });
  }
  out.push(makeFace(id.value++, cap.decagon));
  return out;
}

/**
 * Rotate the pentagonal-cupola cap around the given pentagonal face id by 36°
 * (π/5), converting the local ortho orientation to gyro (or vice versa).
 * Used to construct gyrate rhombicosidodecahedra (J72-J75 and the gyrate
 * components of J77-J79, J82).
 *
 * Implementation: remove the cap to expose the decagonal opening, cyclically
 * shift the decagon's vertices by one, then re-attach a fresh pentagonal
 * cupola. The shift converts triangle/square positions on the decagon, which
 * is precisely the gyrate operation.
 */
export function gyratePentagonalCap(
  faces: Face[],
  pentagonFaceId: number,
): Face[] {
  const cap = findPentagonalCap(faces, pentagonFaceId);
  const capIds = new Set<number>([
    cap.pentagon.id,
    ...cap.squares.map((f) => f.id),
    ...cap.triangles.map((f) => f.id),
  ]);

  // Decagon walking starts from one boundary edge; either end may be a
  // triangle-outer or a square-outer vertex. To keep the rotation reproducible
  // we pick a known anchor: the vertex that is the corner-triangle's outer
  // tip closest to the pentagon. Concretely: find the decagon index whose
  // vertex is shared with a corner triangle that contains a specific pentagon
  // vertex (pentagon.vertices[0]).
  const anchorPentVert = cap.pentagon.vertices[0]!;
  const anchorTriangle = cap.triangles.find((t) =>
    t.vertices.some((v) => approxEqual(v, anchorPentVert)),
  );
  if (!anchorTriangle) {
    throw new Error('gyratePentagonalCap: no triangle for pentagon[0]');
  }
  // The triangle's two non-pentagon vertices are decagon vertices.
  const triOuter = anchorTriangle.vertices.filter(
    (v) => !approxEqual(v, anchorPentVert),
  );
  if (triOuter.length !== 2) {
    throw new Error('gyratePentagonalCap: malformed corner triangle');
  }

  // Locate triOuter[0] and triOuter[1] in the decagon.
  const decagon = cap.decagon;
  const idxA = decagon.findIndex((v) => approxEqual(v, triOuter[0]!));
  const idxB = decagon.findIndex((v) => approxEqual(v, triOuter[1]!));
  if (idxA < 0 || idxB < 0) {
    throw new Error('gyratePentagonalCap: triangle outer not in decagon');
  }
  // The two should be adjacent in the decagon (the triangle's outer edge).
  const adjacent =
    (idxA + 1) % 10 === idxB || (idxB + 1) % 10 === idxA;
  if (!adjacent) {
    throw new Error('gyratePentagonalCap: triangle outer vertices not adjacent in decagon');
  }
  // Choose the index whose successor in the decagon is the other triangle outer.
  const triEdgeStart = (idxA + 1) % 10 === idxB ? idxA : idxB;

  // augmentWithCupola anchors bot[0] = host.vertices[0]. Its triangle 0 spans
  // bot[0]..bot[1]. So for ortho (original) orientation, host.vertices should
  // start at triEdgeStart. For gyro, shift by +1.
  const ortho: Vec3[] = [];
  for (let i = 0; i < 10; i++) {
    ortho.push(decagon[(triEdgeStart + i) % 10]!);
  }
  const gyro: Vec3[] = [];
  for (let i = 0; i < 10; i++) {
    gyro.push(ortho[(i + 1) % 10]!);
  }

  // Build the new face list: keep non-cap faces, add the gyrated cupola.
  // We use the existing augmentWithCupola flow by adding the decagonal face
  // then augmenting; but doing so risks renumbering. Instead, construct the
  // gyro cupola inline (parallels augmentWithCupola but with the chosen anchor).
  const out: Face[] = [];
  const id = { value: 0 };
  for (const f of faces) {
    if (capIds.has(f.id)) continue;
    out.push({ id: id.value++, vertices: f.vertices, normal: f.normal });
  }

  // Build the cupola from the gyro decagon as the base.
  attachCupolaOnDecagon(out, gyro, id);
  return out;
}

/**
 * Construct a pentagonal cupola anchored on the given decagonal vertex ring
 * (length 10, CCW), and append the 1 ⬠ + 5 △ + 5 □ cap faces to `out`. The
 * decagon's own face is NOT added — it is consumed as the interior bottom of
 * the cupola.
 *
 * Equivalent to invoking `augmentWithCupola` on a temporarily-inserted
 * decagonal face, but without the renumbering overhead.
 */
function attachCupolaOnDecagon(
  out: Face[],
  decagon: Vec3[],
  idRef: { value: number },
): void {
  if (decagon.length !== 10) {
    throw new Error('attachCupolaOnDecagon: decagon must have 10 vertices');
  }

  const e = norm(sub(decagon[1]!, decagon[0]!));
  const n = 5;
  const twoN = 10;
  const rTop = e / (2 * Math.sin(Math.PI / n));
  const rBot = e / (2 * Math.sin(Math.PI / twoN));
  const apothemDiff =
    rBot * Math.cos(Math.PI / twoN) - rTop * Math.cos(Math.PI / n);
  const h2 = e * e - apothemDiff * apothemDiff;
  if (h2 <= 0) {
    throw new Error('attachCupolaOnDecagon: degenerate cupola height');
  }
  const h = Math.sqrt(h2);

  const center = mean(decagon);
  // Decagon outward normal (away from the polyhedron centroid at origin).
  const v01 = sub(decagon[1]!, decagon[0]!);
  const v02 = sub(decagon[2]!, decagon[0]!);
  let normal = normalize(cross(v01, v02));
  // The decagon was extracted as a hole in a convex polyhedron centered at
  // origin: its outward normal points away from origin.
  if (
    normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2] < 0
  ) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }

  const e1 = normalize(sub(decagon[0]!, center));
  const e2 = normalize(cross(normal, e1));

  const top: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((4 * i + 1) * Math.PI) / (2 * n);
    const c = Math.cos(t) * rTop;
    const s = Math.sin(t) * rTop;
    top.push([
      center[0] + c * e1[0] + s * e2[0] + h * normal[0],
      center[1] + c * e1[1] + s * e2[1] + h * normal[1],
      center[2] + c * e1[2] + s * e2[2] + h * normal[2],
    ]);
  }

  out.push(makeFace(idRef.value++, [...top]));

  const bot = decagon;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = (2 * i) % twoN;
    const b = (a + 1) % twoN;
    const c = (a + 2) % twoN;
    out.push(makeFace(idRef.value++, [top[i]!, bot[a]!, bot[b]!]));
    out.push(
      makeFace(idRef.value++, [top[i]!, top[j]!, bot[c]!, bot[b]!]),
    );
  }
}
