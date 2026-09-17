import { describe, it, expect } from 'vitest';
import { gyrationAxes } from '../kinetic/seams.ts';
import { createGyration, gyrationCellCount, gyrationFacts, GYRATIONS } from '../kinetic/mechanisms/gyration.ts';
import { createJoinedPair } from '../kinetic/mechanisms/joined.ts';
import { buildSurface } from '../kinetic/surface.ts';
import { chainOf } from '../kinetic/chain.ts';
import { contractedSearch } from '../kinetic/maze-contracted.ts';
import { expandCutClasses, treeRate } from '../kinetic/maze.ts';
import { createRng } from '../prng.ts';
import { getShape } from '../polyhedra/registry.ts';
import { cross, dot, sub } from '../vec3.ts';
import type { Vec3 } from '../types.ts';

function facesOf(id: string) {
  const shape = getShape(id);
  if (!shape) throw new Error(`no such shape: ${id}`);
  return shape.factory().faces();
}

describe('gyration seams', () => {
  it('cuts the cuboctahedron at its hexagon, six ways round', () => {
    const axes = gyrationAxes(facesOf('cuboctahedron'));
    const best = axes[0]!;
    expect(best.seams).toHaveLength(1);
    expect(best.seams[0]!.order).toBe(6);
    expect(best.seams[0]!.loop).toBe(6);
    expect(best.pieces).toBe(2);
    expect(best.stateCount).toBe(6);
  });

  it('cuts the icosahedron into three, a fifth of a turn at a time', () => {
    const best = gyrationAxes(facesOf('icosahedron'))[0]!;
    expect(best.seams.map(s => s.order)).toEqual([5, 5]);
    expect(best.pieces).toBe(3);
    expect(best.stateCount).toBe(25);
  });

  it('refuses a solid whose edges no plane runs along', () => {
    // A cube's cross sections cut through faces; a prism's lateral edges run
    // along the axis, so any plane across them crosses an edge.
    expect(gyrationAxes(facesOf('cube'))).toHaveLength(0);
    expect(gyrationAxes(facesOf('hexagonal-prism'))).toHaveLength(0);
    expect(gyrationAxes(facesOf('truncated-octahedron'))).toHaveLength(0);
  });

  it('gives every seam on an axis one shared turn', () => {
    for (const id of ['octahedron', 'icosahedron', 'rhombicuboctahedron', 'icosidodecahedron']) {
      for (const axis of gyrationAxes(facesOf(id))) {
        for (const seam of axis.seams) {
          expect(seam.order % axis.turnSteps).toBe(0);
        }
        expect(axis.stateCount).toBe(axis.turnSteps ** axis.seams.length);
      }
    }
  });
});

describe('a cut solid as a mechanism', () => {
  it('keeps every cell of the solid, split between the pieces', () => {
    const mech = createGyration({ shape: 'cuboctahedron', n: 3 });
    expect(mech.cells).toHaveLength(gyrationCellCount({ shape: 'cuboctahedron', n: 3 }));
    const perPiece = new Array(mech.pieceCount).fill(0);
    for (const cell of mech.cells) perPiece[cell.piece]++;
    expect(perPiece.every(count => count > 0)).toBe(true);
    expect(perPiece.reduce((a, b) => a + b, 0)).toBe(mech.cells.length);
    // Every face of the solid went to exactly one piece.
    const faces = mech.facesOfPiece.flat();
    expect(new Set(faces).size).toBe(faces.length);
    expect(faces.length).toBe(facesOf('cuboctahedron').length);
  });

  it('names each state by the turns of its pieces, both ways round', () => {
    const mech = createGyration({ shape: 'icosahedron', n: 2 });
    expect(mech.states).toHaveLength(25);
    for (let state = 0; state < mech.states.length; state++) {
      expect(mech.stateIndex(mech.stateOffsets(state))).toBe(state);
    }
    // Turning the whole object is not a move.
    expect(mech.stateIndex([3, 0, 0])).toBe(0);
  });

  it('winds its cells counter-clockwise seen from outside', () => {
    const mech = createGyration({ shape: 'octahedron', n: 2 });
    for (const cell of mech.cells) {
      const [a, b, c] = [cell.corners[0]!, cell.corners[1]!, cell.corners[2]!];
      const normal = cross(sub(b, a), sub(c, b));
      const centre: Vec3 = [0, 0, 0];
      for (const v of cell.corners) {
        centre[0] += v[0] / cell.corners.length;
        centre[1] += v[1] / cell.corners.length;
        centre[2] += v[2] / cell.corners.length;
      }
      // The solid is convex and centred on the origin, so out is away from it.
      expect(dot(normal, centre)).toBeGreaterThan(0);
    }
  });

  it('says so rather than guessing when the solid cannot be cut', () => {
    expect(() => createGyration({ shape: 'cube' })).toThrow(/no seam/);
    expect(() => createGyration({ shape: 'cuboctahedron', axisIndex: 99 })).toThrow(/not 100/);
    expect(() => createGyration({ shape: 'no-such-solid' })).toThrow(/no such shape/);
  });
});

