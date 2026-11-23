/**
 * The interchange maze: one printing, played across the shapes it folds into.
 *
 * A folding maze is a perfect maze in each shape, and a walk stays in the
 * shape it started in. Here the shape is part of where a finger is. A *place*
 * is a shape together with a cell on show in it; a finger **walks** to the
 * next cell through an open side, in the shape the object is in, and on a
 * **mark** — the start, the goal, or a station — and nowhere else, the object
 * may be **folded** into a neighbouring shape that keeps that mark on show,
 * the finger staying where it is.
 *
 * What is asked of a maze:
 *
 * 1. no shape has a loop in it;
 * 2. the places a finger can get to from the start, with the walks and the
 *    folds between them, are one tree — so between any two of them there is
 *    exactly one way, the goal and every station among them;
 * 3. every cell can be walked on in at least one shape.
 *
 * A shape is therefore not one maze but several pieces — *islands* — and the
 * islands with no mark on them cannot be entered in that shape at all. That is
 * the point: an island across a wall may be a fold and a walk away.
 *
 * Two things make this cheap where the folding maze is a search. Nothing is
 * counted — no shape has to come out a tree — and the three conditions are
 * kept rather than found: sides are opened a class at a time, and marks added
 * one at a time, and neither is ever done where it would close a loop among
 * the places. What comes out satisfies (1) and (2) by construction; (3), and
 * what the route looks like, are measured afterwards and a maze that falls
 * short is thrown away and another tried, a few milliseconds apiece.
 *
 * Which shapes are walked in is the caller's to say. A hand also stops at
 * shapes halfway between two of them (a plank with one end folded over); a
 * fold between two shapes that are walked in may pass through those, and a
 * mark that is on show at both ends is on show all the way.
 *
 * DOM-free. Classes are the surface's (`surface.ts`): one printing means a
 * class is open in every shape at once.
 */

import type { Rng } from '../prng.ts';
import { createRng } from '../prng.ts';
import type { KineticSurface } from './surface.ts';

export interface InterchangeWorld {
  readonly surface: KineticSurface;
  /** The shapes that are walked in, as states of the mechanism. */
  readonly lines: readonly number[];
  /**
   * The pairs of them a hand folds between without stopping at a third: a run
   * of single folds past shapes that are not walked in. By position in `lines`.
   */
  readonly transfers: readonly (readonly [number, number])[];
  /** Per line: 1 where the cell is on show. */
  readonly visible: readonly Uint8Array[];
  /** Cells on show in at least one line — the ones condition 3 is about. */
  readonly shownCells: number;
  readonly placeCount: number;
  /**
   * Per class: the walks it opens, as pairs of places. A place is
   * `line * cellCount + cell`.
   */
  readonly classEdges: readonly Int32Array[];
  /** The classes that open any walk at all. */
  readonly classes: readonly number[];
}

/**
 * What the surface looks like to a finger that may only fold on a mark.
 *
 * `distances` is `poseDistances` of the mechanism's fold graph: the folds
 * between every two states.
 */
