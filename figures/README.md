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
node figures/contraction.ts                   # one pose as a tree on cells and on blocks
node figures/dependency.ts                    # the count equations' dependencies, two objects
node figures/nets.ts                          # the infinity cube's two cubes, unfolded
node figures/fold-graph.ts                    # the infinity cube's poses round a ring of single folds
node figures/fold-distances.ts                # folds between every two poses, a LaTeX table an object
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

- **`contraction.ts`** — one pose (`--object infinity-cube --cells 4 --pose "Cube 1"`)
  twice: the maze with the tree its passages make on the cells, and the blocks
  (cells a face's open walls join, coloured so that no two touching share a
  colour) with the tree the seam passages make on them. Only the side facing
  the viewer is drawn; the counts it prints are for the whole pose, and it
  stops if either is not a tree.
- **`dependency.ts`** — for the infinity cube and for the star cube with its
  four hooks, the dependency between the poses' count equations with the
  fewest poses (weights of one, searched exhaustively): the poses it weights,
  and a row for each set of faces those poses show alike. It checks that the
  weights cancel every face and every seam class's passage count, that they
  sum to zero on the infinity cube and not on the star cube, and that
  `countsAreConsistent` says the same.

- **`nets.ts`** — poses that are boxes (`--poses "Cube 1,Cube 2"`) unfolded
  into a cross, side by side at one scale: the maze on show, the marks on show
  and the walk between them, broken where the net is cut. Each piece keeps one
  pale colour in every net, so two cubes made of the same eight pieces show
  which faces each piece turns out. A pose that is not a box is refused.
- **`fold-graph.ts`** — an object's poses (`--object infinity-cube`) round a
  ring, a line wherever one fold takes one pose to another, each piece in the
  colour it has in the nets. Two poses with the same neighbours share a place,
  one inside the ring and one outside. It refuses an object whose places do
  not make one ring, or where the folds between two poses are not the steps
  between them on the drawing: the infinity cube and the frame loop pass.
- **`fold-distances.ts`** — for every object, the fewest folds between each
  two poses, through any shapes on the way (`poseDistances`), as a LaTeX
  `tabular` in `figures/out/fold-distances.tex`, headed by the commit, and
  printed.

Line widths are millimetres on the page and do not grow with a drawing;
everything else is in cube edges until a figure scales it.

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
