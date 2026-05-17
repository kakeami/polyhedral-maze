import type { Face, Vec3 } from '../../types.ts';
import { Rhombicosidodecahedron } from '../archimedean/rhombicosidodecahedron.ts';
import { diminishPentagonalCap, gyratePentagonalCap } from './_diminish.ts';

const VERTEX_TOL = 1e-6;

function approxEqual(a: Vec3, b: Vec3, tol = VERTEX_TOL): boolean {
  return (
    Math.abs(a[0] - b[0]) < tol &&
    Math.abs(a[1] - b[1]) < tol &&
    Math.abs(a[2] - b[2]) < tol
  );
}

function sameVertexSet(a: Vec3[], b: Vec3[], tol = VERTEX_TOL): boolean {
  if (a.length !== b.length) return false;
  const used = new Array<boolean>(b.length).fill(false);
  for (const va of a) {
    let matched = false;
    for (let j = 0; j < b.length; j++) {
      if (used[j]) continue;
      if (approxEqual(va, b[j]!, tol)) {
        used[j] = true;
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

export type RhombicosiOp =
  | { kind: 'gyrate'; pentagonIndex: number }
  | { kind: 'diminish'; pentagonIndex: number };

/**
 * Build a modified rhombicosidodecahedron by applying a sequence of gyrate /
 * diminish operations to selected pentagonal faces. Each `pentagonIndex` (0-11)
 * refers to the corresponding face of the underlying dodecahedron, in the
 * order produced by Rhombicosidodecahedron's cantellation pipeline (cap faces
 * are emitted in dodecahedron face order, then squares, then triangles).
 *
 * Pentagons are identified by their vertex set (captured up front before
 * any face renumbering), so the operations can be applied in any order.
 */
export function buildRhombicosiMod(ops: RhombicosiOp[]): Face[] {
  let current = new Rhombicosidodecahedron().faces();

  // Capture initial pentagon vertex sets (face ids 0-11 are pentagons).
  const targetVerts: Vec3[][] = ops.map((op) => {
    const pent = current.find((f) => f.id === op.pentagonIndex);
    if (!pent) {
      throw new Error(
        `buildRhombicosiMod: pentagon ${op.pentagonIndex} not found`,
      );
    }
    if (pent.vertices.length !== 5) {
      throw new Error(
        `buildRhombicosiMod: face ${op.pentagonIndex} is not a pentagon (${pent.vertices.length}-gon)`,
      );
    }
    return pent.vertices.map((v) => [...v] as Vec3);
  });

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    const target = targetVerts[i]!;
    const face = current.find((f) => sameVertexSet(f.vertices, target));
    if (!face) {
      throw new Error(
        `buildRhombicosiMod: pentagon for op ${i} (kind=${op.kind}) lost`,
      );
    }
    current = op.kind === 'gyrate'
      ? gyratePentagonalCap(current, face.id)
      : diminishPentagonalCap(current, face.id);
  }
  return current;
}
