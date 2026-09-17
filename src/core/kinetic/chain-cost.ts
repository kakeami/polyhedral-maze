/**
 * Scoring every state of a turning mechanism without visiting one.
 *
 * A design is scored by how far each state is from being a perfect maze:
 *
 *     cost(state) = (components - 1) + cycles
 *
 * which is zero exactly when the state is one. Written out over the blocks —
 * `components = blocks - unions` and `cycles = passages - unions` — that is
 *
 *     cost = 2 * components + passages - blocks - 1
 *
 * and now only `components` is hard, because `blocks` does not depend on the
 * state at all and `passages` is a sum of one number per seam.
 *
 * `components` yields to the line the pieces sit in. Walk it from one end,
 * carrying the partition that everything behind has induced on the piece in
 * hand; a component with no block left in that piece can never be joined to
 * anything again, so it is counted and forgotten. Every turn of every seam is
 * tried at each step, and prefixes that induce the same partition are carried
 * together — which is the whole saving, since the number of partitions a piece
 * of half a dozen blocks can be in is far smaller than the number of ways the
 * seams behind it can be turned.
 *
 * A stack of six twelve-sided rings has 248832 states and this walks five
 * seams of twelve turns.
 */

import type { Chain } from './chain.ts';

export interface ChainScore {
  /** Summed over every state; zero exactly when every one is a perfect maze. */
  readonly cost: number;
  /** How many states are perfect mazes. */
  readonly perfect: number;
  /** A state that is not, or -1 when they all are. */
  readonly witness: number;
  /** Summed over every state: how many pieces its maze falls into. */
  readonly components: number;
  /** Summed over every state: how many open passages close a loop. */
  readonly cycles: number;
  /**
   * Open seam passages in a state — the same number in every state whenever
   * the openings are decided per side class, which is the whole point of the
   * construction. `passagesVary` says whether that held here.
   */
  readonly passages: number;
  readonly passagesVary: boolean;
}

/** What the walk carries: a partition of the piece in hand, and its tally. */
interface Node {
  /** Restricted growth string over the blocks of the current piece. */
  readonly part: Int32Array;
  /** Components already closed off behind, which nothing can reach again. */
  readonly closed: number;
  /** Open passages crossed so far. */
  readonly edges: number;
  /** How many ways the seams behind could have been turned to get here. */
  count: number;
  /** Where it came from, so one failing state can be named at the end. */
  readonly fromNode: number;
  readonly fromTurn: number;
}

/**
 * Blocks of every piece, and which piece each block belongs to.
 *
 * Handed in rather than worked out here because the caller — an annealer —
 * already keeps it and relabels it in place after every move.
 */
export interface ChainBlocks {
  /** Block of each cell, dense in `0 .. blockCount - 1`. */
  readonly blockOf: Int32Array;
  readonly blockCount: number;
  /** Blocks of each piece, in the chain's own piece order. */
  readonly blocksOfPiece: readonly Int32Array[];
  /** Where each block sits in its piece's list. */
  readonly slotOfBlock: Int32Array;
  /** Which piece, as an index into the chain's piece order. */
  readonly pieceOfBlock: Int32Array;
}

/** Groups the cells of a design into blocks, ready for `chainScore`. */
export function chainBlocks(
  chain: Chain,
  cellPiece: (cell: number) => number,
  cellCount: number,
  blockRoot: Int32Array,
): ChainBlocks {
  const dense = new Map<number, number>();
  const blockOf = new Int32Array(cellCount);
  const pieceOfRoot: number[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const root = blockRoot[cell]!;
    let id = dense.get(root);
    if (id === undefined) {
      id = dense.size;
      dense.set(root, id);
      pieceOfRoot.push(-1);
    }
    blockOf[cell] = id;
  }
  const slotIn = chain.pieceOrder.map(() => 0);
  const indexOfPiece = new Map<number, number>();
  chain.pieceOrder.forEach((p, i) => indexOfPiece.set(p, i));
  const pieceOfBlock = new Int32Array(dense.size).fill(-1);
  for (let cell = 0; cell < cellCount; cell++) {
    const id = blockOf[cell]!;
    if (pieceOfBlock[id] !== -1) continue;
    pieceOfBlock[id] = indexOfPiece.get(cellPiece(cell))!;
  }
  const lists: number[][] = chain.pieceOrder.map(() => []);
  const slotOfBlock = new Int32Array(dense.size);
  for (let id = 0; id < dense.size; id++) {
    const piece = pieceOfBlock[id]!;
    slotOfBlock[id] = slotIn[piece]!;
    slotIn[piece]!++;
    lists[piece]!.push(id);
  }
  return {
    blockOf,
    blockCount: dense.size,
    blocksOfPiece: lists.map(l => Int32Array.from(l)),
    slotOfBlock,
    pieceOfBlock,
  };
}

/** Restricted growth string of a labelling, so equal partitions share a key. */
function canonical(label: Int32Array, out: Int32Array): string {
  const seen = new Map<number, number>();
  let next = 0;
  let key = '';
  for (let i = 0; i < label.length; i++) {
    let id = seen.get(label[i]!);
    if (id === undefined) {
      id = next++;
      seen.set(label[i]!, id);
    }
    out[i] = id;
    key += id + ',';
  }
  return key;
}

