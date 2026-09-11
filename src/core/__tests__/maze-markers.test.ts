/**
 * Start / goal / warp are drawn in the 3D scene as pins: a dot on the marked
 * cell, a stem up the face normal, a head floating clear of the maze. The
 * geometry layer owes the scene exactly two things for that — the point and
 * the direction — and both have to be right, or the pin buries itself in the
 * solid or points at the wrong cell.
 */
import { describe, it, expect } from 'vitest';
import { cellVertices3d, computeRenderData } from '../../render/maze-geometry.ts';
import { MAZE_STYLE } from '../../render/scene-constants.ts';
import { MazeGraph } from '../maze-graph.ts';
import { generate } from '../maze.ts';
import { createRng } from '../prng.ts';
import { getShape } from '../polyhedra/registry.ts';
import { parseCell } from '../types.ts';
import { add, sub, cross, dot, norm, scale } from '../vec3.ts';
import type { CellKey, Vec3 } from '../types.ts';

function build(shapeId: string, n = 6, warp = true) {
  const polyhedron = getShape(shapeId)!.factory();
  const mg = new MazeGraph(polyhedron, n, 2);
  mg.build();
  const maze = generate(mg, { algorithm: 'DFS', warp, rng: createRng(11) });
  return { polyhedron, mg, maze, data: computeRenderData(mg, maze, false) };
}

/** Signed distance from `p` to the polygon's plane, positive in front of it. */
function distanceToPlane(p: Vec3, poly: Vec3[], normal: Vec3): number {
  return dot(sub(p, poly[0]!), normal);
}

/** The marked cells in the order `computeRenderData` reports its markers. */
function markedCells(maze: { start: string; goal: string; warp: { cellA: string; cellB: string } | null }) {
  const cells = [maze.start, maze.goal];
  if (maze.warp) cells.push(maze.warp.cellA, maze.warp.cellB);
  return cells as CellKey[];
}

const SHAPES = ['tetrahedron', 'icosahedron', 'truncated-icosahedron', 'square-torus'];

describe('marker pins', () => {
  it.each(SHAPES)('%s: one marker per marked cell', id => {
    const { maze, data } = build(id);
    // A tetrahedron's warp can come out unplaceable; the pair is all or nothing.
    expect(data.markers.map(m => m.kind)).toEqual(
      maze.warp ? ['start', 'goal', 'warp', 'warp'] : ['start', 'goal'],
    );

    const { data: noWarp } = build(id, 6, false);
    expect(noWarp.markers.map(m => m.kind)).toEqual(['start', 'goal']);
  });

  it('marks both ends of a warp', () => {
    const { maze, data } = build('icosahedron');
    expect(maze.warp).not.toBeNull();
    expect(data.markers.filter(m => m.kind === 'warp').length).toBe(2);
  });

  it.each(SHAPES)('%s: the foot sits in the cell it marks', id => {
    const { mg, maze, data } = build(id);
    const cells = markedCells(maze);
    const faces = mg.polyhedron.faces();

    data.markers.forEach((marker, i) => {
      const cell = cells[i]!;
      const face = faces.find(f => f.id === parseCell(cell).faceId)!;
      const verts = cellVertices3d(face, cell, mg.n, mg.grids.get(face.id)!.kind);

      // On the cell's plane...
      expect(distanceToPlane(marker.at, verts, marker.normal)).toBeCloseTo(0, 9);
      // ...and inside it: the same side of every edge, walking the polygon.
      for (let k = 0; k < verts.length; k++) {
        const a = verts[k]!, b = verts[(k + 1) % verts.length]!;
        const side = dot(cross(sub(b, a), sub(marker.at, a)), marker.normal);
        expect(side).toBeGreaterThan(0);
      }
    });
  });

  it.each(SHAPES)('%s: the stem stands normal to the face', id => {
    const { mg, maze, data } = build(id);
    const cells = markedCells(maze);
    const faces = mg.polyhedron.faces();

    data.markers.forEach((marker, i) => {
      expect(norm(marker.normal)).toBeCloseTo(1, 9);
      // Perpendicular to every edge of its own face, so the pin reads as a
      // plumb line to the surface rather than a lean.
      const face = faces.find(f => f.id === parseCell(cells[i]!).faceId)!;
      for (let k = 0; k < face.vertices.length; k++) {
        const edge = sub(face.vertices[(k + 1) % face.vertices.length]!, face.vertices[k]!);
        expect(Math.abs(dot(marker.normal, edge))).toBeLessThan(1e-9);
      }
    });
  });

  it.each(['tetrahedron', 'icosahedron', 'truncated-icosahedron'])(
    '%s: the head floats outside the solid', id => {
      const { mg, data } = build(id);
      const faces = mg.polyhedron.faces();
      const { pinLength } = MAZE_STYLE.markers;

      for (const marker of data.markers) {
        const head = add(marker.at, scale(marker.normal, pinLength));
        // Outside a convex solid means in front of at least one face plane —
        // an inward normal would put the head in front of none of them.
        const outside = faces.some(f => distanceToPlane(head, f.vertices, f.normal) > 1e-9);
        expect(outside).toBe(true);
        // And clear of the surface by the full pin length, not less.
        expect(norm(head)).toBeGreaterThan(norm(marker.at));
      }
    },
  );
});
