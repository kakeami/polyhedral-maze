import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { sub, cross, normalize, dot, mean } from '../../vec3.ts';

/**
 * Attach a unit-edge regular n-antiprism to the host face (regular n-gon).
 *
 * - The host n-gon is removed (internal interface to the antiprism's top).
 * - A copy of the host vertices rotated by π/n about the host normal axis and
 *   translated by `+host.normal · h` (with h chosen for unit lateral edges)
 *   forms the antiprism's outer n-gon.
 * - 2n triangles form the antiprism's lateral surface, alternating up/down.
 *
 * Returns a fresh `Face[]` with contiguous ids reassigned from 0.
 */
export function gyroelongate(faces: Face[], hostFaceId: number): Face[] {
  const host = faces.find((f) => f.id === hostFaceId);
  if (!host) {
    throw new Error(`gyroelongate: face ${hostFaceId} not found`);
  }

  const n = host.vertices.length;
  const r = 1 / (2 * Math.sin(Math.PI / n));
  const h2 = 1 - 2 * r * r * (1 - Math.cos(Math.PI / n));
  if (h2 <= 0) {
    throw new Error(`gyroelongate: degenerate antiprism for n=${n}`);
  }
  const h = Math.sqrt(h2);

  const centroid = mean(host.vertices);
  const nrm = host.normal;
  const e1 = normalize(sub(host.vertices[0]!, centroid));
  const e2 = cross(nrm, e1);

  const shifted: Vec3[] = host.vertices.map((v) => {
    const delta = sub(v, centroid);
    const x = dot(delta, e1);
    const y = dot(delta, e2);
    const alpha = Math.atan2(y, x);
    const rad = Math.hypot(x, y);
    const beta = alpha + Math.PI / n;
    const nx = rad * Math.cos(beta);
    const ny = rad * Math.sin(beta);
    return [
      centroid[0] + nx * e1[0] + ny * e2[0] + h * nrm[0],
      centroid[1] + nx * e1[1] + ny * e2[1] + h * nrm[1],
      centroid[2] + nx * e1[2] + ny * e2[2] + h * nrm[2],
    ] as Vec3;
  });

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
      makeFace(id.value++, [host.vertices[i]!, host.vertices[j]!, shifted[i]!]),
    );
    result.push(
      makeFace(id.value++, [shifted[i]!, shifted[j]!, host.vertices[j]!]),
    );
  }

  return result;
}
