/**
 * Seconds to a design against the ruling, one panel an object, one line a
 * method: the median over the seeds, a whisker from the 10th to the 90th
 * percentile, and a hollow mark where some seed ran out of time.
 *
 *   node figures/timing.ts <results.jsonl> ... [--width 160] [--out figures/out/timing.pdf]
 *
 * Read with `readRuns`, so the files have to be one commit and a clean tree,
 * as for `bench/summarize.ts`. A run that ran out of time counts at the
 * seconds it spent, which is the cap or a little past it; so a median at the
 * cap is a lower bound, which the hollow mark says.
 */
import { FOLD_OBJECTS } from '../src/ui/fold-objects.ts';
import type { PageItem } from '../src/render/face-page-model.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import { parseArgs, quantile, readRuns } from '../bench/lib.ts';
import type { RunRecord } from '../bench/lib.ts';
import { OUT_DIR, writePdf } from './lib.ts';
import type { RGB } from './scene.ts';

const argv = process.argv.slice(2);
const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1]!.startsWith('--')));
const args = parseArgs(argv.filter(a => !files.includes(a)));
const width = Number(args.get('width') ?? 160);
const out = args.get('out') ?? `${OUT_DIR}/timing.pdf`;
if (files.length === 0) throw new Error('usage: node figures/timing.ts <results.jsonl> ... [--width 160] [--out file.pdf]');

const { runs } = readRuns(files);

interface Method {
  readonly id: string;
  readonly label: string;
  readonly colour: RGB;
  readonly dash?: [number, number];
  readonly mark: 'circle' | 'square' | 'triangle' | 'diamond';
}

// Categorical slots in their fixed order, the proposed method first; the
// cell-level search, which is no contender past the coarsest rulings, in grey.
const METHODS: readonly Method[] = ([
  { id: 'neutral', label: 'Counts first (proposed)', colour: [0x2a, 0x78, 0xd6], mark: 'circle' },
  { id: 'repair', label: 'Repair moves', colour: [0xeb, 0x68, 0x34], dash: [1.1, 0.6], mark: 'square' },
  { id: 'random', label: 'Random moves', colour: [0x1b, 0xaf, 0x7a], dash: [0.25, 0.45], mark: 'triangle' },
  { id: 'cell', label: 'Cell level', colour: [0x80, 0x7e, 0x78], dash: [2.2, 0.7], mark: 'diamond' },
] satisfies Method[]).filter(m => runs.some(r => r.method === m.id));

const INK: RGB = [30, 30, 30];
const MUTED: RGB = [110, 110, 110];
const GRID: RGB = [225, 225, 222];
const TEXT = 2.3;
const SMALL = 2.0;

// Log scale, from a thousandth of a second to past the cap.
const Y_LO = -3;
const Y_HI = 2;
const X_LO = 1.6;
const X_HI = 10.4;

const LEFT = 11;
const GAP = 4;
const COLUMNS = 3;
const PANEL_H = 36;
const TITLE_H = 4.5;
const AXIS_H = 7;
const LEGEND_H = 7;
const panelW = (width - LEFT - GAP * (COLUMNS - 1)) / COLUMNS;

const byGroup = new Map<string, RunRecord[]>();
for (const r of runs) {
  const key = `${r.method}|${r.object}|${r.cells}`;
  const list = byGroup.get(key);
  if (list) list.push(r);
  else byGroup.set(key, [r]);
}

const items: PageItem[] = [];
const line = (a: Vec2, b: Vec2, stroke: RGB, w: number, dash?: [number, number]): void => {
  items.push({ kind: 'line', a, b, stroke, width: w, ...(dash ? { dash } : {}) });
};
const text = (at: Vec2, s: string, size: number, color: RGB, align: 'left' | 'center' = 'center'): void => {
  items.push({ kind: 'text', at, text: s, size, color, align });
};

function mark(at: Vec2, kind: Method['mark'], colour: RGB, hollow: boolean, r = 0.75): void {
  const pts: Vec2[] = kind === 'circle'
    ? Array.from({ length: 16 }, (_, i) => [at[0] + r * Math.cos((i / 16) * 2 * Math.PI), at[1] + r * Math.sin((i / 16) * 2 * Math.PI)])
    : kind === 'square'
      ? [[at[0] - r * 0.85, at[1] - r * 0.85], [at[0] + r * 0.85, at[1] - r * 0.85], [at[0] + r * 0.85, at[1] + r * 0.85], [at[0] - r * 0.85, at[1] + r * 0.85]]
      : kind === 'triangle'
        ? [[at[0], at[1] - r * 1.1], [at[0] + r, at[1] + r * 0.7], [at[0] - r, at[1] + r * 0.7]]
        : [[at[0], at[1] - r * 1.1], [at[0] + r, at[1]], [at[0], at[1] + r * 1.1], [at[0] - r, at[1]]];
  items.push({ kind: 'poly', pts, fill: hollow ? [255, 255, 255] : colour, stroke: colour, width: 0.22 });
}

