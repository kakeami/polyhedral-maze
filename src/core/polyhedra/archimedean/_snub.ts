import type { Face, Vec3 } from '../../types.ts';
import { sub, scale, dot, cross, normalize, mean, norm } from '../../vec3.ts';
import { makeFace, orientCCW } from './_utils.ts';

/**
 * Apply the snub operation to a regular polyhedron.
 *
 * Each face F of the original is shrunk by factor s and rotated by angle θ
 * around its outward normal. The gaps between rotated faces are filled by:
 *   - 2 triangles per original edge (chirally split)
 *   - 1 polygon per original vertex (a triangle when valence m = 3)
 *
 * Examples:
 * - snub(cube)         ≡ Snub cube (6 squares + 32 triangles, 24 vertices)
 * - snub(dodecahedron) ≡ Snub dodecahedron (12 pentagons + 80 triangles, 60 vertices)
 *
 * Chirality:
 * - 'right': diagonal of each edge-band runs p(F, v) → p(F', u) where v→u is
 *   the CCW direction of the edge in face F. This is the conventional
 *   right-handed snub.
 * - 'left':  the opposite diagonal.
 *
 * The pair (θ, s) is solved numerically so all edges of the resulting
 * polyhedron are equal in length.
 */
export function snub(
  V: Vec3[],
  F: number[][],
  chirality: 'right' | 'left' = 'right',
): Face[] {
  if (F.length === 0) return [];

  const Fn = F.map((face) => orientCCW(V, face));

  // Face centroids and outward normals.
  const centroids: Vec3[] = Fn.map((face) =>
    mean(face.map((i) => V[i]!)),
  );
  const normals: Vec3[] = Fn.map((face) => {
    const a = V[face[0]!]!;
    const b = V[face[1]!]!;
    const c = V[face[2]!]!;
    const n = normalize(cross(sub(b, a), sub(c, a)));
    // Flip if pointing inward.
    return dot(n, centroids[Fn.indexOf(face)]!) < 0 ? scale(n, -1) : n;
  });

  // Edge → adjacent face indices.
  const edgeKey = (a: number, b: number): string =>
    a < b ? `${a}:${b}` : `${b}:${a}`;
  const edgeToFaces = new Map<string, number[]>();
  for (let f = 0; f < Fn.length; f++) {
    const face = Fn[f]!;
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      const key = edgeKey(a, b);
      if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
      edgeToFaces.get(key)!.push(f);
    }
  }

  // L_orig: edge length of the original polyhedron.
  const L = norm(sub(V[Fn[0]![0]!]!, V[Fn[0]![1]!]!));

  // Compute new vertex position for (face f, original vertex v ∈ face f)
  // given (s, θ). Rotation is around face normal n_f, with sign by chirality.
  const sign = chirality === 'right' ? 1 : -1;
  const newPos = (f: number, v: number, s: number, theta: number): Vec3 => {
    const c = centroids[f]!;
    const n = normals[f]!;
    const r = sub(V[v]!, c);
    // Rodrigues rotation: r_rot = r·cos + (n × r)·sin + n·(n·r)·(1-cos).
    // Sign of θ determined by chirality.
    const ang = sign * theta;
    const cosT = Math.cos(ang);
    const sinT = Math.sin(ang);
    const k = cross(n, r);
    const ndr = dot(n, r);
    const oneMinus = 1 - cosT;
    const rRot: Vec3 = [
      r[0] * cosT + k[0] * sinT + n[0] * ndr * oneMinus,
      r[1] * cosT + k[1] * sinT + n[1] * ndr * oneMinus,
      r[2] * cosT + k[2] * sinT + n[2] * ndr * oneMinus,
    ];
    return [
      c[0] + s * rRot[0],
      c[1] + s * rRot[1],
      c[2] + s * rRot[2],
    ];
  };

  // Pick a representative edge {v, u} with adjacent faces (F, F'), where
  // CCW of F contains ..., v, u, ... .
  let probeEdge: { v: number; u: number; fA: number; fB: number } | null = null;
  for (const [key, faceList] of edgeToFaces) {
    if (faceList.length !== 2) continue;
    const [fA, fB] = faceList as [number, number];
    const [a, b] = key.split(':').map(Number) as [number, number];
    const faceA = Fn[fA]!;
    const ia = faceA.indexOf(a);
    const next = faceA[(ia + 1) % faceA.length]!;
    if (next === b) {
      probeEdge = { v: a, u: b, fA, fB };
    } else {
      probeEdge = { v: b, u: a, fA: fB, fB: fA };
    }
    break;
  }
  if (!probeEdge) throw new Error('snub: no manifold edge found');

  // Edge-length residuals as functions of (s, theta).
  // Target: |p(F,v) - p(F,u)| = |p(F,v) - p(F',v)| = |p(F,v) - p(F',u)|
  const sqDist = (a: Vec3, b: Vec3): number => {
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  };

  const lengths = (s: number, theta: number): [number, number, number] => {
    const { v, u, fA, fB } = probeEdge!;
    const pFv = newPos(fA, v, s, theta);
    const pFu = newPos(fA, u, s, theta);
    const pFprimeV = newPos(fB, v, s, theta);
    const pFprimeU = newPos(fB, u, s, theta);
    return [
      Math.sqrt(sqDist(pFv, pFu)),       // intra-face (= s · L_orig)
      Math.sqrt(sqDist(pFv, pFprimeV)),  // cross-band
      Math.sqrt(sqDist(pFv, pFprimeU)),  // diagonal
    ];
  };

  // Solve: find (s, θ) such that lengths[0] = lengths[1] = lengths[2].
  // Strategy: grid search over θ, for each θ pick s such that lengths[1] = lengths[0]
  // (i.e., cross-band = s·L), then minimize |lengths[2] - lengths[0]|.
  //
  // Note: lengths[0] = s · L_orig (linear in s). lengths[1] and lengths[2] are
  // not linear in s. We bisect on s for each θ.

  const solveSForTheta = (theta: number): number => {
    // Find s such that lengths[1] = s · L_orig (cross-band = intra-face).
    // Define g(s) = lengths[1](s, θ) - s · L. Look for g(s) = 0.
    const g = (s: number) => lengths(s, theta)[1] - s * L;
    // s in (0, 1). g(s small) ~ |p(F,v) - p(F',v)| at small s ~ |v - v| = 0... wait
    // at s=0, p(F,v) = c_F and p(F',v) = c_{F'}; so g(0) = |c_F - c_{F'}| > 0.
    // At s=1, theta=0: p(F,v) = v, p(F',v) = v, so g(1) = 0 - L = -L < 0.
    // → unique root in (0, 1) for theta small enough.
    let lo = 0.01, hi = 1.5;
    for (let iter = 0; iter < 80; iter++) {
      const mid = (lo + hi) / 2;
      if (g(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  let bestTheta = 0.2;
  let bestS = 0.5;
  let bestResidual = Infinity;
  const M = 800;
  for (let i = 1; i < M; i++) {
    const theta = (i / M) * (Math.PI / 3); // 0 < θ < 60°
    let s: number;
    try {
      s = solveSForTheta(theta);
    } catch {
      continue;
    }
    if (!isFinite(s) || s <= 0 || s >= 1.5) continue;
    const [a, , c] = lengths(s, theta);
    const r = Math.abs(c - a);
    if (r < bestResidual) {
      bestResidual = r;
      bestTheta = theta;
      bestS = s;
    }
  }

  // Refine with finer bisection on θ near bestTheta.
  const dθ = Math.PI / 3 / M;
  let lo = Math.max(0.001, bestTheta - dθ);
  let hi = Math.min(Math.PI / 2 - 0.001, bestTheta + dθ);
  for (let iter = 0; iter < 80; iter++) {
    const t1 = lo + (hi - lo) / 3;
    const t2 = hi - (hi - lo) / 3;
    const s1 = solveSForTheta(t1);
    const s2 = solveSForTheta(t2);
    const r1 = Math.abs(lengths(s1, t1)[2] - lengths(s1, t1)[0]);
    const r2 = Math.abs(lengths(s2, t2)[2] - lengths(s2, t2)[0]);
    if (r1 < r2) hi = t2;
    else lo = t1;
  }
  bestTheta = (lo + hi) / 2;
  bestS = solveSForTheta(bestTheta);

  const s = bestS;
  const theta = bestTheta;

  // Materialize new vertices: p(f, v) for each (face f, vertex v in f).
  const cornerIdx = new Map<string, number>();
  const newVerts: Vec3[] = [];
  const cornerKey = (f: number, v: number): string => `${f}:${v}`;

  for (let f = 0; f < Fn.length; f++) {
    for (const v of Fn[f]!) {
      const key = cornerKey(f, v);
      if (cornerIdx.has(key)) continue;
      cornerIdx.set(key, newVerts.length);
      newVerts.push(newPos(f, v, s, theta));
    }
  }

  const getP = (f: number, v: number): Vec3 =>
    newVerts[cornerIdx.get(cornerKey(f, v))!]!;

  const faces: Face[] = [];
  let nextId = 0;

  // 1. One n-gon per original face (rotated/shrunk copy).
  for (let f = 0; f < Fn.length; f++) {
    const ring = Fn[f]!.map((v) => getP(f, v));
    faces.push(makeFace(nextId++, ring));
  }

  // 2. Two triangles per original edge (with chiral diagonal).
  for (const [key, faceList] of edgeToFaces) {
    if (faceList.length !== 2) continue;
    const [fX, fY] = faceList as [number, number];
    const [a, b] = key.split(':').map(Number) as [number, number];

    // Identify which face has CCW direction v→u (=a→b or b→a).
    let fF: number, fFprime: number, v: number, u: number;
    const faceX = Fn[fX]!;
    const ia = faceX.indexOf(a);
    if (faceX[(ia + 1) % faceX.length] === b) {
      fF = fX; fFprime = fY; v = a; u = b;
    } else {
      fF = fY; fFprime = fX;
      const faceY = Fn[fY]!;
      const ja = faceY.indexOf(a);
      if (faceY[(ja + 1) % faceY.length] === b) {
        v = a; u = b;
      } else {
        v = b; u = a;
      }
    }

    // Diagonal: p(F, v) ↔ p(F', u) (right-handed convention).
    // For left-handed, swap diagonal: p(F, u) ↔ p(F', v).
    if (chirality === 'right') {
      const pFv = getP(fF, v);
      const pFu = getP(fF, u);
      const pFpV = getP(fFprime, v);
      const pFpU = getP(fFprime, u);
      faces.push(makeFace(nextId++, [pFv, pFu, pFpU]));
      faces.push(makeFace(nextId++, [pFv, pFpU, pFpV]));
    } else {
      const pFv = getP(fF, v);
      const pFu = getP(fF, u);
      const pFpV = getP(fFprime, v);
      const pFpU = getP(fFprime, u);
      faces.push(makeFace(nextId++, [pFu, pFpU, pFpV]));
      faces.push(makeFace(nextId++, [pFu, pFpV, pFv]));
    }
  }

  // 3. One polygon per original vertex: walk incident faces in cyclic order.
  for (let vv = 0; vv < V.length; vv++) {
    const incident: number[] = [];
    for (let f = 0; f < Fn.length; f++) {
      if (Fn[f]!.includes(vv)) incident.push(f);
    }
    if (incident.length === 0) continue;

    const ring: Vec3[] = [];
    const visited = new Set<number>();
    let curF = incident[0]!;
    while (!visited.has(curF)) {
      visited.add(curF);
      ring.push(getP(curF, vv));
      const face = Fn[curF]!;
      const k = face.length;
      const idx = face.indexOf(vv);
      const next = face[(idx + 1) % k]!;
      const sharing = edgeToFaces.get(edgeKey(vv, next))!;
      curF = sharing[0] === curF ? sharing[1]! : sharing[0]!;
    }
    faces.push(makeFace(nextId++, ring));
  }

  return faces;
}
