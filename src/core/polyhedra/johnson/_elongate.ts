import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * Attach a unit-height regular prism to the host face of an existing
 * polyhedron face list.
 *
 * - The host n-gon is removed (it becomes the internal interface between the
 *   original polyhedron and the prism).
 * - A copy of the host vertices is translated by `+host.normal` to form the
 *   prism's outer face.
 * - n rectangular side faces connect the original host edge to the shifted
 *   copy.
 *
 * The host face must be an equilateral n-gon (edges of length 1) for the
 * resulting prism to be unit-edge.
 *
 * Returns a fresh `Face[]` with contiguous ids reassigned from 0.
 */
export function elongate(faces: Face[], hostFaceId: number): Face[] {
  const host = faces.find((f) => f.id === hostFaceId);
  if (!host) {
    throw new Error(`elongate: face ${hostFaceId} not found`);
  }

  const n = host.vertices.length;
  const dir = host.normal;
  const shifted: Vec3[] = host.vertices.map(
    (v) => [v[0] + dir[0], v[1] + dir[1], v[2] + dir[2]] as Vec3,
  );

  const result: Face[] = [];
  const id = { value: 0 };

  for (const f of faces) {
    if (f.id === hostFaceId) continue;
    result.push({ id: id.value++, vertices: f.vertices, normal: f.normal });
  }

  result.push(makeFace(id.value++, [...shifted]));

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    result.push(
      makeFace(id.value++, [
        host.vertices[i]!,
        host.vertices[j]!,
        shifted[j]!,
        shifted[i]!,
      ]),
    );
  }

  return result;
}
