/**
 * A ring of half cubes: the infinity cube with every cube cut in two, which
 * folds from a cube into a star.
 *
 * Four things are checked here that no ring of whole cubes asked of the code,
 * and all four are measurements rather than opinions
 * (`.dev/2026-10-14-yoshimoto.md`):
 *
 * - **edge-to-edge contact.** Halves meet along an edge and nothing more in
 *   every shape but the star, so four faces come to one line. The surface
 *   pairs them round the line, and every pose still comes out as one surface
 *   with every side paired once.
 * - **a sealed hollow.** As a cube from outside, the 48 triangles line a
 *   star-shaped cavity that touches the outside only along lines. It is a
 *   surface of its own, and it is hidden as shut inside.
 * - **marks shown twice.** No two cells take turns on the outside, so each mark
 *   is printed on two cells that are both out in one plank, and nowhere else.
 * - **a net that folds one way.** A half cube has three grooves, and the
 *   pattern never folds along one.
 */
import { describe, it, expect } from 'vitest';
import type { Vec3 } from '../types.ts';
import type { KineticCell, Mechanism } from '../kinetic/types.ts';
import { applyPlacement } from '../kinetic/types.ts';
import {
  HALF_CUBE_RING_OBJECTS, STAR_CUBE, createHalfCubeRing, halfCubeFaces, halfCubeRingRulings,
} from '../kinetic/mechanisms/half-cube-ring.ts';
import { INFINITY_CUBE } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { cubeRingShape } from '../kinetic/mechanisms/cube-ring.ts';
import { buildSurface, buildSurfaceByState } from '../kinetic/surface.ts';
import type { KineticSurface } from '../kinetic/surface.ts';
import { contractsCleanly, contractedSearch } from '../kinetic/maze-contracted.ts';
import { pickPrintedEnds, rateByState } from '../kinetic/maze.ts';
import {
  buildKineticPieces, solutionLength, cellNormal, cellCentre,
} from '../../render/kinetic-geometry.ts';
import { MAZE_STYLE } from '../../render/scene-constants.ts';
import { buildHalfCubeSheets } from '../../render/half-cube-sheet-model.ts';
import { HALF_CUBE_RING_DESIGNS } from '../kinetic/mechanisms/half-cube-ring-designs.ts';
import { decodeOpenClasses } from '../kinetic/stored-design.ts';
import { STACK_SHEET_DEFAULTS } from '../../render/kinetic-sheet-constants.ts';
import { FOLD_OBJECTS, foldObject, isCubeRingMechanism, createFoldMechanism } from '../../ui/fold-objects.ts';
import { UnionFind } from '../graph.ts';
import { createRng } from '../prng.ts';

/** Strictly inside the half of the unit cube round corner `kept`? */
function insideHalf(kept: Vec3, p: Vec3): boolean {
  const t = [0, 1, 2].map(a => 0.5 - Math.sign(kept[a]!) * p[a]!);
  if (t.some(x => x <= 1e-9 || x >= 1 - 1e-9)) return false;
  return Math.min(...t) + Math.max(...t) < 1 - 1e-9;
}

const mech = createHalfCubeRing(STAR_CUBE, { cells: 2 });
const surface = buildSurface(mech, { maxStates: mech.states.length });
const poseOf = (label: string) => mech.poses.findIndex(pose => pose.label === label);
const isSquare = (cell: number) => mech.sources[cell]!.faceId < 3;

/** Visible cells of one state joined through every pairing, all walls open. */
function components(s: KineticSurface, state: number): number {
  const uf = new UnionFind<number>();
  const visible = s.visibleOfState(state);
  for (let cell = 0; cell < s.cellCount; cell++) if (visible[cell]) uf.find(cell);
  for (const e of s.adjOfState(state)) uf.union(e.a, e.b);
  const roots = new Set<number>();
  for (let cell = 0; cell < s.cellCount; cell++) if (visible[cell]) roots.add(uf.find(cell));
  return roots.size;
}

