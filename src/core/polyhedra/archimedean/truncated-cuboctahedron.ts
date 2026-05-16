import type { Face, Vec3, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { HexGrid } from '../grids/hex-grid.ts';
import { OctGrid } from '../grids/oct-grid.ts';
import { buildOrderedFace } from './_utils.ts';

/**
 * Truncated Cuboctahedron (a.k.a. great rhombicuboctahedron):
 * 12 squares + 8 hexagons + 6 octagons = 26 faces.
 *
 * Built directly from canonical Cartesian coordinates — the 48 even
 * permutations of (±1, ±(1+√2), ±(1+2√2)). Uniform truncation of a
 * cuboctahedron does NOT yield equal edge lengths, so we use the canonical
 * form to obtain the strict Archimedean shape.
 *
 * Face classification (each vertex belongs to exactly one of each type):
 *   - Octagon: cube face direction (axis with max |coord|, signed)
 *   - Hexagon: cube vertex direction (signs of all 3 coords)
 *   - Square:  cube edge direction (axis with min |coord|, signs of others)
 */
function makeFaces(): Face[] {
  const a = 1 + 2 * Math.sqrt(2);   // outer
  const b = 1 + Math.sqrt(2);       // middle
  const c = 1;                       // inner
  const mags = [a, b, c];

  const positionPerms: [number, number, number][] = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];

  const V: Vec3[] = [];
  for (const [px, py, pz] of positionPerms) {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          V.push([sx * mags[px]!, sy * mags[py]!, sz * mags[pz]!]);
        }
      }
    }
  }

  const octGroups = new Map<string, number[]>();
  const hexGroups = new Map<string, number[]>();
  const sqGroups = new Map<string, number[]>();

  for (let i = 0; i < V.length; i++) {
    const v = V[i]!;
    const absV: [number, number, number] = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
    const signV: [number, number, number] = [Math.sign(v[0]), Math.sign(v[1]), Math.sign(v[2])];

    let maxAxis = 0;
    let minAxis = 0;
    for (let ax = 1; ax < 3; ax++) {
      if (absV[ax]! > absV[maxAxis]!) maxAxis = ax;
      if (absV[ax]! < absV[minAxis]!) minAxis = ax;
    }

    const octKey = `${maxAxis}:${signV[maxAxis]}`;
    const hexKey = signV.join(',');
    const otherAxes = [0, 1, 2].filter((ax) => ax !== minAxis);
    const sqKey = `${minAxis}:${signV[otherAxes[0]!]},${signV[otherAxes[1]!]}`;

    if (!octGroups.has(octKey)) octGroups.set(octKey, []);
    octGroups.get(octKey)!.push(i);
    if (!hexGroups.has(hexKey)) hexGroups.set(hexKey, []);
    hexGroups.get(hexKey)!.push(i);
    if (!sqGroups.has(sqKey)) sqGroups.set(sqKey, []);
    sqGroups.get(sqKey)!.push(i);
  }

  const faces: Face[] = [];
  let nextId = 0;
  for (const verts of octGroups.values()) {
    faces.push(buildOrderedFace(V, verts, nextId++));
  }
  for (const verts of hexGroups.values()) {
    faces.push(buildOrderedFace(V, verts, nextId++));
  }
  for (const verts of sqGroups.values()) {
    faces.push(buildOrderedFace(V, verts, nextId++));
  }

  return faces;
}

export class TruncatedCuboctahedron implements Polyhedron {
  private _faces = makeFaces();

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    if (face.vertices.length === 4) return new RectGrid(face, n);
    if (face.vertices.length === 6) return new HexGrid(face, n);
    return new OctGrid(face, n);
  }
}
