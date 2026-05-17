import type { Face, Vec3 } from '../../types.ts';
import { cross, mean, norm, normalize, sub } from '../../vec3.ts';
import { sharedEdgeVertices } from '../../polyhedron.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * BFS distance from `fromFaceId` to every other face in the face-adjacency
 * graph (faces sharing an edge). Used by augmented Dodecahedra / Truncated
 * solids to pick host faces by topological relationship: distance 1 = ortho,
 * 2 = meta, 3 = para (for the regular dodecahedron, where the para face is
 * also the antipode).
 */
export function faceDistancesFrom(
  faces: Face[],
  fromFaceId: number,
): Map<number, number> {
  const adj = new Map<number, number[]>();
  for (const f of faces) adj.set(f.id, []);
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      if (sharedEdgeVertices(faces[i]!, faces[j]!)) {
        adj.get(faces[i]!.id)!.push(faces[j]!.id);
        adj.get(faces[j]!.id)!.push(faces[i]!.id);
      }
    }
  }
  const dist = new Map<number, number>([[fromFaceId, 0]]);
  const queue: number[] = [fromFaceId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur)!) {
      if (!dist.has(next)) {
        dist.set(next, dist.get(cur)! + 1);
        queue.push(next);
      }
    }
  }
  return dist;
}

/**
 * Pick one face id from `faces` whose BFS distance to `from` equals `d` and
 * whose distance to each id in `also` also equals `d`. Useful when picking
 * a third (or fourth) host for triaugmented variants where every pair must
 * be at the same topological distance.
 *
 * If `polygonSize` is given, only faces of that polygon size are considered —
 * helpful in mixed-polygon hosts (e.g. truncated solids) where we want to
 * restrict candidates to the large augmentable polygon.
 *
 * Returns -1 if no candidate exists.
 */
export function findFaceAtDistance(
  faces: Face[],
  from: number,
  d: number,
  also: number[] = [],
  polygonSize?: number,
): number {
  const distFrom = faceDistancesFrom(faces, from);
  const distAlso = also.map((a) => faceDistancesFrom(faces, a));
  for (const f of faces) {
    if (f.id === from) continue;
    if (also.includes(f.id)) continue;
    if (polygonSize !== undefined && f.vertices.length !== polygonSize) continue;
    if (distFrom.get(f.id) !== d) continue;
    if (distAlso.every((m, i) => m.get(f.id) === d || also[i] === f.id)) {
      return f.id;
    }
  }
  return -1;
}

export type AugmentCap = 'pyramid' | 'cupola';