export function buildInterchangeWorld(
  surface: KineticSurface,
  lines: readonly number[],
  distances: readonly (readonly number[])[],
): InterchangeWorld {
  const cellCount = surface.cellCount;
  const stateCount = distances.length;
  const lineOf = new Int32Array(stateCount).fill(-1);
  lines.forEach((state, index) => { lineOf[state] = index; });

  const transfers: [number, number][] = [];
  lines.forEach((start, from) => {
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length > 0) {
      const at = stack.pop()!;
      for (let to = 0; to < stateCount; to++) {
        if (distances[at]![to] !== 1 || seen.has(to)) continue;
        seen.add(to);
        const line = lineOf[to]!;
        if (line < 0) stack.push(to);
        else if (from < line) transfers.push([from, line]);
      }
    }
  });

  // Copied: the surface hands out one buffer per state and may reuse it.
  const visible = lines.map(state => Uint8Array.from(surface.visibleOfState(state)));
  let shownCells = 0;
  let placeCount = 0;
  for (let cell = 0; cell < cellCount; cell++) {
    let shown = false;
    for (const row of visible) {
      if (!row[cell]) continue;
      shown = true;
      placeCount++;
    }
    if (shown) shownCells++;
  }

  const lists: number[][] = Array.from({ length: surface.classCount }, () => []);
  const seen = new Set<string>();
  lines.forEach((state, line) => {
    const on = visible[line]!;
    for (const edge of surface.adjOfState(state)) {
      if (!on[edge.a] || !on[edge.b]) continue;
      const a = line * cellCount + Math.min(edge.a, edge.b);
      const b = line * cellCount + Math.max(edge.a, edge.b);
      const key = `${edge.classId}:${a}:${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lists[edge.classId]!.push(a, b);
    }
  });
  const classEdges = lists.map(list => Int32Array.from(list));
  const classes: number[] = [];
  classEdges.forEach((edges, classId) => { if (edges.length > 0) classes.push(classId); });

  return { surface, lines, transfers, visible, shownCells, placeCount, classEdges, classes };
}

/** One walk of the route: a line, and the cells stepped on in it, in order. */
export interface InterchangeLeg {
  /** Position in `world.lines`. */
  readonly line: number;
  /**
   * The cells, first to last. One cell alone is a shape the route only folds
   * through: in on a mark, and out again on the same mark.
   */
  readonly cells: readonly number[];
}

export interface InterchangeMaze {
  /** The open classes — what is printed. */
  readonly open: Set<number>;
  readonly start: number;
  readonly goal: number;
  /** The stations' cells, in the order they were placed. */
  readonly stations: readonly number[];
  /**
   * The one way from start to goal. Between two legs the object is folded, on
   * the cell the first ends and the second begins on. Empty if the goal
   * cannot be reached, which a maze from `createInterchangeSearch` never is.
   */
  readonly route: readonly InterchangeLeg[];
  /** Folds on the route: all of them on stations, since it starts and ends where it likes. */
  readonly folds: number;
  /** Steps walked on the route. */
  readonly steps: number;
  /** Lines the route is folded into and straight out of, no step taken. */
  readonly passedThrough: number;
  /** Stations the route does not fold on: the ways off it. */
  readonly offRoute: number;
  /** Per line: 1 where the cell can be walked on in that line. */
  readonly reached: readonly Uint8Array[];
  /** Whether every cell can be walked on in some line (condition 3). */
  readonly covered: boolean;
  /** Places a finger can get to, of `world.placeCount`. */
  readonly reachedPlaces: number;
}

export interface InterchangeOptions {
  /** Stations to place, the start and the goal not counted. */
  readonly stations: number;
  /** Folds the route should make. */
  readonly folds: number;
  readonly seed: number;
  /** Mazes to try before settling for the nearest. Default 400. */
  readonly maxAttempts?: number;
}

export interface InterchangeResult {
  readonly maze: InterchangeMaze;
  /**
   * Whether it is what was asked for: every cell walkable somewhere, that many
   * stations, that many folds, and a station off the route.
   */
  readonly exact: boolean;
  readonly attempts: number;
}

export interface InterchangeSearch {
  /** Tries one more maze. True once there is nothing left to do. */
  step(): boolean;
  readonly attempts: number;
  readonly maxAttempts: number;
  /** The best so far: what was asked for, or the nearest to it. */
  result(): InterchangeResult;
}

/**
 * Mazes from one seed, an attempt at a time, until one is what was asked for.
 *
 * An attempt is a fraction of a millisecond to a dozen, so this is walked a
 * few at a frame by a page and all at once by a test. What was asked for may
 * not exist — twelve stations on a ruling that has room for five — and then
 * the nearest found is what `result` gives, with `exact` false.
 *
 * A maze that is what was asked for, but whose route folds twice running on
 * one mark, is kept and not yet settled for: the search goes on for as many
 * attempts again as it took (and eight at least), for one that walks between
 * its folds. Either is `exact`.
 */
export function createInterchangeSearch(
  world: InterchangeWorld,
  options: InterchangeOptions,
): InterchangeSearch {
  const maxAttempts = options.maxAttempts ?? 400;
  const rng = createRng(options.seed);
  let attempts = 0;
  let best: InterchangeMaze | null = null;
  let bestRank: number[] = [];
  let exact = false;
  /** The attempt after which an exact maze that passes through lines is settled for. */
  let settleAt = Infinity;
  let done = false;

  const rankOf = (maze: InterchangeMaze): number[] => [
    maze.route.length > 0 ? 0 : 1,
    maze.covered ? 0 : 1,
    maze.offRoute >= 1 ? 0 : 1,
    Math.abs(maze.folds - options.folds),
    Math.abs(maze.stations.length - options.stations),
    maze.passedThrough,
  ];
  const better = (a: number[], b: number[]): boolean => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
    return false;
  };

  return {
    step() {
      if (done) return true;
      attempts++;
      const maze = attemptInterchange(world, options.stations, options.folds, rng);
      const rank = rankOf(maze);
      if (!best || better(rank, bestRank)) {
        best = maze;
        bestRank = rank;
      }
      // Everything but the last part, which is a preference and not a demand.
      if (!exact && bestRank.slice(0, -1).every(part => part === 0)) {
        exact = true;
        settleAt = attempts + Math.max(8, attempts);
      }
      done = attempts >= maxAttempts
        || (exact && (bestRank[bestRank.length - 1] === 0 || attempts >= settleAt));
      return done;
    },
    get attempts() {
      return attempts;
    },
    maxAttempts,
    result() {
      if (!best) throw new Error('no maze has been tried yet');
      return { maze: best, exact, attempts };
    },
  };
}

/** The search run to its end: for tests and for anything that can wait. */
export function findInterchangeMaze(
  world: InterchangeWorld,
  options: InterchangeOptions,
): InterchangeResult {
  const search = createInterchangeSearch(world, options);
  while (!search.step()) { /* an attempt at a time */ }
  return search.result();
}

/** Everything a mark joins: its cell, across each transfer that keeps it on show. */
function foldEdgesOf(world: InterchangeWorld, cell: number): number[] {
  const cellCount = world.surface.cellCount;
  const edges: number[] = [];
  for (const [a, b] of world.transfers) {
    if (world.visible[a]![cell] && world.visible[b]![cell]) {
      edges.push(a * cellCount + cell, b * cellCount + cell);
    }
  }
  return edges;
}

/**
 * One maze, grown from its start.
 *
 * Sides that touch what the start reaches are opened in random order while
 * none closes a loop; when no more fit, a station goes on a cell that is
 * reached in exactly one line — a mark there closes no loop and opens the
 * cell's other lines — and the growing goes on from there. Stations are put
 * as deep (as many folds from the start) as there is until the route can be
 * as long as asked, and anywhere after that, which is where the ways off the
 * route come from. The goal is then a cell at the depth asked for, at a dead
 * end if there is one. What the start never reaches is opened last, the same
 * way, so that it reads as maze and not as blank wall.
 *
 * A mark on show in three or four lines can be folded on twice running, and a
 * route may do that — in on a mark and straight out again on the same one,
 * with no step taken in the line between. It is allowed and not sought: of
 * the cells the goal could go on, one reached with a walk between every two
 * folds is taken first, and the search looks a little longer for a maze whose
 * route is like that (`createInterchangeSearch`).
 */
function attemptInterchange(
  world: InterchangeWorld,
  wantedStations: number,
  wantedFolds: number,
  rng: Rng,
): InterchangeMaze {
  const { surface, visible, classEdges } = world;
  const cellCount = surface.cellCount;
  const lineCount = world.lines.length;
  const places = lineCount * cellCount;

  // Places joined so far, by walks and folds alike.
  const parent = new Int32Array(places);
  for (let i = 0; i < places; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  /** Whether these edges, taken all together, close no loop. */
  const fits = (bundle: ArrayLike<number>): boolean => {
    const local = new Map<number, number>();
    const root = (x: number): number => {
      let up = local.get(x);
      if (up === undefined) {
        local.set(x, x);
        return x;
      }
      while (up !== x) {
        x = up;
        up = local.get(x)!;
      }
      return x;
    };
    for (let i = 0; i < bundle.length; i += 2) {
      const a = root(find(bundle[i]!));
      const b = root(find(bundle[i + 1]!));
      if (a === b) return false;
      local.set(a, b);
    }
    return true;
  };

  // The same edges as lists, for walking along.
  const head = new Int32Array(places).fill(-1);
  const next: number[] = [];
  const to: number[] = [];
  const join = (bundle: ArrayLike<number>): void => {
    for (let i = 0; i < bundle.length; i += 2) {
      const a = bundle[i]!;
      const b = bundle[i + 1]!;
      parent[find(a)] = find(b);
      to.push(b); next.push(head[a]!); head[a] = to.length - 1;
      to.push(a); next.push(head[b]!); head[b] = to.length - 1;
    }
  };

  const open = new Set<number>();
  const marked = new Uint8Array(cellCount);
  const stations: number[] = [];
  const tryMark = (cell: number): boolean => {
    const edges = foldEdgesOf(world, cell);
    if (edges.length === 0 || !fits(edges)) return false;
    join(edges);
    marked[cell] = 1;
    return true;
  };
  const tryOpen = (classId: number): boolean => {
    const edges = classEdges[classId]!;
    if (!fits(edges)) return false;
    join(edges);
    open.add(classId);
    return true;
  };

  const shown: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    if (visible.some(row => row[cell])) shown.push(cell);
  }
  const start = shown[rng.nextInt(shown.length)]!;
  tryMark(start);
  let startPlace = -1;
  for (let line = 0; line < lineCount && startPlace < 0; line++) {
    if (visible[line]![start]) startPlace = line * cellCount + start;
  }
  /** The one place the cell is reached in, or -1 if it is none or several. */
  const onlyReachedPlace = (cell: number, root: number): number => {
    let found = -1;
    for (let line = 0; line < lineCount; line++) {
      const place = line * cellCount + cell;
      if (!visible[line]![cell] || find(place) !== root) continue;
      if (found >= 0) return -1;
      found = place;
    }
    return found;
  };

  const order = [...world.classes];
  const decided = new Uint8Array(classEdges.length);
  const grow = (): void => {
    for (let progress = true; progress;) {
      progress = false;
      rng.shuffle(order);
      for (const classId of order) {
        if (decided[classId]) continue;
        const edges = classEdges[classId]!;
        const root = find(startPlace);
        let touches = false;
        for (let i = 0; i < edges.length; i++) {
          if (find(edges[i]!) === root) {
            touches = true;
            break;
          }
        }
        if (!touches) continue;
        decided[classId] = 1;
        if (tryOpen(classId)) progress = true;
      }
    }
  };

  // Folds and steps from the start, and the way back to it, for every place
  // reached. Folding on the start itself costs nothing: it is where the walk
  // begins, in whichever of its lines.
  const foldsTo = new Int32Array(places);
  /** Folds made straight after a fold, on the same mark: lines only passed through. */
  const passesTo = new Int32Array(places);
  const stepsTo = new Int32Array(places);
  const cameFrom = new Int32Array(places);
  const walkDegree = new Int32Array(places);
  let reachedList: number[] = [];
  const survey = (): void => {
    foldsTo.fill(-1);
    walkDegree.fill(0);
    reachedList = [];
    for (let line = 0; line < lineCount; line++) {
      if (!visible[line]![start]) continue;
      const place = line * cellCount + start;
      foldsTo[place] = 0;
      passesTo[place] = 0;
      stepsTo[place] = 0;
      cameFrom[place] = -1;
      reachedList.push(place);
    }
    for (let i = 0; i < reachedList.length; i++) {
      const at = reachedList[i]!;
      const before = cameFrom[at]!;
      const foldedIn = before >= 0 && before % cellCount === at % cellCount;
      for (let e = head[at]!; e >= 0; e = next[e]!) {
        const other = to[e]!;
        const fold = other % cellCount === at % cellCount;
        if (!fold) walkDegree[at]!++;
        if (foldsTo[other]! >= 0) continue;
        foldsTo[other] = foldsTo[at]! + (fold ? 1 : 0);
        passesTo[other] = passesTo[at]! + (fold && foldedIn ? 1 : 0);
        stepsTo[other] = stepsTo[at]! + (fold ? 0 : 1);
        cameFrom[other] = at;
        reachedList.push(other);
      }
    }
  };

  const cells = [...shown];
  for (let placed = 0; ; placed++) {
    grow();
    if (placed >= wantedStations) break;
    survey();
    const root = find(startPlace);
    const depthOf = (place: number): number => foldsTo[place]!;
    let deepest = 0;
    for (const place of reachedList) deepest = Math.max(deepest, depthOf(place));
    const goDeeper = deepest < wantedFolds;
    rng.shuffle(cells);
    let chosen = -1;
    let chosenDepth = -Infinity;
    for (const cell of cells) {
      if (marked[cell]) continue;
      const place = onlyReachedPlace(cell, root);
      if (place < 0 || !fits(foldEdgesOf(world, cell))) continue;
      if (!goDeeper) {
        chosen = cell;
        break;
      }
      if (depthOf(place) > chosenDepth) {
        chosen = cell;
        chosenDepth = depthOf(place);
        if (chosenDepth === deepest) break;
      }
    }
    if (chosen < 0) break;
    tryMark(chosen);
    stations.push(chosen);
  }

  // The goal: a cell the right number of folds in — failing that, the nearest
  // to it — reached with a walk between every two folds if any is, at a dead
  // end if there is one, and then as far to walk as any.
  survey();
  let goal = -1;
  {
    const root = find(startPlace);
    let bestScore = -Infinity;
    let fresh = false;
    for (const cell of shown) {
      if (cell === start) continue;
      const isStation = marked[cell] === 1;
      let place: number;
      if (isStation) {
        place = -1;
        for (let line = 0; line < lineCount; line++) {
          const at = line * cellCount + cell;
          if (!visible[line]![cell] || foldsTo[at]! < 0) continue;
          if (place < 0 || foldsTo[at]! < foldsTo[place]!) place = at;
        }
      } else {
        place = onlyReachedPlace(cell, root);
        if (place >= 0 && !fits(foldEdgesOf(world, cell))) place = -1;
      }
      if (place < 0) continue;
      const score = -Math.abs(foldsTo[place]! - wantedFolds) * 1e9
        // A cell of its own before a station made over: the count of stations stays.
        + (isStation ? 0 : 5e8)
        - Math.min(passesTo[place]!, 4) * 1e8
        + (walkDegree[place] === 1 ? 5e7 : 0)
        + stepsTo[place]!;
      if (score > bestScore) {
        bestScore = score;
        goal = cell;
        fresh = !isStation;
      }
    }
    if (goal >= 0 && fresh) {
      tryMark(goal);
      grow();
    } else if (goal >= 0) {
      stations.splice(stations.indexOf(goal), 1);
    }
  }

  rng.shuffle(order);
  for (const classId of order) if (!open.has(classId)) tryOpen(classId);

  // What came out.
  survey();
  const reached = visible.map(() => new Uint8Array(cellCount));
  for (const place of reachedList) reached[Math.floor(place / cellCount)]![place % cellCount] = 1;
  let covered = true;
  for (const cell of shown) {
    if (!reached.some(row => row[cell])) {
      covered = false;
      break;
    }
  }

  const route: InterchangeLeg[] = [];
  let folds = 0;
  let steps = 0;
  const foldedOn = new Set<number>();
  if (goal >= 0) {
    // The goal in the line the walk reaches it in: the nearest of its places.
    let end = -1;
    for (let line = 0; line < lineCount; line++) {
      const place = line * cellCount + goal;
      if (!visible[line]![goal] || foldsTo[place]! < 0) continue;
      if (end < 0 || foldsTo[place]! + stepsTo[place]! < foldsTo[end]! + stepsTo[end]!) end = place;
    }
    if (end >= 0) {
      const path: number[] = [];
      for (let at = end; at >= 0; at = cameFrom[at]!) path.push(at);
      path.reverse();
      let leg: number[] = [];
      let line = -1;
      for (const place of path) {
        const here = Math.floor(place / cellCount);
        if (here !== line) {
          if (leg.length > 0) {
            route.push({ line, cells: leg });
            foldedOn.add(place % cellCount);
            folds++;
          }
          leg = [];
          line = here;
        } else {
          steps++;
        }
        leg.push(place % cellCount);
      }
      route.push({ line, cells: leg });
    }
  }

  return {
    open,
    start,
    goal,
    stations,
    route,
    folds,
    steps,
    passedThrough: route.filter(leg => leg.cells.length === 1).length,
    offRoute: stations.filter(cell => !foldedOn.has(cell)).length,
    reached,
    covered,
    reachedPlaces: reachedList.length,
  };
}

/**
 * The three conditions, asked again of the printing alone.
 *
 * Nothing here knows how the maze was made: it takes the open classes and the
 * marks, builds the places and what joins them, and counts. A forest has as
 * many edges as it has nodes less pieces, and a tree one less than its nodes.
 */
export function checkInterchange(
  world: InterchangeWorld,
  maze: Pick<InterchangeMaze, 'open' | 'start' | 'goal' | 'stations'>,
): { forest: boolean; tree: boolean; marksReached: boolean; covered: boolean } {
  const { surface, visible } = world;
  const cellCount = surface.cellCount;
  const lineCount = world.lines.length;
  const places = lineCount * cellCount;
  const walks: number[][] = Array.from({ length: places }, () => []);
  const all: number[][] = Array.from({ length: places }, () => []);
  let walkEdges = 0;
  for (const classId of maze.open) {
    const edges = world.classEdges[classId] ?? [];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i]!;
      const b = edges[i + 1]!;
      walks[a]!.push(b); walks[b]!.push(a);
      all[a]!.push(b); all[b]!.push(a);
      walkEdges++;
    }
  }
  const marks = [maze.start, maze.goal, ...maze.stations];
  for (const cell of marks) {
    const edges = foldEdgesOf(world, cell);
    for (let i = 0; i < edges.length; i += 2) {
      all[edges[i]!]!.push(edges[i + 1]!);
      all[edges[i + 1]!]!.push(edges[i]!);
    }
  }
  const onShow = (place: number): boolean => visible[Math.floor(place / cellCount)]![place % cellCount] === 1;

  // 1. Every line a forest.
  const seen = new Uint8Array(places);
  let islands = 0;
  for (let place = 0; place < places; place++) {
    if (!onShow(place) || seen[place]) continue;
    islands++;
    seen[place] = 1;
    const stack = [place];
    while (stack.length > 0) {
      for (const other of walks[stack.pop()!]!) {
        if (seen[other]) continue;
        seen[other] = 1;
        stack.push(other);
      }
    }
  }
  const forest = walkEdges === world.placeCount - islands;

  // 2. What the start reaches is a tree, with every mark in it.
  const got = new Uint8Array(places);
  const stack: number[] = [];
  for (let line = 0; line < lineCount; line++) {
    if (!visible[line]![maze.start]) continue;
    got[line * cellCount + maze.start] = 1;
    stack.push(line * cellCount + maze.start);
    break;
  }
  let nodes = 0;
  let ends = 0;
  while (stack.length > 0) {
    const at = stack.pop()!;
    nodes++;
    ends += all[at]!.length;
    for (const other of all[at]!) {
      if (got[other]) continue;
      got[other] = 1;
      stack.push(other);
    }
  }
  const tree = ends / 2 === nodes - 1;
  const marksReached = marks.every(cell =>
    visible.some((row, line) => row[cell] === 1 && got[line * cellCount + cell] === 1));

  // 3. Every cell walked on somewhere.
  let covered = true;
  for (let cell = 0; cell < cellCount && covered; cell++) {
    let shown = false;
    let reached = false;
    for (let line = 0; line < lineCount; line++) {
      if (!visible[line]![cell]) continue;
      shown = true;
      if (got[line * cellCount + cell]) reached = true;
    }
    if (shown && !reached) covered = false;
  }
  return { forest, tree, marksReached, covered };
}
