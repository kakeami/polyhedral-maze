import { describe, it, expect } from 'vitest';
import { createStack } from '../kinetic/mechanisms/stack.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { pickStartGoal, searchAllStates, stateStats } from '../kinetic/maze.ts';
import { applyPlacement } from '../kinetic/types.ts';
import { createRng } from '../prng.ts';
import {
  buildKineticPieces,
  cellCentre,
  cellNormal,
  kineticSolutionPath,
  modelBounds,
  solutionCells,
  solutionLength,
} from '../../render/kinetic-geometry.ts';

function fixture(options = {}) {
  const mech = createStack({ sides: 5, layers: 3, cols: 2, rows: 2, ...options });
  const surface = buildSurface(mech);
  const design = searchAllStates(surface, { rng: createRng(31) }).design;
  const ends = pickStartGoal(surface, design);
  return { mech, surface, design, ends };
}

describe('cell geometry', () => {
  it('puts the normal on the outside of the barrel', () => {
    const { mech } = fixture();
    for (const cell of mech.cells) {
      const centre = cellCentre(cell);
      const normal = cellNormal(cell);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 9);
      // Outward, for a stack, means a step along the normal takes you further
      // from the dowel. Not that the normal *is* radial: a cell sits off to
      // one side of its face, so the two directions differ by up to half a
      // face — which is exactly why the pins hang off the face normal and not
      // off the line from the axis.
      const here = Math.hypot(centre[0], centre[1]);
      const stepped = Math.hypot(centre[0] + normal[0] * 1e-3, centre[1] + normal[1] * 1e-3);
      expect(stepped).toBeGreaterThan(here);
      expect(normal[2]).toBeCloseTo(0, 9);
    }
  });

  it('measures the object in world coordinates', () => {
    const { mech } = fixture();
    const bounds = modelBounds(mech);
    expect(bounds.radius).toBeCloseTo(1, 9);
    expect(bounds.zMax).toBeGreaterThan(0);
    expect(bounds.zMin).toBeCloseTo(-bounds.zMax, 9);
  });
});

describe('buildKineticPieces', () => {
  it('gives every piece its own triangles, in its own frame', () => {
    const { mech, surface, design } = fixture();
    const pieces = buildKineticPieces(mech, surface, design);
    expect(pieces).toHaveLength(mech.pieceCount);

    const cellsPerPiece = mech.cells.filter(c => c.piece === 0).length;
    // Two triangles a quad, three vertices a triangle, three numbers a vertex.
    expect(pieces[0]!.positions).toHaveLength(cellsPerPiece * 2 * 3 * 3);
    expect(pieces[0]!.normals).toHaveLength(pieces[0]!.positions.length);

    // Body frames are centred on the piece, so every piece looks alike here;
    // it is the placement that puts them at different heights.
    for (const piece of pieces) {
      expect(piece.bounds.zMin).toBeCloseTo(pieces[0]!.bounds.zMin, 9);
      expect(piece.bounds.radius).toBeCloseTo(1, 9);
    }
  });

  it('draws a wall exactly where the printed pattern would', () => {
    const { mech, surface, design } = fixture();
    const pieces = buildKineticPieces(mech, surface, design);

    let expectedWalls = 0;
    const countedInternal = new Set<number>();
    mech.cells.forEach((cell, index) => {
      const base = surface.sideStart[index]!;
      for (let side = 0; side < cell.corners.length; side++) {
        const classId = surface.classOf[base + side]!;
        const kind = surface.classKind[classId]!;
        if (kind === 'rim' || design.open.has(classId)) continue;
        if (kind === 'internal') {
          if (countedInternal.has(classId)) continue;
          countedInternal.add(classId);
        }
        expectedWalls++;
      }
    });

    const drawn = pieces.reduce((n, p) => n + p.walls.length / 2, 0);
    expect(drawn).toBe(expectedWalls);
    for (const piece of pieces) expect(piece.walls.length % 2).toBe(0);
  });

  it('finds the free rim only at the two open ends', () => {
    const { mech, surface, design } = fixture();
    const pieces = buildKineticPieces(mech, surface, design);
    const rimSegments = pieces.map(p => p.rim.length / 2);
    // The barrel is open top and bottom; the rings in between have no free edge.
    expect(rimSegments[0]).toBe(mech.sides * mech.cols);
    expect(rimSegments[1]).toBe(0);
    expect(rimSegments[mech.layers - 1]).toBe(mech.sides * mech.cols);
  });

  it('hands the start and goal pins to the pieces that carry them', () => {
    const { mech, surface, design, ends } = fixture();
    const pieces = buildKineticPieces(mech, surface, design, ends);
    const markers = pieces.flatMap(p => p.markers);
    expect(markers.map(m => m.kind).sort()).toEqual(['goal', 'start']);

    const startPiece = mech.cells[ends.start]!.piece;
    expect(pieces[startPiece]!.markers.some(m => m.kind === 'start')).toBe(true);
  });
});

