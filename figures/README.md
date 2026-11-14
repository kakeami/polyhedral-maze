# figures/

Figures of the folding maze, drawn from the code rather than from the page, so
that a tagged commit holds the code each figure came from. Every PDF written
here records that commit, and whether the tree was clean, in its metadata
(`pdfinfo file.pdf` shows it as the subject).

They are vector PDFs drawn with jsPDF in Node — no browser, no WebGL — and land
in `figures/out/`, which is not tracked.

```bash
npm run figures:gallery                       # every pose of every object, with its maze
npm run figures:timing -- bench/results/s-contracted/shard-0.jsonl bench/results/s-cell/shard-0.jsonl
npm run figures:verify -- --camera all        # the drawing order, against a ray cast
npm run figures:check                         # type-check figures/
```

## What each one draws

- **`gallery.ts`** — every pose of every object `/fold/` offers, a row an
  object, all at one scale, with the maze the page ships for that ruling and
  seed (`--cells 2`, `--seed 42`). A shipped design is checked to be perfect in
  every pose before it is drawn, as the page checks it. Each pose is turned to
  lie as low as it will, its longest side across the page (`restingTurn`); a
  shape has no way up of its own.
- **`timing.ts`** — seconds to a design against the ruling, a panel an object,
  a line a method: the median over the seeds, a whisker from the 10th to the
  90th percentile, and a hollow mark where some seed ran out of time (its
  median is then a lower bound). Results are read as `bench/summarize.ts`
  reads them (`readRuns`): one commit, a clean tree, no run twice.

## How a pose is drawn

`scene.ts`. The cells on show are grouped into facets — cells of one piece in
one plane that share an edge — and the facets that face the viewer are put in
painting order by a BSP tree, split where no order exists. Each piece of a
facet is filled, shaded by which way it faces, and the facet's edges and
walls are clipped to it, so a split leaves no trace. Walls are the sides whose
class the design leaves closed, drawn only on cells on show, as the page draws
them.

A picture has no unit test, so `check.ts` checks the order instead: at random
points of every pose of every object, from eleven directions, the facet
painted last must be the one nearest the viewer along the line of sight. It
exits non-zero on any point painted from behind, and painting the same
fragments in reverse fails it.
