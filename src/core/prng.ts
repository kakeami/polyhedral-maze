export interface Rng {
  next(): number;
  nextInt(max: number): number;
  shuffle<T>(arr: T[]): void;
  choice<T>(arr: T[]): T;
}

export function createRng(seed: number): Rng {
  let s = seed | 0;

  function mulberry32(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next(): number {
      return mulberry32();
    },
    nextInt(max: number): number {
      return Math.floor(mulberry32() * max);
    },
    shuffle<T>(arr: T[]): void {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(mulberry32() * (i + 1));
        const tmp = arr[i]!;
        arr[i] = arr[j]!;
        arr[j] = tmp;
      }
    },
    choice<T>(arr: T[]): T {
      return arr[Math.floor(mulberry32() * arr.length)]!;
    },
  };
}
