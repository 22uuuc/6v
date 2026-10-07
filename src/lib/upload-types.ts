// EXPORTS: IBookDraft, EMPTY_DRAFT
import type { BookGenre, CoverFont, CoverStyle } from '@/lib/types';

/** 上传作品时的作品信息草稿 */
export interface IBookDraft {
  title: string;
  genre: BookGenre;
  coverScene: string;
  /** 封面视觉风格（anime 日系漫感 / fresh 清新治愈 / dark 暗夜玄幻 / classic 经典网文） */
  coverStyle: CoverStyle;
  /** 封面来源：svg 程序化封面 / image 本地上传封面 */
  coverType: 'svg' | 'image';
  /** 本地上传的封面图（未上传时为 null） */
  coverFile: File | null;
  /** 书名字体（COVER_FONTS.value） */
  coverFont: CoverFont;
  tags: string;
  description: string;
  serial: 'serial' | 'finished';
  chapterPrice: number;
}

export const EMPTY_DRAFT: IBookDraft = {
  title: '',
  genre: '都市',
  coverScene: 'street',
  coverStyle: 'classic',
  coverType: 'svg',
  coverFile: null,
  coverFont: 'default',
  tags: '',
  description: '',
  serial: 'serial',
  chapterPrice: 0,
};