describe('kineticSolutionPath', () => {
  it('walks from start to goal in every state', () => {
    const { mech, surface, design, ends } = fixture();
    for (let s = 0; s < surface.stateCount; s++) {
      expect(stateStats(surface, design, s).perfect).toBe(true);
      const path = kineticSolutionPath(mech, surface, design, s, ends);
      expect(path.length).toBeGreaterThan(1);

      const startCell = mech.cells[ends.start]!;
      const expectedStart = applyPlacement(
        mech.states[s]![startCell.piece]!,
        cellCentre(startCell),
      );
      expect(path[0]![0]).toBeCloseTo(expectedStart[0], 9);
      expect(path[0]![2]).toBeCloseTo(expectedStart[2], 9);
      // Steps are cells walked, not points drawn: the line carries two more
      // points at every doorway so it stays on the surface.
      const steps = solutionLength(surface, design, s, ends);
      expect(steps).toBeGreaterThan(0);
      expect(path.length).toBeGreaterThanOrEqual(steps + 1);
    }
  });

  it('takes a different route once the rings have turned', () => {
    const { mech, surface, design, ends } = fixture();
    const lengths = new Set<number>();
    for (let s = 0; s < surface.stateCount; s++) {
      lengths.add(solutionLength(surface, design, s, ends));
    }
    // If turning the rings left the answer alone, the object would be a static
    // maze wearing a mechanism.
    expect(lengths.size).toBeGreaterThan(1);
  });

  it('is empty when the two ends are not joined', () => {
    const { mech, surface, ends } = fixture();
    const nothingOpen = { open: new Set<number>() };
    expect(kineticSolutionPath(mech, surface, nothingOpen, 0, ends)).toEqual([]);
  });
});

describe('the gap between the rings', () => {
  it('shortens each piece about its own middle, leaving the barrel round', () => {
    const { mech, surface, design } = fixture();
    const tight = buildKineticPieces(mech, surface, design);
    const spaced = buildKineticPieces(mech, surface, design, null, { axialGap: 0.1 });

    const zSpan = (p: (typeof tight)[number]) => p.bounds.zMax - p.bounds.zMin;
    expect(zSpan(spaced[0]!)).toBeCloseTo(zSpan(tight[0]!) * 0.9, 9);
    // Only the height gives: a narrower barrel would be a different solid.
    expect(spaced[0]!.bounds.radius).toBeCloseTo(tight[0]!.bounds.radius, 9);
    // And it stays centred, so the rings do not drift down the dowel.
    expect(spaced[0]!.bounds.zMin).toBeCloseTo(-spaced[0]!.bounds.zMax, 9);
  });

  it('moves the route by the same amount, so it stays on the surface', () => {
    const { mech, surface, design, ends } = fixture();
    const gap = 0.1;
    const pieces = buildKineticPieces(mech, surface, design, ends, { axialGap: gap });
    const path = kineticSolutionPath(mech, surface, design, 0, ends, { axialGap: gap });

    // Every point of the route is inside the height of the ring it crosses.
    const half = Math.max(...pieces.map(p => p.bounds.zMax));
    const pieceZ = mech.states[0]!.map(p => p.offset[2]);
    for (const point of path) {
      const nearest = Math.min(...pieceZ.map(z => Math.abs(point[2] - z)));
      expect(nearest).toBeLessThanOrEqual(half + 1e-9);
    }
  });
});

