import type { Face } from '../../types.ts';
import type { Vec2 } from '../../vec2.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { extrudeFrame } from './_frame.ts';

/**
 * Square Torus: a 3×3×1 block of unit cubes with the center column removed.
 * The simplest lattice toroid — 32 unit-square faces, genus 1
 * (V=32, E=64, F=32, χ=0).
 *
 * Top and bottom rings are 8 unit squares each; the outer wall is split into
 * 3 squares per side so that every face meets its neighbors edge-to-edge.
 */
function squareTorusFaces(): Face[] {
  const cells: Vec2[][] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === 1 && j === 1) continue; // the hole
      const x0 = i - 1.5;
      const y0 = j - 1.5;
      cells.push([
        [x0, y0],
        [x0 + 1, y0],
        [x0 + 1, y0 + 1],
        [x0, y0 + 1],
      ]);
    }
  }
  return extrudeFrame(cells, 1);
}

export class SquareTorus extends Solid {
  protected readonly _faces = normalizeFaces(squareTorusFaces(), 1);
}

export { squareTorusFaces };
