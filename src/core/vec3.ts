import type { Vec3 } from './types.ts';

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function norm(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function normalize(v: Vec3): Vec3 {
  const n = norm(v);
  if (n === 0) return [0, 0, 0];
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function allClose(a: Vec3, b: Vec3, atol = 1e-9): boolean {
  return (
    Math.abs(a[0] - b[0]) < atol &&
    Math.abs(a[1] - b[1]) < atol &&
    Math.abs(a[2] - b[2]) < atol
  );
}

export function mean(vecs: Vec3[]): Vec3 {
  const n = vecs.length;
  let x = 0, y = 0, z = 0;
  for (const v of vecs) {
    x += v[0];
    y += v[1];
    z += v[2];
  }
  return [x / n, y / n, z / n];
}

/**
 * Solve the least-squares 2-vector projection: find (a, b) such that
 * a*u + b*v ≈ p, via the normal equations for the 2×3 system [u|v]^T x = p.
 */
export function lstsq2(u: Vec3, v: Vec3, p: Vec3): [number, number] {
  const uu = dot(u, u);
  const uv = dot(u, v);
  const vv = dot(v, v);
  const up = dot(u, p);
  const vp = dot(v, p);

  const det = uu * vv - uv * uv;
  if (Math.abs(det) < 1e-15) {
    return [0, 0];
  }
  const a = (vv * up - uv * vp) / det;
  const b = (uu * vp - uv * up) / det;
  return [a, b];
}