// Legend across the top.
{
  let x = LEFT;
  for (const m of METHODS) {
    line([x, LEGEND_H / 2], [x + 6, LEGEND_H / 2], m.colour, 0.3, m.dash);
    mark([x + 3, LEGEND_H / 2], m.mark, m.colour, false);
    text([x + 7.5, LEGEND_H / 2], m.label, TEXT, INK, 'left');
    // Helvetica runs a little over half an em a character.
    x += 7.5 + m.label.length * TEXT * 0.56 + 5;
  }
}

FOLD_OBJECTS.forEach((object, index) => {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const x0 = LEFT + col * (panelW + GAP);
  const y0 = LEGEND_H + row * (TITLE_H + PANEL_H + AXIS_H) + TITLE_H;
  const xOf = (n: number): number => x0 + ((n - X_LO) / (X_HI - X_LO)) * panelW;
  const yOf = (s: number): number => y0 + PANEL_H - ((Math.log10(s) - Y_LO) / (Y_HI - Y_LO)) * PANEL_H;

  const poses = runs.find(r => r.object === object.id)?.states;
  text([x0, y0 - TITLE_H / 2], `${object.label}${poses ? ` · ${poses} poses` : ''}`, TEXT, INK, 'left');

  // Grid, the cap, the axes.
  for (let e = Y_LO; e <= Y_HI; e++) {
    line([x0, yOf(10 ** e)], [x0 + panelW, yOf(10 ** e)], GRID, 0.15);
    if (col === 0) text([x0 - 4, yOf(10 ** e)], e >= 0 ? String(10 ** e) : (10 ** e).toFixed(-e), SMALL, MUTED);
  }
  const cap = runs.find(r => r.object === object.id)?.cap;
  if (cap) {
    line([x0, yOf(cap)], [x0 + panelW, yOf(cap)], MUTED, 0.2, [0.6, 0.6]);
    if (index === 0) text([x0 + panelW - 6, yOf(cap * 1.45)], `${cap} s cap`, SMALL, MUTED);
  }
  line([x0, y0 + PANEL_H], [x0 + panelW, y0 + PANEL_H], MUTED, 0.2);
  for (let n = 2; n <= 10; n++) {
    line([xOf(n), y0 + PANEL_H], [xOf(n), y0 + PANEL_H + 0.8], MUTED, 0.2);
    text([xOf(n), y0 + PANEL_H + 2.2], String(n), SMALL, MUTED);
  }
  if (row === 1) text([x0 + panelW / 2, y0 + PANEL_H + 5.2], 'cells across a face (n)', SMALL, MUTED);

  METHODS.forEach((m, k) => {
    const shift = (k - (METHODS.length - 1) / 2) * 0.13;
    const points: { at: Vec2; lo: number; hi: number; hollow: boolean }[] = [];
    for (let n = 2; n <= 10; n++) {
      const list = byGroup.get(`${m.id}|${object.id}|${n}`);
      if (!list) continue;
      const seconds = list.map(r => r.seconds).sort((a, b) => a - b);
      points.push({
        at: [xOf(n + shift), yOf(quantile(seconds, 0.5))],
        lo: yOf(quantile(seconds, 0.1)),
        hi: yOf(quantile(seconds, 0.9)),
        hollow: list.some(r => !r.ok),
      });
    }
    for (let i = 1; i < points.length; i++) line(points[i - 1]!.at, points[i]!.at, m.colour, 0.3, m.dash);
    for (const p of points) line([p.at[0], p.lo], [p.at[0], p.hi], m.colour, 0.2);
    for (const p of points) mark(p.at, m.mark, m.colour, p.hollow);
  });
});

for (let row = 0; row < 2; row++) {
  items.push({
    kind: 'text', at: [1.5, LEGEND_H + row * (TITLE_H + PANEL_H + AXIS_H) + TITLE_H + PANEL_H / 2],
    text: 'seconds', size: SMALL, color: MUTED, angle: 90,
  });
}
const height = LEGEND_H + 2 * (TITLE_H + PANEL_H + AXIS_H);
writePdf(out, width, height, items);
