/**
 * Every pose of every object the folding page offers, drawn at one scale with
 * the maze the page ships for it: a row an object, a picture a pose.
 *
 *   node figures/gallery.ts [--cells 2] [--seed 42] [--width 160] [--out figures/out/gallery.pdf]
 *
 * One scale for the whole figure, so the twelve-cube ring is drawn larger than
 * the rings of eight because it is larger.
 */
import { FOLD_OBJECTS } from '../src/ui/fold-objects.ts';
import type { PageItem } from '../src/render/face-page-model.ts';
import { build, parseArgs, poseName } from '../bench/lib.ts';
import { OUT_DIR, shippedDesign, writePdf } from './lib.ts';
import { drawPose, extent, placeDrawing, restingTurn, turnedMechanism } from './scene.ts';
import type { Drawing } from './scene.ts';

const args = parseArgs(process.argv.slice(2));
const cells = Number(args.get('cells') ?? 2);
const seed = Number(args.get('seed') ?? 42);
const width = Number(args.get('width') ?? 160);
const out = args.get('out') ?? `${OUT_DIR}/gallery.pdf`;

const NAME_COLUMN = 24;
const GAP = 2.5;
const LABEL = 1.6;
const LABEL_GAP = 1.2;
const ROW_GAP = 4;

interface Row {
  readonly name: string;
  readonly poses: { readonly drawing: Drawing; readonly label: string }[];
}

const rows: Row[] = FOLD_OBJECTS.map(object => {
  const { mechanism, surface } = build(object, cells);
  const open = shippedDesign(object, cells, surface, seed);
  return {
    name: object.label,
    poses: mechanism.states.map((_, pose) => ({
      drawing: drawPose(turnedMechanism(mechanism, restingTurn(mechanism, surface, pose)), surface, pose, { open }),
      label: poseName(mechanism, pose),
    })),
  };
});

// The largest scale at which the widest row fits beside the names.
const room = width - NAME_COLUMN;
const scale = Math.min(...rows.map(row => {
  const units = row.poses.reduce((sum, p) => sum + extent(p.drawing)[0], 0);
  return (room - GAP * (row.poses.length - 1)) / units;
}));

const items: PageItem[] = [];
let y = 0;
for (const row of rows) {
  const tall = Math.max(...row.poses.map(p => extent(p.drawing)[1])) * scale;
  items.push({ kind: 'text', at: [0, y + tall / 2], text: row.name, size: 2.1, color: [0, 0, 0], align: 'left' });
  let x = NAME_COLUMN;
  for (const pose of row.poses) {
    const [w, h] = extent(pose.drawing);
    // Sat on a common baseline, as the shapes would sit on a table.
    items.push(...placeDrawing(pose.drawing, [x, y + tall - h * scale], scale));
    items.push({
      kind: 'text', at: [x + (w * scale) / 2, y + tall + LABEL_GAP + LABEL / 2],
      text: pose.label, size: LABEL, color: [70, 70, 70],
    });
    x += w * scale + GAP;
  }
  y += tall + LABEL_GAP + LABEL + ROW_GAP;
}

writePdf(out, width, y - ROW_GAP + 1, items);