function sameVertexSet(a: Vec3[], b: Vec3[], atol = 1e-9): boolean {
  if (a.length !== b.length) return false;
  const used = new Array<boolean>(b.length).fill(false);
  for (const va of a) {
    let matched = false;
    for (let j = 0; j < b.length; j++) {
      if (used[j]) continue;
      const vb = b[j]!;
      if (
        Math.abs(va[0] - vb[0]) < atol &&
        Math.abs(va[1] - vb[1]) < atol &&
        Math.abs(va[2] - vb[2]) < atol
      ) {
        used[j] = true;
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

/**
 * Augment several host faces in sequence. Host face ids reference the *input*
 * face list; after each augment the face list is renumbered, so we capture the
 * host vertices up front and re-find each host by vertex set before applying
 * the next operation.
 */
export function augmentFaces(
  faces: Face[],
  hostFaceIds: number[],
  cap: AugmentCap,
): Face[] {
  const hostVerts: Vec3[][] = hostFaceIds.map((id) => {
    const f = faces.find((x) => x.id === id);
    if (!f) throw new Error(`augmentFaces: face ${id} not found`);
    return f.vertices;
  });
  let current = faces;
  for (const hv of hostVerts) {
    const target = current.find((f) => sameVertexSet(f.vertices, hv));
    if (!target) {
      throw new Error('augmentFaces: lost track of host face after augment');
    }
    current = cap === 'pyramid'
      ? augmentWithPyramid(current, target.id)
      : augmentWithCupola(current, target.id);
  }
  return current;
}

function findHost(faces: Face[], hostFaceId: number): Face {
  const host = faces.find((f) => f.id === hostFaceId);
  if (!host) {
    throw new Error(`augment: face ${hostFaceId} not found`);
  }
  return host;
}

function withoutHost(faces: Face[], hostFaceId: number, id: { value: number }): Face[] {
  const result: Face[] = [];
  for (const f of faces) {
    if (f.id === hostFaceId) continue;
    result.push({ id: id.value++, vertices: f.vertices, normal: f.normal });
  }
  return result;
}

/**
 * Cap a regular n-gon face (n = 3, 4, 5) with an n-pyramid whose lateral
 * edges match the host face's edge length. The host face is removed and
 * replaced with n lateral triangles meeting at an apex displaced by
 * `h · host.normal` from the host centroid, where h² = e² − r² and
 * r = e / (2 · sin(π/n)) with e = host edge length.
 *
 * The host face must be a regular n-gon, but it need not have unit edges;
 * the cap geometry rescales so all new edges equal the host's edge length.
 *
 * Returns a fresh face list with contiguous ids reassigned from 0.
 */
export function augmentWithPyramid(faces: Face[], hostFaceId: number): Face[] {
  const host = findHost(faces, hostFaceId);
  const n = host.vertices.length;
  if (n !== 3 && n !== 4 && n !== 5) {
    throw new Error(`augmentWithPyramid: host must be 3/4/5-gon (got ${n})`);
  }
  const e = norm(sub(host.vertices[1]!, host.vertices[0]!));
  const r = e / (2 * Math.sin(Math.PI / n));
  const h2 = e * e - r * r;
  if (h2 <= 0) {
    throw new Error(`augmentWithPyramid: degenerate height for n=${n}`);
  }
  const h = Math.sqrt(h2);

  const center = mean(host.vertices);
  const apex: Vec3 = [
    center[0] + h * host.normal[0],
    center[1] + h * host.normal[1],
    center[2] + h * host.normal[2],
  ];

  const id = { value: 0 };
  const result = withoutHost(faces, hostFaceId, id);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    result.push(
      makeFace(id.value++, [apex, host.vertices[i]!, host.vertices[j]!]),
    );
  }
  return result;
}

/**
 * Cap a regular 2n-gon face (n = 3, 4, 5) with an n-cupola whose edges match
 * the host face's edge length. The host face becomes the bottom 2n-gon of
 * the cupola: it is removed and replaced with 1 top n-gon + n lateral
 * triangles + n lateral squares.
 *
 * The top n-gon vertices are placed in the host's plane shifted by
 * `h · host.normal`. Azimuth is anchored to host.vertices[0], matching the
 * convention in `cupolaVertices` (bot[0] at angle 0, top[i] at angle
 * (4i+1)·π/(2n)).
 *
 * The host face must be a regular 2n-gon, but it need not have unit edges;
 * all cap dimensions rescale to match the host's edge length.
 */
export function augmentWithCupola(faces: Face[], hostFaceId: number): Face[] {
  const host = findHost(faces, hostFaceId);
  const twoN = host.vertices.length;
  if (twoN !== 6 && twoN !== 8 && twoN !== 10) {
    throw new Error(`augmentWithCupola: host must be 6/8/10-gon (got ${twoN})`);
  }
  const n = (twoN / 2) as 3 | 4 | 5;

  const e = norm(sub(host.vertices[1]!, host.vertices[0]!));
  const rTop = e / (2 * Math.sin(Math.PI / n));
  const rBot = e / (2 * Math.sin(Math.PI / (2 * n)));
  const apothemDiff =
    rBot * Math.cos(Math.PI / (2 * n)) - rTop * Math.cos(Math.PI / n);
  const h2 = e * e - apothemDiff * apothemDiff;
  if (h2 <= 0) {
    throw new Error(`augmentWithCupola: degenerate height for n=${n}`);
  }
  const h = Math.sqrt(h2);

  const center = mean(host.vertices);
  // Anchor (e1, e2) to host.vertices[0]: bot[0] sits at angle 0 in this frame,
  // matching cupolaVertices' convention.
  const e1 = normalize(sub(host.vertices[0]!, center));
  const e2 = normalize(cross(host.normal, e1));

  const top: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((4 * i + 1) * Math.PI) / (2 * n);
    const c = Math.cos(t) * rTop;
    const s = Math.sin(t) * rTop;
    top.push([
      center[0] + c * e1[0] + s * e2[0] + h * host.normal[0],
      center[1] + c * e1[1] + s * e2[1] + h * host.normal[1],
      center[2] + c * e1[2] + s * e2[2] + h * host.normal[2],
    ]);
  }

  const id = { value: 0 };
  const result = withoutHost(faces, hostFaceId, id);

  result.push(makeFace(id.value++, [...top]));

  const bot = host.vertices;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = (2 * i) % twoN;
    const b = (a + 1) % twoN;
    const c = (a + 2) % twoN;
    result.push(makeFace(id.value++, [top[i]!, bot[a]!, bot[b]!]));
    result.push(
      makeFace(id.value++, [top[i]!, top[j]!, bot[c]!, bot[b]!]),
    );
  }

  return result;
}