describe('the route around a corner', () => {
  it('never cuts inside the barrel', () => {
    // A chord between two cell centres on neighbouring faces passes inside the
    // solid, and the surface then hides the answer wherever it turns a corner.
    const { mech, surface, design, ends } = fixture();
    const inradius = Math.cos(Math.PI / mech.sides);
    // How far out a point is, measured against the nearest face rather than
    // the axis. Distance from the axis will not do: a chord cutting the corner
    // between two faces stays *further* from the axis than the faces' own
    // middles do, and is buried in the solid all the same.
    const reach = (x: number, y: number): number => {
      let best = -Infinity;
      for (let face = 0; face < mech.sides; face++) {
        const angle = ((face + 0.5) * 2 * Math.PI) / mech.sides;
        best = Math.max(best, x * Math.cos(angle) + y * Math.sin(angle));
      }
      return best;
    };

    for (let s = 0; s < surface.stateCount; s++) {
      const path = kineticSolutionPath(mech, surface, design, s, ends);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        for (let t = 0; t <= 1; t += 0.1) {
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          expect(reach(x, y)).toBeGreaterThanOrEqual(inradius - 1e-9);
        }
      }
    }
  });

  it('steps through the doorway on the way out and the way in', () => {
    const { mech, surface, design, ends } = fixture();
    const { cells } = solutionCells(surface, design, 0, ends);
    const path = kineticSolutionPath(mech, surface, design, 0, ends);
    // One point per cell, plus a doorway point either side of each crossing
    // that needs one — so the line is longer than the walk, and starts and
    // ends on the cells the markers stand on.
    expect(path.length).toBeGreaterThan(cells.length);
    const start = mech.cells[ends.start]!;
    const first = applyPlacement(mech.states[0]![start.piece]!, cellCentre(start));
    expect(path[0]![0]).toBeCloseTo(first[0], 9);
    expect(path[0]![1]).toBeCloseTo(first[1], 9);
  });
});

describe('the closed ends of a ring', () => {
  it('fills both ends of every piece', () => {
    const { mech, surface, design } = fixture();
    const open = buildKineticPieces(mech, surface, design);
    const closed = buildKineticPieces(mech, surface, design, null, { caps: true });

    for (let i = 0; i < mech.pieceCount; i++) {
      const added = (closed[i]!.positions.length - open[i]!.positions.length) / 9;
      // A fan around each end: one triangle per side of the cross-section,
      // twice over. Corners shared by two cells are counted once.
      expect(added).toBe(2 * mech.sides * mech.cols);
      expect(closed[i]!.normals.length).toBe(closed[i]!.positions.length);
    }
  });

  it('points the ends away from the ring, flat along the axis', () => {
    const { mech, surface, design } = fixture();
    const [piece] = buildKineticPieces(mech, surface, design, null, { caps: true });
    const n = piece!.normals;
    const capNormals = n.slice(n.length - 2 * mech.sides * mech.cols * 9);
    const ups = [];
    for (let i = 0; i < capNormals.length; i += 3) {
      expect(capNormals[i]).toBe(0);
      expect(capNormals[i + 1]).toBe(0);
      ups.push(capNormals[i + 2]);
    }
    expect(new Set(ups)).toEqual(new Set([1, -1]));
  });

  it('leaves the walls and the rim alone', () => {
    const { mech, surface, design } = fixture();
    const open = buildKineticPieces(mech, surface, design);
    const closed = buildKineticPieces(mech, surface, design, null, { caps: true });
    // The maze is on the sides; closing the ends must not draw a line across a
    // seam passage or move a wall.
    expect(closed.map(p => p.walls.length)).toEqual(open.map(p => p.walls.length));
    expect(closed.map(p => p.rim.length)).toEqual(open.map(p => p.rim.length));
  });
});
