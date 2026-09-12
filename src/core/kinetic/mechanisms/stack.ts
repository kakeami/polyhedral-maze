import type { Vec3 } from '../../types.ts';
import type { KineticCell, KineticState, Mechanism, Placement } from '../types.ts';
import { rotZ } from '../types.ts';

export interface StackOptions {
  /** Sides of the prism (m). */
  sides?: number;
  /** Layers threaded on the dowel (n). */
  layers?: number;
  /** Cells across one lateral face. */
  cols?: number;
  /** Cells up one layer. */
  rows?: number;
}

export interface StackMechanism extends Mechanism {
  readonly sides: number;
  readonly layers: number;
  readonly cols: number;
  readonly rows: number;
  /** Index into `cells` for one cell of the lateral surface. */
  cellIndex(layer: number, face: number, row: number, col: number): number;
  /** Rotation offsets (in face steps) of each layer in a state. */
  stateOffsets(index: number): number[];
}

/**
 * The stack: a prism sliced into layers, threaded on a wooden dowel, each layer
 * free to turn by whole faces. The dowel makes it the sturdiest of the
 * mechanisms and the easiest to build at home, which is why it goes first.
 *
 * Only the lateral surface carries the maze — the two end faces are blank
 * because the dowel passes through them. The maze therefore lives on a tube,
 * with a free rim top and bottom.
 */
export function createStack(options: StackOptions = {}): StackMechanism {
  const sides = options.sides ?? 6;
  const layers = options.layers ?? 4;
  const cols = options.cols ?? 3;
  const rows = options.rows ?? 3;
  if (sides < 3) throw new Error('a stack needs at least 3 sides');
  if (layers < 2) throw new Error('a stack needs at least 2 layers');
  if (cols < 1 || rows < 1) throw new Error('cols and rows must be positive');

  const step = (2 * Math.PI) / sides;
  const edgeLength = 2 * Math.sin(Math.PI / sides);
  // Square cells: a layer is as tall as `rows` cell widths.
  const layerHeight = (rows * edgeLength) / cols;
  const totalHeight = layers * layerHeight;

  const corner = (angle: number): [number, number] => [Math.cos(angle), Math.sin(angle)];
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  const cells: KineticCell[] = [];
  const cellsPerLayer = sides * rows * cols;
  for (let layer = 0; layer < layers; layer++) {
    for (let face = 0; face < sides; face++) {
      const [x0, y0] = corner(face * step);
      const [x1, y1] = corner((face + 1) * step);
      for (let row = 0; row < rows; row++) {
        const zLow = -layerHeight / 2 + (row * layerHeight) / rows;
        const zHigh = -layerHeight / 2 + ((row + 1) * layerHeight) / rows;
        for (let col = 0; col < cols; col++) {
          const tLeft = col / cols;
          const tRight = (col + 1) / cols;
          const left: [number, number] = [lerp(x0, x1, tLeft), lerp(y0, y1, tLeft)];
          const right: [number, number] = [lerp(x0, x1, tRight), lerp(y0, y1, tRight)];
          const corners: Vec3[] = [
            [left[0], left[1], zLow],
            [right[0], right[1], zLow],
            [right[0], right[1], zHigh],
            [left[0], left[1], zHigh],
          ];
          cells.push({ piece: layer, corners });
        }
      }
    }
  }

  const zMid = (layer: number): number => (layer + 0.5) * layerHeight - totalHeight / 2;

  // Layer 0 is held fixed: turning the whole object does not change the maze.
  const stateCount = sides ** (layers - 1);
  const stateOffsets = (index: number): number[] => {
    if (index < 0 || index >= stateCount) throw new Error(`no such state: ${index}`);
    const offsets = [0];
    let rest = index;
    for (let layer = 1; layer < layers; layer++) {
      offsets.push(rest % sides);
      rest = Math.floor(rest / sides);
    }
    return offsets;
  };

  const states: KineticState[] = [];
  for (let index = 0; index < stateCount; index++) {
    const offsets = stateOffsets(index);
    const placements: Placement[] = offsets.map((k, layer) => ({
      rot: rotZ(k * step),
      offset: [0, 0, zMid(layer)] as Vec3,
    }));
    states.push(placements);
  }

  return {
    id: `stack-${sides}x${layers}`,
    pieceCount: layers,
    cells,
    states,
    sides,
    layers,
    cols,
    rows,
    stateLabel: (index: number) => stateOffsets(index).join('-'),
    stateOffsets,
    cellIndex: (layer, face, row, col) => {
      if (layer < 0 || layer >= layers) throw new Error(`no such layer: ${layer}`);
      if (face < 0 || face >= sides) throw new Error(`no such face: ${face}`);
      if (row < 0 || row >= rows) throw new Error(`no such row: ${row}`);
      if (col < 0 || col >= cols) throw new Error(`no such col: ${col}`);
      return layer * cellsPerLayer + face * rows * cols + row * cols + col;
    },
  };
}
