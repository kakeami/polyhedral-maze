/** 2D vector type. */
export type Vec2 = [number, number];

export function add2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

export function scale2(v: Vec2, s: number): Vec2 {
  return [v[0] * s, v[1] * s];
}

export function len2(v: Vec2): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function dot2(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function centroid2(pts: Vec2[]): Vec2 {
  let sx = 0, sy = 0;
  for (const p of pts) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / pts.length, sy / pts.length];
}

export function midpoint2(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
