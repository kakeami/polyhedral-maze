# Benchmarks for the folding maze

These scripts measure how a design is found for the folding page (`/fold/`):
one printed pattern that is a perfect maze in every pose the object folds into.
Each script runs the source code directly. Nothing here is part of the site
build or the test suite.

Node 23.6 or later runs the TypeScript as it is. On Node 22.6 to 23.5, add
`--experimental-strip-types`.

```sh
npm run bench:scale                                  # how big the problem is, pose by pose
npm run bench -- --methods all --rulings 4 --seeds 1000-1009 --cap 60
npm run bench:summary -- bench/results/<file>.jsonl
npm run bench:check                                  # type-check this directory
```

## What is compared

| method | what it is |
|---|---|
| `cell` | The cell-level anneal (`searchAllStates`): one boolean per side class, every cell scored. It is restarted with a fresh seam set for as long as the cap allows. |
| `random` | The contracted search, with each move a wall or a seam drawn uniformly. Opening a wall inside one block is still not a move. |
| `repair` | The contracted search with aimed moves: cut the block a loop runs through, or join two blocks across a gap. |
| `neutral` | The contracted search that solves the count equations first, then anneals with moves that leave every count unchanged. This is what the page runs. |

All four run from one seed. They make attempt after independent attempt until
a design is perfect in every pose or the cap runs out. The cap is checked
between attempts (between rounds for `cell`), so a run that finds nothing can
go one attempt past the cap. Its record gives the seconds it actually took.

Building the surface and checking the answer are not timed. Every design
reported perfect is checked pose by pose with `stateStats`. A design that fails
this check stops the run with an error rather than being counted as a miss.

## Results files

`bench/run.ts` appends one JSON line per run. Before the runs, it writes a header line
with the commit, whether the working tree was clean, the Node version and the
machine. A run that is already in the file is skipped, so a long run that was
stopped can be resumed with the same command. `--shard i/n` splits the runs
between processes.

`bench/summarize.ts` will not combine files made at different commits, or made
on a dirty working tree unless `--allow-dirty` is given.

`bench/results/` is not tracked. A run worth keeping should be made on a clean,
tagged commit and archived with that release.

## Measuring time

- Run at most two processes at once, on a machine doing nothing else. When more
  share the machine, the times measure contention as much as the search. They
  can only be compared with runs made at the same moment.
- The default seeds start at 1000. The page ships designs for seeds 42 and 1 to
  6, which were chosen so that no search is needed.
