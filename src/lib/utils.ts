import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { COVER_FONTS, type CoverFont, type CoverStyle } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 书名字体 key → 字体栈（未设置时默认衬线） */
export function coverFontStack(font?: CoverFont | string): string {
  if (!font) return COVER_FONTS[0].font;
  return COVER_FONTS.find((f) => f.value === font)?.font ?? COVER_FONTS[0].font;
}

/** 按题材推断封面风格（作品未显式设置时兜底） */
export function inferCoverStyle(genre: string): CoverStyle {
  const fresh = ['青春', '都市', '现实', '言情'];
  const anime = ['轻小说', '奇幻', '科幻', '游戏', '历史'];
  const dark = ['玄幻', '仙侠', '悬疑'];
  if (anime.includes(genre)) return 'anime';
  if (fresh.includes(genre)) return 'fresh';
  if (dark.includes(genre)) return 'dark';
  return 'classic';
}