/**
 * Every state of a design, scored in one walk along the chain.
 *
 * `isOpen` is asked once per passage per turn, which is the innermost loop;
 * callers pass a lookup into a flat array rather than a set.
 */
export function chainScore(
  chain: Chain,
  blocks: ChainBlocks,
  isOpen: (classId: number) => boolean,
): ChainScore {
  const { blockOf, blockCount, blocksOfPiece, slotOfBlock } = blocks;
  const seamCount = chain.seams.length;

  let level: Node[] = [];
  const history: Node[][] = [];
  {
    const first = blocksOfPiece[0]!;
    const part = Int32Array.from(first, (_v, i) => i);
    level.push({ part, closed: 0, edges: 0, count: 1, fromNode: -1, fromTurn: -1 });
  }
  history.push(level);

  // Scratch, sized once: the walk runs thousands of times per search.
  const widest = Math.max(...blocksOfPiece.map(b => b.length), 1);
  const parent = new Int32Array(widest * 2);
  const scratch = new Int32Array(widest);

  for (let i = 0; i < seamCount; i++) {
    const here = blocksOfPiece[i]!;
    const next = blocksOfPiece[i + 1]!;
    const seam = chain.seams[i]!;
    const nHere = here.length;
    const nNext = next.length;
    const byKey = new Map<string, number>();
    const built: Node[] = [];

    const find = (x: number): number => {
      let r = x;
      while (parent[r] !== r) r = parent[r] = parent[parent[r]!]!;
      return r;
    };

    for (let node = 0; node < level.length; node++) {
      const from = level[node]!;
      for (let turn = 0; turn < seam.byTurn.length; turn++) {
        const passages = seam.byTurn[turn]!;
        // Slots 0..nHere-1 are this piece's blocks, nHere.. the next piece's.
        for (let k = 0; k < nHere + nNext; k++) parent[k] = k;
        // What is already joined behind us.
        const firstOfPart = new Map<number, number>();
        for (let k = 0; k < nHere; k++) {
          const label = from.part[k]!;
          const head = firstOfPart.get(label);
          if (head === undefined) firstOfPart.set(label, k);
          else parent[find(k)] = find(head);
        }
        let opened = 0;
        for (let k = 0; k < passages.length; k += 3) {
          if (!isOpen(passages[k + 2]!)) continue;
          opened++;
          const ba = blockOf[passages[k]!]!;
          const bb = blockOf[passages[k + 1]!]!;
          const sa = blocks.pieceOfBlock[ba] === i ? slotOfBlock[ba]! : nHere + slotOfBlock[ba]!;
          const sb = blocks.pieceOfBlock[bb] === i ? slotOfBlock[bb]! : nHere + slotOfBlock[bb]!;
          const ra = find(sa);
          const rb = find(sb);
          if (ra !== rb) parent[ra] = rb;
        }
        // A component with nothing in the next piece is shut behind us.
        const reaches = new Set<number>();
        for (let k = 0; k < nNext; k++) reaches.add(find(nHere + k));
        const roots = new Set<number>();
        for (let k = 0; k < nHere; k++) roots.add(find(k));
        let closed = from.closed;
        for (const root of roots) if (!reaches.has(root)) closed++;

        for (let k = 0; k < nNext; k++) scratch[k] = find(nHere + k);
        const part = new Int32Array(nNext);
        const key = `${canonical(scratch.subarray(0, nNext), part)}|${closed}|${from.edges + opened}`;
        const had = byKey.get(key);
        if (had === undefined) {
          byKey.set(key, built.length);
          built.push({
            part,
            closed,
            edges: from.edges + opened,
            count: from.count,
            fromNode: node,
            fromTurn: turn,
          });
        } else {
          built[had]!.count += from.count;
        }
      }
    }
    level = built;
    history.push(level);
  }

  let cost = 0;
  let perfect = 0;
  let componentSum = 0;
  let cycleSum = 0;
  let passages = -1;
  let passagesVary = false;
  let worstNode = -1;
  let worstCost = 0;
  for (let node = 0; node < level.length; node++) {
    const end = level[node]!;
    let parts = 0;
    for (let k = 0; k < end.part.length; k++) parts = Math.max(parts, end.part[k]! + 1);
    const components = end.closed + parts;
    const own = 2 * components + end.edges - blockCount - 1;
    cost += own * end.count;
    componentSum += components * end.count;
    // What is left of the cost once the pieces are counted is the loops:
    // `cost = (components - 1) + cycles` is where the whole scoring started.
    cycleSum += (own - (components - 1)) * end.count;
    if (passages === -1) passages = end.edges;
    else if (end.edges !== passages) passagesVary = true;
    if (own === 0) perfect += end.count;
    else if (own > worstCost) {
      worstCost = own;
      worstNode = node;
    }
  }

  let witness = -1;
  if (worstNode !== -1) {
    const turns = new Array<number>(seamCount).fill(0);
    let node = worstNode;
    for (let i = seamCount; i > 0; i--) {
      const at = history[i]![node]!;
      turns[i - 1] = at.fromTurn;
      node = at.fromNode;
    }
    witness = chain.stateOfTurns(turns);
  }
  return {
    cost,
    perfect,
    witness,
    components: componentSum,
    cycles: cycleSum,
    passages: passages === -1 ? 0 : passages,
    passagesVary,
  };
}