describe('the surface of a cut solid', () => {
  const cases: [string, number][] = [
    ['octahedron', 3],
    ['cuboctahedron', 3],
    ['icosahedron', 2],
    ['rhombicuboctahedron', 2],
  ];

  it.each(cases)('leaves no rim on %s at n=%i', (shape, n) => {
    // The object is a whole solid: every side of every cell meets another one.
    // A rim class would mean two faces disagree about where the cells along
    // their shared edge sit, and the maze would be cut in two there.
    const surface = buildSurface(createGyration({ shape, n }));
    expect(surface.classKind.filter(kind => kind === 'rim')).toHaveLength(0);
    expect(surface.hidesCells).toBe(false);
    expect(surface.parts).not.toBeNull();
  });

  it.each(cases)('sits its pieces in a line on %s at n=%i', (shape, n) => {
    const mech = createGyration({ shape, n });
    const chain = chainOf(buildSurface(mech));
    expect(chain).not.toBeNull();
    expect(chain!.pieceOrder).toHaveLength(mech.pieceCount);
    expect(chain!.seams).toHaveLength(mech.pieceCount - 1);
    for (const seam of chain!.seams) expect(seam.byTurn).toHaveLength(mech.turnSteps);
  });

  it.each(cases)('is a perfect maze in every state of %s at n=%i', (shape, n) => {
    const surface = buildSurface(createGyration({ shape, n }));
    const rng = createRng(7);
    const found = contractedSearch(surface, {
      rng,
      openCutClasses: expandCutClasses(surface, { rng, extra: 0 }),
      maxRounds: 48,
    });
    const rate = treeRate(surface, found.design);
    expect(rate.perfect).toBe(surface.stateCount);
    expect(rate.edgeCountInvariant).toBe(true);
    expect(rate.passages).toBe(surface.cellCount - 1);
  });
});

describe('what the panel is told before anything is built', () => {
  it.each([
    ['cuboctahedron', 3],
    ['octahedron', 4],
    ['icosahedron', 2],
    ['rhombicuboctahedron', 3],
    ['icosidodecahedron', 2],
  ] as [string, number][])('counts the seam classes of %s at n=%i without welding them', (shape, n) => {
    const facts = gyrationFacts({ shape, n });
    const surface = buildSurface(createGyration({ shape, n }));
    expect(facts.seamClasses).toBe(surface.cutClasses.length);
    expect(facts.stateCount).toBe(surface.stateCount);
    expect(facts.pieces).toBe(createGyration({ shape, n }).pieceCount);
  });
});

describe('the cuts on offer', () => {
  it('names solids the finder can actually cut, and cuts them twice', () => {
    for (const choice of GYRATIONS) {
      const mech = createGyration({ shape: choice.shape, axisIndex: choice.axisIndex, n: 1 });
      // Three pieces, always: a cut solid that falls into two is a glued pair
      // under another name — see below — so the list holds none of those.
      expect(mech.pieceCount).toBe(3);
      expect(mech.turnSteps).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(GYRATIONS.map(c => c.id)).size).toBe(GYRATIONS.length);
  });

  it('would be offering the same object twice if it cut a solid in half', () => {
    // Two triangular cupolas glued at their hexagon *is* a cuboctahedron cut
    // at its hexagonal cross-section, and the surfaces say so down to the size
    // of every class. That is the whole reason the list above is what it is.
    const cut = buildSurface(createGyration({ shape: 'cuboctahedron', n: 2 }));
    const glued = buildSurface(createJoinedPair({ shape: 'j3', gon: 6, n: 2 }));
    const shape = (s: typeof cut) => ({
      cells: s.cellCount,
      states: s.stateCount,
      sides: s.sideCount,
      classes: s.classCount,
      sizes: s.classSides.map(list => list.length).sort((a, b) => a - b).join(','),
    });
    expect(shape(cut)).toEqual(shape(glued));
    // And no solid on the list is like that, because a pair has one joint.
    for (const choice of GYRATIONS) {
      expect(createGyration({ shape: choice.shape, n: 1 }).pieceCount).toBeGreaterThan(2);
    }
  });

  it('offers only convex solids, which are the ones that turn without catching', () => {
    for (const choice of GYRATIONS) {
      const faces = facesOf(choice.shape);
      for (const face of faces) {
        const anchor = face.vertices[0]!;
        for (const other of faces) {
          for (const v of other.vertices) {
            expect(dot(face.normal, sub(v, anchor))).toBeLessThan(1e-6);
          }
        }
      }
    }
  });
});
