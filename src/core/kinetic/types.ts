import type { Vec3 } from '../types.ts';

/** Row-major 3x3 matrix. Only rigid rotations are used. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

/** Rigid placement of one piece: world = rot * body + offset. */
export interface Placement {
  readonly rot: Mat3;
  readonly offset: Vec3;
}

/** One configuration a hand can put the mechanism into: a placement per piece. */
export type KineticState = readonly Placement[];

/**
 * A maze cell, as a polygon on the surface of one rigid piece.
 * Corners are in the piece's own (body) frame, ordered around the polygon;
 * side i is the segment from corner i to corner i+1.
 */
export interface KineticCell {
  readonly piece: number;
  readonly corners: readonly Vec3[];
}

/**
 * A mechanism is nothing more than rigid pieces plus the configurations they
 * can be put in. Every derived structure — which cells touch, which openings
 * are forced to agree, how many passages a state has — comes out of these two
 * by geometry alone, so a new mechanism needs no new graph code.
 */
export interface Mechanism {
  readonly id: string;
  readonly pieceCount: number;
  readonly cells: readonly KineticCell[];
  readonly states: readonly KineticState[];
  /** Short human-facing label for a state, e.g. the stack's ring offsets. */
  stateLabel(index: number): string;
}

export function applyPlacement(p: Placement, v: Vec3): Vec3 {
  const { rot, offset } = p;
  return [
    rot[0][0] * v[0] + rot[0][1] * v[1] + rot[0][2] * v[2] + offset[0],
    rot[1][0] * v[0] + rot[1][1] * v[1] + rot[1][2] * v[2] + offset[1],
    rot[2][0] * v[0] + rot[2][1] * v[1] + rot[2][2] * v[2] + offset[2],
  ];
}

/** Rotation about +z by `angle` radians. */
export function rotZ(angle: number): Mat3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

export const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