describe('a half cube', () => {
  it('is three squares round the corner it keeps and six triangles to the centre', () => {
    const faces = halfCubeFaces([-0.5, -0.5, -0.5]);
    expect(faces.map(f => f.vertices.length)).toEqual([4, 4, 4, 3, 3, 3, 3, 3, 3]);
    expect(faces.map(f => f.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const face of faces.slice(3)) expect(face.vertices[0]).toEqual([0, 0, 0]);
  });

  it('has every cell wound counter-clockwise seen from outside', () => {
    mech.cells.forEach((cell: KineticCell) => {
      const kept = mech.kept[cell.piece]!;
      const c = cellCentre(cell);
      const n = cellNormal(cell);
      const step = (by: number): Vec3 => [c[0] + n[0] * by, c[1] + n[1] * by, c[2] + n[2] * by];
      expect(insideHalf(kept, step(1e-4))).toBe(false);
      expect(insideHalf(kept, step(-1e-4))).toBe(true);
    });
  });
});

describe('the ring of half cubes', () => {
  it('folds exactly as the infinity cube does', () => {
    const whole = cubeRingShape(INFINITY_CUBE);
    expect(mech.closures()).toBe(whole.closures);
    // Its blocks and layers, that is: the whole ring's hooks are left out,
    // because no maze was found that holds up in them as well.
    const blocksAndLayers = whole.poses.filter(pose => !pose.label.startsWith('Hook'));
    expect(whole.poses.length - blocksAndLayers.length).toBe(2);
    expect(mech.poses.map(pose => pose.closure).sort()).toEqual(blocksAndLayers.map(pose => pose.closure).sort());
    expect(mech.foldGraph().poseAt).toEqual(mech.poses.map(pose => pose.closure));
  });

  it('names its shapes: the cube, the star and four planks, cube first', () => {
    expect(mech.poses.map(pose => pose.label)).toEqual(
      ['Cube', 'Star', 'Plank 1', 'Plank 2', 'Plank 3', 'Plank 4'],
    );
  });

  it('keeps the corner at the middle of the star and at the outside of the cube', () => {
    for (const [label, reach] of [['Star', 0], ['Cube', Math.sqrt(3)]] as const) {
      const placed = mech.states[poseOf(label)]!;
      const middle = [0, 1, 2].map(a => placed.reduce((sum, p) => sum + p.offset[a]!, 0) / placed.length);
      placed.forEach((at, piece) => {
        const corner = applyPlacement(at, mech.kept[piece]!);
        expect(Math.hypot(corner[0] - middle[0]!, corner[1] - middle[1]!, corner[2] - middle[2]!)).toBeCloseTo(reach, 9);
      });
    }
  });

  it('shows triangles alone as a star and squares alone as a cube', () => {
    const shown = (state: number) => {
      const visible = surface.visibleOfState(state);
      let squares = 0;
      let triangles = 0;
      visible.forEach((bit, cell) => {
        if (bit) {
          if (isSquare(cell)) squares++;
          else triangles++;
        }
      });
      return { squares, triangles };
    };
    expect(shown(poseOf('Star'))).toEqual({ squares: 0, triangles: 192 });
    expect(shown(poseOf('Cube'))).toEqual({ squares: 96, triangles: 0 });
    expect([1, 2, 3, 4].map(k => surface.visibleCount[poseOf(`Plank ${k}`)])).toEqual([256, 224, 272, 240]);
  });

  it('is one surface in every shape, every side paired once', () => {
    for (let state = 0; state < surface.stateCount; state++) {
      const visible = surface.visibleOfState(state);
      let sides = 0;
      visible.forEach((bit, cell) => { if (bit) sides += mech.cells[cell]!.corners.length; });
      expect(surface.adjOfState(state).length * 2, mech.poses[state]!.label).toBe(sides);
      expect(components(surface, state), mech.poses[state]!.label).toBe(1);
    }
    for (let c = 0; c < surface.classCount; c++) expect(surface.classKind[c]).not.toBe('rim');
  });

  it('buries its faces whole, so the contracted search applies', () => {
    expect(contractsCleanly(surface)).toBe(true);
  });

  it('has a maze that is perfect in all six shapes', () => {
    const found = contractedSearch(surface, { rng: createRng(42) });
    expect(found.rate.perfect).toBe(surface.stateCount);
    expect(rateByState(surface, found.design).rate.perfect).toBe(surface.stateCount);
  });

  it('is offered on the folding page, and is not a ring of whole cubes', () => {
    expect(FOLD_OBJECTS).toContain(STAR_CUBE);
    expect(HALF_CUBE_RING_OBJECTS).toEqual([STAR_CUBE]);
    expect(foldObject(STAR_CUBE.id)).toBe(STAR_CUBE);
    expect(isCubeRingMechanism(createFoldMechanism(STAR_CUBE, { cells: 2 }))).toBe(false);
    expect(halfCubeRingRulings(STAR_CUBE)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('the mazes the folding page ships with for the half cubes', () => {
  it('keeps seed 42 at every ruling the page offers', () => {
    expect(HALF_CUBE_RING_DESIGNS.map(d => [d.object, d.cells, d.seed])).toEqual(
      halfCubeRingRulings(STAR_CUBE).map(cells => [STAR_CUBE.id, cells, 42]),
    );
  });

  for (const stored of HALF_CUBE_RING_DESIGNS) {
    it(`is a perfect maze in every shape at ${stored.cells} cells`, () => {
      const at = createHalfCubeRing(STAR_CUBE, { cells: stored.cells });
      const s = buildSurface(at, { maxStates: at.states.length });
      expect(stored.classCount).toBe(s.classCount);
      expect(rateByState(s, { open: decodeOpenClasses(stored) }).rate.perfect).toBe(s.stateCount);
    });
  }
});

describe('the surface where pieces meet along an edge', () => {
  /** A unit cube's six faces, one cell each, wound counter-clockwise from outside. */
  const cubeCells = (piece: number): KineticCell[] => {
    const cells: KineticCell[] = [];
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        const u = sign > 0 ? (axis + 1) % 3 : (axis + 2) % 3;
        const v = sign > 0 ? (axis + 2) % 3 : (axis + 1) % 3;
        cells.push({
          piece,
          corners: [[0, 0], [1, 0], [1, 1], [0, 1]].map(([du, dv]) => {
            const p = [0, 0, 0];
            p[axis] = sign * 0.5;
            p[u] = du! - 0.5;
            p[v] = dv! - 0.5;
            return p as unknown as Vec3;
          }),
        });
      }
    }
    return cells;
  };
  const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const;

  it('pairs two cubes on one edge across the empty wedges, into one surface', () => {
    const pair: Mechanism = {
      id: 'two-cubes-on-an-edge',
      pieceCount: 2,
      cells: [...cubeCells(0), ...cubeCells(1)],
      states: [[
        { rot: identity, offset: [0.5, 0.5, 0.5] },
        { rot: identity, offset: [1.5, 1.5, 0.5] },
      ]],
      stateLabel: () => 'diagonal',
    };
    const s = buildSurfaceByState(pair);
    expect(s.adjOfState(0).length).toBe(24);
    expect(components(s, 0)).toBe(1);
    // Across the edge, a face meets the face of the other cube that is round
    // the empty wedge from it, and the surface turns a corner there: the top of
    // the lower cube runs into the side of the upper one. The other pairing —
    // the two coplanar faces, back to back — would walk through both cubes.
    const across = s.adjOfState(0).filter(e => !e.intra);
    expect(across.length).toBe(2);
    const normals = across.map(e => [cellNormal(pair.cells[e.a]!), cellNormal(pair.cells[e.b]!)]
      .map(n => n.map(x => Math.round(x)).join(',')).sort().join(' / ')).sort();
    expect(normals).toEqual(['-1,0,0 / 0,1,0', '0,-1,0 / 1,0,0']);
  });

  it('hides the star-shaped hollow of the cube and nothing else', () => {
    const cube = poseOf('Cube');
    const visible = surface.visibleOfState(cube);
    for (let cell = 0; cell < surface.cellCount; cell++) expect(visible[cell]).toBe(isSquare(cell) ? 1 : 0);
    // in every other shape, nothing is hidden that is not pressed face to face
    for (let state = 0; state < surface.stateCount; state++) {
      if (state === cube) continue;
      const v = surface.visibleOfState(state);
      for (let cell = 0; cell < surface.cellCount; cell++) {
        if (!isSquare(cell)) expect(v[cell], mech.poses[state]!.label).toBe(1);
      }
    }
  });
});

/** The maze the page ships at a ruling: what it opens on, and no search. */
function shipped(cells: number) {
  const stored = HALF_CUBE_RING_DESIGNS.find(d => d.cells === cells && d.seed === 42)!;
  return { open: decodeOpenClasses(stored), openCutClasses: [], targetState: 0 };
}

describe('the marks on the ring of half cubes', () => {
  const design = shipped(2);
  const ends = pickPrintedEnds(surface, design);
  const onShow = (cells: readonly number[], state: number) =>
    cells.filter(cell => surface.visibleOfState(state)[cell]).length;

  it('prints each mark twice, never missing, and two of each in one plank only', () => {
    expect(ends.start.length).toBe(2);
    expect(ends.goal.length).toBe(2);
    const counts = mech.poses.map((_pose, state) => [onShow(ends.start, state), onShow(ends.goal, state)]);
    const plank1 = poseOf('Plank 1');
    counts.forEach(([s, g], state) => {
      expect([s, g], mech.poses[state]!.label).toEqual(state === plank1 ? [2, 2] : [1, 1]);
    });
  });

  it('puts one of each on a triangle and one on a square', () => {
    for (const cells of [ends.start, ends.goal]) {
      expect(cells.map(isSquare).sort()).toEqual([false, true]);
    }
  });

  it('stands a pin only in open air where its cell is on show, and nowhere else', () => {
    // Every printed mark has a pin, and the 3D view shows one only where its
    // cell is on the outside (`FoldModel.visibleByPose`). That rule is the
    // whole of what keeps the star from growing pins: a square pressed against
    // another piece is under a pyramid, and its pin comes out of the far side.
    const pieces = buildKineticPieces(mech, surface, design, ends);
    const length = MAZE_STYLE.markers.pinLength;
    const pierces = (state: number, piece: number, at: Vec3, normal: Vec3): boolean => {
      const placed = mech.states[state]!;
      for (let t = 0.02; t <= 1 + 1e-9; t += 0.02) {
        const w = applyPlacement(placed[piece]!, [
          at[0] + normal[0] * length * t, at[1] + normal[1] * length * t, at[2] + normal[2] * length * t,
        ]);
        const inside = placed.some((p, q) => {
          const d = [w[0] - p.offset[0], w[1] - p.offset[1], w[2] - p.offset[2]];
          const body = [0, 1, 2].map(j => p.rot[0]![j]! * d[0]! + p.rot[1]![j]! * d[1]! + p.rot[2]![j]! * d[2]!);
          return insideHalf(mech.kept[q]!, body as unknown as Vec3);
        });
        if (inside) return true;
      }
      return false;
    };
    let wouldPierce = 0;
    mech.poses.forEach((_pose, state) => {
      const visible = surface.visibleOfState(state);
      for (const piece of pieces) {
        expect(piece.markerCells.length).toBe(piece.markers.length);
        piece.markers.forEach((marker, i) => {
          const through = pierces(state, piece.piece, marker.at, marker.normal);
          if (visible[piece.markerCells[i]!]) expect(through, mech.poses[state]!.label).toBe(false);
          else if (through) wouldPierce++;
        });
      }
    });
    // and the rule is not idle: the star alone hides two pins that would
    expect(wouldPierce).toBeGreaterThan(0);
  });

  it('gives each pose the shortest walk between marks on show', () => {
    mech.poses.forEach((_pose, state) => {
      const here = ends.byState[state]!;
      const visible = surface.visibleOfState(state);
      expect(visible[here.start]).toBe(1);
      expect(visible[here.goal]).toBe(1);
      const walk = solutionLength(surface, design, state, here);
      for (const s of ends.start) {
        for (const g of ends.goal) {
          if (!visible[s] || !visible[g]) continue;
          expect(walk).toBeLessThanOrEqual(solutionLength(surface, design, state, { start: s, goal: g }));
        }
      }
    });
  });
});

describe('the pattern for the ring of half cubes', () => {
  const design = shipped(2);
  const plan = buildHalfCubeSheets(mech, surface, design);

  it('is a sheet of notes and a sheet a piece', () => {
    expect(plan.sheets.length).toBe(mech.pieceCount + 1);
    expect(plan.perfectStates).toBe(surface.stateCount);
  });

  it('names every taped edge on a cut line and never folds along a groove', () => {
    expect(plan.hingesOffBoundary).toBe(0);
    expect(plan.grooveFolds).toBe(0);
  });

  it('says that the page draws the shortest walk where marks are shown twice', () => {
    const notes = plan.sheets[0]!.items
      .filter((item): item is { kind: 'text'; text: string } => (item as { kind: string }).kind === 'text')
      .map(item => item.text)
      .join(' ');
    expect(notes).toMatch(/shortest/);
    expect(notes).toMatch(/two S and two G on show here/);
  });

  it('keeps a triangle\'s cells big enough to cut at the finest ruling, and no finer', () => {
    const finest = Math.max(...halfCubeRingRulings(STAR_CUBE));
    const at = createHalfCubeRing(STAR_CUBE, { cells: finest });
    const s = buildSurface(at, { maxStates: at.states.length });
    const fine = buildHalfCubeSheets(at, s, shipped(finest));
    // a triangle's cells are a cube's edge over n along the base and 1/sqrt(2)
    // of that from base to tip
    expect(fine.cellMm * Math.SQRT1_2).toBeGreaterThanOrEqual(STACK_SHEET_DEFAULTS.minCellMm);
    expect(fine.cellMm * (finest / (finest + 1)) * Math.SQRT1_2).toBeLessThan(STACK_SHEET_DEFAULTS.minCellMm);
  });
});
