/**
 * A design, written down.
 *
 * Searching for a maze that is perfect in every state of a mechanism takes
 * seconds, which is fine to *do* and not fine to make someone wait for every
 * time they open a page. Where the mechanism is fixed — the folding ring has
 * one taping and one shape — the answer can be found once, offline, and kept.
 *
 * A design is a set of side classes that are open, and a class is an index
 * into a surface that a mechanism generates. So what is stored is a bit per
 * class, and the class count with it: if the surface ever changes shape, the
 * count changes with it, the stored design no longer fits, and it is thrown
 * away rather than drawn as a maze it is not. That is the whole guard, and it
 * is a cheap one — what is really being trusted is the check the caller makes
 * afterwards, that the design it decoded is in fact perfect in every state.
 *
 * Base64 over a bitset, rather than a list of numbers, because the bitset is a
 * third of the size in source and the numbers say nothing to a reader either
 * way. Its own alphabet rather than `btoa`, because `core/` does not touch
 * anything the browser happens to provide.
 */

export interface StoredDesign {
  /** Cells across one face — which ruling of the object this design is for. */
  readonly cells: number;
  /** Side classes the surface had when this was found. */
  readonly classCount: number;
  /** One bit per class, base64. */
  readonly open: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const VALUE = new Map<string, number>(
  [...ALPHABET].map((character, index) => [character, index]),
);

export function encodeOpenClasses(open: Iterable<number>, classCount: number): string {
  const bytes = new Uint8Array(Math.ceil(classCount / 8));
  for (const classId of open) {
    if (classId < 0 || classId >= classCount) {
      throw new Error(`class ${classId} is outside a surface of ${classCount}`);
    }
    bytes[classId >> 3]! |= 1 << (classId & 7);
  }

  let text = '';
  for (let at = 0; at < bytes.length; at += 3) {
    const a = bytes[at]!;
    const b = bytes[at + 1] ?? 0;
    const c = bytes[at + 2] ?? 0;
    const left = bytes.length - at;
    text += ALPHABET[a >> 2];
    text += ALPHABET[((a & 3) << 4) | (b >> 4)];
    if (left > 1) text += ALPHABET[((b & 15) << 2) | (c >> 6)];
    if (left > 2) text += ALPHABET[c & 63];
  }
  return text;
}

export function decodeOpenClasses(stored: StoredDesign): Set<number> {
  const bytes = new Uint8Array(Math.ceil(stored.classCount / 8));
  let bit = 0;
  let held = 0;
  let at = 0;
  for (const character of stored.open) {
    const value = VALUE.get(character);
    if (value === undefined) throw new Error(`not a stored design: ${character}`);
    held = (held << 6) | value;
    bit += 6;
    if (bit >= 8) {
      bit -= 8;
      if (at < bytes.length) bytes[at++] = (held >> bit) & 0xff;
    }
  }

  const open = new Set<number>();
  for (let classId = 0; classId < stored.classCount; classId++) {
    if (bytes[classId >> 3]! & (1 << (classId & 7))) open.add(classId);
  }
  return open;
}
