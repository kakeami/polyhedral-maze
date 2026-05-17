import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { makeFace } from '../archimedean/_utils.ts';

function makeTriaugmentedTriangularPrismFaces(): Face[] {
  // Unit-edge triangular prism: equilateral triangle of edge 1 has circumradius
  // 1/√3. Top z = +1/2, bottom z = −1/2 → lateral edges = 1.
  const r = 1 / Math.sqrt(3);
  const top: Vec3[] = [];
  const bot: Vec3[] = [];
  for (let i = 0; i < 3; i++) {
    const t = (2 * Math.PI * i) / 3;
    top.push([r * Math.cos(t), r * Math.sin(t), 0.5]);
    bot.push([r * Math.cos(t), r * Math.sin(t), -0.5]);
  }

  // Each square face is augmented by a square pyramid (unit edge → apex offset
  // h = 1/√2 along the outward face normal). Face i lies between top[i],top[i+1]
  // and bot[i],bot[i+1]; its centroid is at (rx, ry, 0) where rx,ry is the
  // midpoint of top[i] and top[i+1]. Outward direction is the radial unit
  // vector at that midpoint.
  const midR = 1 / (2 * Math.sqrt(3)); // |midpoint of top edge| in xy
  const apexR = midR + 1 / Math.SQRT2;  // distance from axis to pyramid apex
  const apex: Vec3[] = [];
  for (let i = 0; i < 3; i++) {
    const t = (2 * Math.PI * i) / 3 + Math.PI / 3; // bisector angle
    apex.push([apexR * Math.cos(t), apexR * Math.sin(t), 0]);
  }

  const faces: Face[] = [];
  let id = 0;

  // Top and bottom equilateral triangles
  faces.push(makeFace(id++, [top[0]!, top[1]!, top[2]!]));
  faces.push(makeFace(id++, [bot[0]!, bot[1]!, bot[2]!]));

  // Each square face → 4 triangles meeting at apex[i]
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const ti = top[i]!, tj = top[j]!;
    const bi = bot[i]!, bj = bot[j]!;
    const ax = apex[i]!;
    faces.push(makeFace(id++, [ti, tj, ax])); // top edge
    faces.push(makeFace(id++, [tj, bj, ax])); // right lateral
    faces.push(makeFace(id++, [bj, bi, ax])); // bottom edge
    faces.push(makeFace(id++, [bi, ti, ax])); // left lateral
  }
  return faces;
}

/**
 * Triaugmented Triangular Prism (J51, deltahedron #6).
 * 14 equilateral-triangle faces, 9 vertices, 21 edges.
 * D_3h symmetry, no central inversion → no antipodal faces.
 */
export class TriaugmentedTriangularPrism implements Polyhedron {
  private _faces = normalizeFaces(makeTriaugmentedTriangularPrismFaces(), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new TriGrid(face, n);
  }
}
