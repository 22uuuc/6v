/**
 * 角色立绘位图映射：seed → 确定性选择一张 AI 动漫立绘位图（对标参考图质感）。
 * 位图位于 public/chars/（构建后 /<base>/chars/char-N.jpg），N ∈ 1..CHAR_COUNT。
 * 无位图场景（seed 超出图库仍确定性映射，无需回退条件）。
 */
export const CHAR_COUNT = 6;

function hashSeed(seed: string): number {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 返回角色位图 URL（相对 base path，GitHub Pages /6v/ 与本地 dev / 均可用） */
export function charArtUrl(seed: string): string {
  const base = import.meta.env.MIAODA_CLIENT_BASE_PATH || '/';
  const b = base.endsWith('/') ? base : `${base}/`;
  const idx = (hashSeed(seed) % CHAR_COUNT) + 1;
  return `${b}chars/char-${idx}.jpg`;
}
