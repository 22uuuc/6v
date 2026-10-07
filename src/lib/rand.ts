// EXPORTS: hashString, mulberry32, makeRand(seed), randPick

/** 字符串 → 32 位哈希种子（确定性，无副作用） */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 确定性伪随机数生成器 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 基于任意字符串种子的随机工具（纯函数） */
export function makeRand(seed: string) {
  const rnd = mulberry32(hashString(seed));
  return {
    /** [0,1) */
    next: rnd,
    /** [min,max) */
    range: (min: number, max: number) => min + rnd() * (max - min),
    /** [min,max] 整数 */
    int: (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1)),
    /** 从数组取一个 */
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)],
  };
}

/** 随机取一个（给定种子，纯函数） */
export function randPick<T>(seed: string, arr: readonly T[]): T {
  return arr[Math.floor(mulberry32(hashString(seed))() * arr.length)];
}
