/**
 * 位图映射：seed + 题材 → 确定性选择一张 AI 动漫位图（对标参考图质感）。
 * - 角色立绘：public/chars/char-N.jpg，N ∈ 1..18（1..6 通用 IP 角色，7..18 按题材分组）
 * - 场景封面：public/scenes/scene-N.jpg，N ∈ 1..12（按题材分组）
 * 无匹配题材时回退全局 hash，无需额外兜底。
 */
export const CHAR_COUNT = 6;

/** 题材 → 角色位图（2 张/组）与场景位图（2 张/组）分组 */
const GENRE_GROUPS: { keys: string[]; chars: [number, number]; scenes: [number, number] }[] = [
  { keys: ['玄幻', '仙侠', '奇幻', '神话', '修真'], chars: [7, 8], scenes: [1, 2] },
  { keys: ['都市', '现代', '职场', '豪门', '娱乐'], chars: [9, 10], scenes: [3, 4] },
  { keys: ['悬疑', '推理', '惊悚', '刑侦', '侦探'], chars: [11, 12], scenes: [5, 6] },
  { keys: ['治愈', '日常', '轻小说', '青春', '甜宠', '校园'], chars: [13, 14], scenes: [7, 8] },
  { keys: ['科幻', '末世', '星际', '未来', '机甲', '游戏'], chars: [15, 16], scenes: [9, 10] },
  { keys: ['武侠', '古风', '历史', '宫廷', '江湖'], chars: [17, 18], scenes: [11, 12] },
];

function hashSeed(seed: string): number {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function baseUrl(): string {
  const base = import.meta.env.MIAODA_CLIENT_BASE_PATH || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** 在 [lo, hi] 区间按 seed 确定性选一个编号 */
function pickIn(seed: string, lo: number, hi: number): number {
  return lo + (hashSeed(seed) % (hi - lo + 1));
}

/** 题材命中：返回分组；否则 null */
function groupOf(genre?: string) {
  const g = String(genre ?? '');
  return GENRE_GROUPS.find((gr) => gr.keys.some((k) => g.includes(k))) ?? null;
}

/** 互动 IP 角色位图（通用 6 张，按 seed 全局确定性映射） */
export function charArtUrl(seed: string): string {
  const idx = (hashSeed(seed) % CHAR_COUNT) + 1;
  return `${baseUrl()}chars/char-${idx}.jpg`;
}

/** 漫画/动漫频道角色位图（按题材分组，组内 2 张确定性映射） */
export function charArtByGenre(seed: string, genre?: string): string {
  const g = groupOf(genre);
  const idx = g ? pickIn(seed, g.chars[0], g.chars[1]) : (hashSeed(seed) % 18) + 1;
  return `${baseUrl()}chars/char-${idx}.jpg`;
}

/** 小说/视频/游戏场景位图（按题材分组，组内 2 张确定性映射） */
export function sceneArtUrl(seed: string, genre?: string): string {
  const g = groupOf(genre);
  const idx = g ? pickIn(seed, g.scenes[0], g.scenes[1]) : (hashSeed(seed) % 12) + 1;
  return `${baseUrl()}scenes/scene-${idx}.jpg`;
}

/** 首页 Hero / 频道头图横幅位图（16:9 动漫横幅，按 seed 全局确定性映射） */
export function heroArtUrl(seed: string): string {
  const idx = (hashSeed(seed) % 6) + 1;
  return `${baseUrl()}hero/hero-${idx}.jpg`;
}

/** 墨影书灵 IP 动漫立绘（圆形头像，happy→mascot-2，其余→mascot-1） */
export function mascotArtUrl(mood?: string): string {
  const idx = mood === 'happy' ? 2 : 1;
  return `${baseUrl()}mascot/mascot-${idx}.jpg`;
}