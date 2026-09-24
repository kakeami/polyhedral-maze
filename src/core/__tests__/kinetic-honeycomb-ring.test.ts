/**
 * A ring of hinged prisms: the same mechanism as the ring of cubes, on a
 * honeycomb that is not the cubic one.
 *
 * Three things are checked here that the cube ring never had to answer for,
 * and all three are measurements rather than opinions
 * (`.dev/2026-09-18-other-polyhedra-fold.md`):
 *
 * - **the joints.** How far a hinge can turn is the number of turns about that
 *   edge which carry the *honeycomb* onto itself, and it is not the number of
 *   cells round the edge. Four prisms meet along a horizontal edge and the
 *   joint has two positions, because only the half turn keeps a prism upright.
 * - **the fold test.** A fold is checked for collisions, and the shipped test
 *   measures a piece by its bounding box — exact for a cube, and hopeless for
 *   a prism, which fills half of its box. Two prisms sharing a face have
 *   overlapping boxes before anything moves, so the box test calls every prism
 *   ring rigid. The convex test has to agree with the box test on cubes, which
 *   is checked below, and disagree on prisms, which is why the objects exist.
 * - **a ring laid round one point cannot fold at all.** Six triangular prisms
 *   round a lattice vertex make a hexagonal prism and are the prettiest layout
 *   on that honeycomb; they are also rigid in every taping, because the only
 *   line two of their hinges can share is the central edge and the six wedges
 *   bury it. Kept as a test so that the fact is on the record.
 */
import { describe, it, expect } from 'vitest';
import {
  cartesianOf, honeycombOf, isCell, IDLE, cellKey,
} from '../kinetic/honeycomb.ts';
import type { HoneycombId } from '../kinetic/honeycomb.ts';
import {
  createHoneycombRing, honeycombRingShape, prismHexagon, prismStrip, hexPrismHole,
} from '../kinetic/mechanisms/honeycomb-ring.ts';
import type { HoneycombRingObject } from '../kinetic/mechanisms/honeycomb-ring.ts';
import {
  HEX_RING, HONEYCOMB_RING_OBJECTS, createHexRing, honeycombRingObject, honeycombRingRulings,
} from '../kinetic/mechanisms/honeycomb-ring-objects.ts';
import { createInfinityCube } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { contractsCleanly, contractedSearch } from '../kinetic/maze-contracted.ts';
import { rateByState, treeRate } from '../kinetic/maze.ts';
import { buildFoldGraph, poseDistances } from '../kinetic/fold-path.ts';
import { pickPrintedEnds } from '../kinetic/maze.ts';
import { buildKineticPieces, kineticWalls, solutionLength } from '../../render/kinetic-geometry.ts';
import { createRng } from '../prng.ts';

describe('the honeycombs a ring can be folded on', () => {
  it('knows its pieces', () => {
    const shapes: Record<HoneycombId, { faces: number; edges: number; group: number }> = {
      cube: { faces: 6, edges: 12, group: 24 },
      triprism: { faces: 5, edges: 9, group: 12 },
      hexprism: { faces: 8, edges: 18, group: 12 },
    };
    for (const [id, want] of Object.entries(shapes) as [HoneycombId, typeof shapes.cube][]) {
      const hc = honeycombOf(id);
      expect(hc.faces.length, id).toBe(want.faces);
      expect(hc.edges.length, id).toBe(want.edges);
      expect(hc.group.length, id).toBe(want.group);
      expect(isCell(hc, IDLE), id).toBe(true);
      // every face's vertices are distinct, and its edges are as many
      for (let f = 0; f < hc.faces.length; f++) {
        expect(new Set(hc.faces[f]!).size).toBe(hc.faces[f]!.length);
        expect(hc.faceEdges[f]!.length).toBe(hc.faces[f]!.length);
      }
    }
  });

  it('measures the joints, which are not the cells round an edge', () => {
    const table: Record<HoneycombId, { polygon: number; cells: number; turns: number }[]> = {
      // one row per kind of edge: the polygon it bounds, the cells round it,
      // and how far the joint turns
      cube: [{ polygon: 4, cells: 4, turns: 4 }],
      triprism: [
        { polygon: 3, cells: 4, turns: 2 },
        { polygon: 4, cells: 6, turns: 6 },
        { polygon: 4, cells: 4, turns: 2 },
      ],
      hexprism: [
        { polygon: 6, cells: 4, turns: 2 },
        { polygon: 4, cells: 3, turns: 3 },
        { polygon: 4, cells: 4, turns: 2 },
      ],
    };
    for (const [id, want] of Object.entries(table) as [HoneycombId, typeof table.cube][]) {
      const hc = honeycombOf(id);
      const seen = new Set<string>();
      hc.faces.forEach((loop, f) => {
        for (const e of hc.faceEdges[f]!) {
          const edge = hc.edges[e]!;
          seen.add(`${loop.length}/${edge.cells}/${edge.turns.length}`);
        }
      });
      expect([...seen].sort(), id).toEqual(
        want.map(row => `${row.polygon}/${row.cells}/${row.turns}`).sort(),
      );
    }
  });

  it('turns a hinge only where the piece lands on the honeycomb again', () => {
    // A vertical edge of a hexagonal prism has three prisms round it and the
    // joint turns by a third: the sixths in the honeycomb's group are there,
    // and three of the six put the piece where no cell is.
    const hc = honeycombOf('hexprism');
    // six of them: one down each corner of the hexagon (a side face counts
    // two, which is why the per-face tally above says twelve)
    const vertical = hc.edges.filter(e => e.cells === 3);
    expect(vertical.length).toBe(6);
    for (const edge of vertical) expect(edge.turns.length).toBe(3);
    // and the identity is always the first of them, which is what lets a
    // taping's digit 0 mean "leave it flat"
    for (const edge of hc.edges) expect(edge.turns[0]).toEqual(honeycombOf('hexprism').group[0]);
  });

  it('gives each piece a body whose faces close up', () => {
    for (const id of ['cube', 'triprism', 'hexprism'] as const) {
      const piece = cartesianOf(id);
      const hc = honeycombOf(id);
      expect(piece.faces.length).toBe(hc.faces.length);
      expect(piece.normals.length).toBe(hc.faces.length);
      // a closed solid: every edge of the body is shared by exactly two faces
      const edges = new Map<string, number>();
      for (const loop of piece.faces) {
        for (let k = 0; k < loop.length; k++) {
          const a = loop[k]!.map(x => x.toFixed(6)).join(',');
          const b = loop[(k + 1) % loop.length]!.map(x => x.toFixed(6)).join(',');
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every(n => n === 2), id).toBe(true);
      // the normals point away from the centroid, which is at the origin
      piece.faces.forEach((loop, f) => {
        const n = piece.normals[f]!;
        expect(n[0] * loop[0]![0] + n[1] * loop[0]![1] + n[2] * loop[0]![2]).toBeGreaterThan(0);
      });
      expect(cellKey(hc, IDLE).length).toBeGreaterThan(0);
    }
  });
});

describe('the convex fold test', () => {
  it('agrees with the box test on a ring of cubes', () => {
    // The box *is* the piece for a cube, so the two tests have to give the same
    // fold graph — that is what the box path is still there for.
    const mech = createInfinityCube({ cells: 2 });
    const asBoxes = buildFoldGraph({
      pieceCount: mech.pieceCount,
      states: mech.states,
      closures: () => mech.closures(),
      pieceHalfExtents: mech.pieceHalfExtents,
    });
    const cube = cartesianOf('cube');
    const asSolids = buildFoldGraph({
      pieceCount: mech.pieceCount,
      states: mech.states,
      closures: () => mech.closures(),
      pieceHalfExtents: mech.pieceHalfExtents,
      pieceFaces: Array.from({ length: mech.pieceCount }, () => cube.faces),
    });
    const count = (graph: typeof asBoxes): number =>
      graph.folds.reduce((sum, list) => sum + list.length, 0);
    expect(count(asSolids)).toBe(count(asBoxes));
    expect(poseDistances(asSolids)).toEqual(poseDistances(asBoxes));
  });
});

describe('six hexagonal prisms round a hole', () => {
  const shape = honeycombRingShape(HEX_RING);

  it('shuts into a ring and four blocks, and nothing is stranded', () => {
    expect(shape.closures.length).toBe(5);
    expect(shape.poses.length).toBe(5);
    expect(shape.strays.length).toBe(0);
    expect(new Set(shape.poses.map(p => p.silhouette)).size).toBe(4);
    expect(shape.poses.map(p => p.label))
      .toEqual(['Ring 1', 'Block 1', 'Block 2', 'Block 3', 'Block 4']);
  });

  it('counts the shape it has to pass through as one it can stop in', () => {
    // Block 3 is the triangle two layers deep, and every route to Block 4 goes
    // through it. One strip of tape is pinched between four prisms there —
    // which is where the cube ring's rule would refuse the shape, and refusing
    // to stop where the motion has to go is a rule about nothing. The pose
    // says so instead.
    const triangle = shape.poses[3]!;
    expect(triangle.tapePinched).toBe(true);
    expect(triangle.exposed).toBe(30);
    expect(shape.poses.filter(p => p.tapePinched).length).toBe(1);
    const distances = poseDistances(shape.foldGraph);
    // from the ring, Block 4 is three folds away and Block 3 is on the way
    expect(distances[1]![3]).toBe(1);
    expect(distances[1]![4]).toBe(2);
    expect(distances[3]![4]).toBe(1);
  });

  it('changes genus with six pieces, where a ring of cubes needs ten', () => {
    expect(shape.poses.map(p => p.genus)).toEqual([1, 0, 0, 0, 0]);
    expect(shape.poses.map(p => p.thickness)).toEqual([1, 2, 2, 2, 2]);
    // burying a hexagon costs six times what burying a square does, so the
    // faces on show swing further than any ring of cubes swings
    expect(shape.poses.map(p => p.exposed)).toEqual([36, 34, 34, 30, 34]);
  });

  it('turns four prisms through a third of a turn as one arc', () => {
    // Block 2 to Block 4 is one fold. It used to read as three: the four
    // prisms' rotations differ in the last digit (0.8660254037844386 against
    // ...388), and the fold test compared rotations exactly, so an arc that
    // turned as one body looked like four pieces each doing something else.
    const distances = poseDistances(shape.foldGraph);
    expect(distances[2]![4]).toBe(1);
    const arc = shape.foldGraph.folds[shape.poses[2]!.closure]!
      .find(f => f.to === shape.poses[4]!.closure)!.step;
    expect(arc.pieces.length).toBe(4);
    expect(Math.abs(arc.angle)).toBeCloseTo((2 * Math.PI) / 3, 9);
  });

  it('can be folded from any shape to any other', () => {
    const distances = poseDistances(shape.foldGraph);
    for (const row of distances) {
      for (const d of row) expect(d).toBeGreaterThanOrEqual(0);
    }
    expect(Math.max(...distances.flat())).toBe(3);
  });

  it('is one printed pattern that is a perfect maze in every state', () => {
    const mech = createHexRing({ cells: 2 });
    expect(mech.pieceCount).toBe(6);
    expect(mech.cells.length).toBe(6 * (2 * 24 + 6 * 4));
    const surface = buildSurface(mech, { maxStates: mech.states.length });
    expect(surface.stateCount).toBe(5);
    expect(contractsCleanly(surface)).toBe(true);
    expect([...surface.visibleCount]).toEqual([384, 256, 256, 240, 256]);
    // No side is left without a partner: with the triangle counted, every cell
    // is on the outside in at least one state.
    expect(surface.classKind.filter(kind => kind === 'rim').length).toBe(0);

    const result = contractedSearch(surface, {
      rng: createRng(7), iterations: 40000, maxRounds: 40, restarts: 2,
    });
    const rate = treeRate(surface, result.design);
    expect(rate.perfect).toBe(surface.stateCount);
    // and again by the other road: one state at a time, from the passages of
    // that state rather than from the walk over the chain
    const byState = rateByState(surface, result.design);
    expect(byState.rate.perfect).toBe(surface.stateCount);
  });

  it('offers rulings from two cells a face up', () => {
    expect(honeycombRingRulings(HEX_RING)[0]).toBe(2);
    expect(honeycombRingRulings(HEX_RING).at(-1)).toBe(HEX_RING.maxCells);
  });
});

describe('a ring laid round one point', () => {
  it('folds, but only the box test says otherwise', () => {
    // Six triangular prisms round a lattice vertex: a hexagonal prism cut into
    // wedges. Measured with the pieces as boxes, every one of the 4096 tapings
    // comes out rigid; measured with the pieces as solids, 313 of them fold.
    // This is the smaller, faster version of that sweep, and it exists so that
    // a change to the collision test cannot quietly bring the boxes back.
    const ring = prismHexagon();
    let folds = 0;
    let built = 0;
    for (let code = 0; code < 4096; code += 17) {
      const hinges: number[] = [];
      let rest = code;
      for (let i = 0; i < 6; i++) {
        hinges.push(rest % 4);
        rest = Math.floor(rest / 4);
      }
      const object: HoneycombRingObject = {
        id: `wedges-${hinges.join('')}`,
        label: 'wedges',
        blurb: '',
        honeycomb: 'triprism',
        ring,
        hinges,
        maxCells: 4,
      };
      let shape;
      try {
        shape = honeycombRingShape(object);
      } catch {
        continue;
      }
      built++;
      if (shape.poses.length >= 2) folds++;
    }
    expect(built).toBeGreaterThan(0);
    expect(folds).toBeGreaterThan(0);
  });

  it('reaches two states at best, which is why the object was dropped', () => {
    // Built, measured and left out: six wedges *are* a hexagonal prism when
    // they are laid out, and they shut into two layers of three by a sixth of
    // a turn, which no ring of cubes can do — but two shapes is all this
    // layout reaches, and on screen the object was broken. The taping is a
    // fixture here rather than a catalogue entry so that the measurement
    // survives the object, as `.dev/2026-09-17-fold-objects-2.md` §6 kept the
    // sixteen-pose ring's.
    const shape = honeycombRingShape({
      id: 'wedges-fixture',
      label: 'six wedges',
      blurb: '',
      honeycomb: 'triprism',
      ring: prismHexagon(),
      hinges: [2, 3, 3, 1, 1, 0],
      maxCells: 4,
    });
    expect(shape.poses.length).toBe(2);
    expect(shape.strays.length).toBe(0);
    expect(shape.poses.map(p => p.label)).toEqual(['Plate 1', 'Block 1']);
    expect(shape.poses[0]!.layers).toBe('AVA/VAV');
    expect(shape.poses.map(p => p.exposed)).toEqual([18, 16]);
  });

  it('folds once the same six prisms are laid in a strip', () => {
    // The layout is the whole difference: a row has its horizontal edges on
    // two straight lines of the lattice, so two hinges can be coaxial.
    const ring = prismStrip(3);
    let most = 0;
    for (let code = 0; code < 2304; code += 7) {
      const hinges: number[] = [];
      let rest = code;
      for (const width of [4, 4, 3, 4, 4, 3]) {
        hinges.push(rest % width);
        rest = Math.floor(rest / width);
      }
      try {
        most = Math.max(most, honeycombRingShape({
          id: `strip-${hinges.join('')}`,
          label: 'strip',
          blurb: '',
          honeycomb: 'triprism',
          ring,
          hinges,
          maxCells: 4,
        }).poses.length);
      } catch {
        continue;
      }
    }
    expect(most).toBeGreaterThanOrEqual(2);
  });
});

describe('the catalogue', () => {
  it('offers the ring of hexagonal prisms, and answers to a name', () => {
    expect(HONEYCOMB_RING_OBJECTS.map(o => o.id)).toEqual(['hex-ring']);
    expect(HONEYCOMB_RING_OBJECTS.map(o => o.honeycomb)).toEqual(['hexprism']);
    expect(honeycombRingObject('hex-ring')).toBe(HEX_RING);
    // a link naming an object that is gone — the ring of wedges, say — lands
    // on the default rather than throwing at a visitor
    expect(honeycombRingObject('hex-wedges')).toBe(HEX_RING);
    expect(honeycombRingObject('no-such-object')).toBe(HEX_RING);
  });

  it('is a perfect maze in every state of every object, at every ruling', () => {
    for (const object of HONEYCOMB_RING_OBJECTS) {
      for (const cells of [2, 3]) {
        const mech = createHoneycombRing(object, { cells });
        const surface = buildSurface(mech, { maxStates: mech.states.length });
        expect(contractsCleanly(surface), object.id).toBe(true);
        const result = contractedSearch(surface, {
          rng: createRng(11), iterations: 40000, maxRounds: 40, restarts: 2,
        });
        const rate = treeRate(surface, result.design);
        expect(rate.perfect, `${object.id} at ${cells}`).toBe(surface.stateCount);
        // the passage count is not the same in every state here, and that is
        // the point of a mechanism that buries part of its own surface
        expect(new Set([...surface.visibleCount]).size, object.id).toBeGreaterThan(1);
      }
    }
  });
});

describe('the layouts', () => {
  it('lays every ring out so that consecutive pieces share a face', () => {
    // `honeycombRingShape` throws when they do not, so building one is the test
    for (const [id, ring] of [
      ['hexprism', hexPrismHole()],
      ['triprism', prismStrip(4)],
      ['triprism', prismHexagon()],
    ] as const) {
      expect(() => honeycombRingShape({
        id: `layout-${id}-${ring.length}`,
        label: 'layout',
        blurb: '',
        honeycomb: id,
        ring,
        hinges: ring.map(() => 0),
        maxCells: 4,
      })).not.toThrow(/share no face/);
    }
  });

  it('numbers the cells of a piece face by face, and finds them again', () => {
    const mech = createHoneycombRing(HEX_RING, { cells: 2 });
    expect(mech.sources.length).toBe(mech.cells.length);
    for (let i = 0; i < mech.cells.length; i += 37) {
      const source = mech.sources[i]!;
      expect(mech.cellIndex(source.piece, source.faceId, source.cell)).toBe(i);
    }
  });
});

describe('what the page draws', () => {
  // The 3D view drives both mechanisms from `Mechanism` alone, so this is the
  // check that can be made without a browser: the geometry comes out, the
  // walls follow the pose, and the two markers behave as they have to on an
  // object that buries part of itself.
  for (const object of HONEYCOMB_RING_OBJECTS) {
    it(`builds a model of the ${object.id} that is finite and complete`, () => {
      const mech = createHoneycombRing(object, { cells: 3 });
      const surface = buildSurface(mech, { maxStates: mech.states.length });
      const result = contractedSearch(surface, {
        rng: createRng(5), iterations: 40000, maxRounds: 40, restarts: 2,
      });
      const design = result.design;
      expect(treeRate(surface, design).perfect).toBe(surface.stateCount);

      const ends = pickPrintedEnds(surface, design);
      const pieces = buildKineticPieces(mech, surface, design, ends);
      expect(pieces.length).toBe(mech.pieceCount);
      for (const piece of pieces) {
        expect(piece.positions.length % 9).toBe(0);
        expect(piece.positions.length).toBeGreaterThan(0);
        expect(piece.positions.every(Number.isFinite)).toBe(true);
        expect(piece.normals.length).toBe(piece.positions.length);
      }

      // Walls follow the pose: a cell pressed against another piece carries
      // its printed walls, and drawing them would put a wall across a passage.
      const wallsByPose = mech.states.map((_unused, state) =>
        kineticWalls(mech, surface, design, surface.visibleOfState(state)));
      const counted = wallsByPose.map(walls =>
        walls.reduce((sum, list) => sum + list.length, 0));
      expect(counted.every(n => n > 0)).toBe(true);
      // and they are not one drawing: a pose that presses two pieces together
      // draws neither the walls of the cells it buried nor the ones along the
      // seam. (Not "fewer cells, fewer walls" — a wall between two cells that
      // are both on show is drawn once, and one along a burial seam is drawn
      // by the cell still outside, so the count is not monotone in the cells.)
      expect(new Set(counted).size).toBeGreaterThan(1);

      // The markers are printed twice, and exactly one of each pair is out in
      // any pose — the condition that made the cube ring print them in pairs.
      expect(ends.start.length).toBeGreaterThan(0);
      expect(ends.goal.length).toBeGreaterThan(0);
      mech.states.forEach((_unused, state) => {
        const visible = surface.visibleOfState(state);
        expect(ends.start.filter(cell => visible[cell] === 1).length).toBe(1);
        expect(ends.goal.filter(cell => visible[cell] === 1).length).toBe(1);
        const here = ends.byState[state]!;
        expect(visible[here.start]).toBe(1);
        expect(visible[here.goal]).toBe(1);
        expect(solutionLength(surface, design, state, here)).toBeGreaterThan(0);
      });
    });
  }
});
