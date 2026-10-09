import type { Book, Settings, User } from '@prisma/client';
import { prisma } from '../db.js';
import { parseJson } from './json.js';

// ── VIP（与前端 isVip 完全一致） ─────────────────────────────
export function isVip(u: Pick<User, 'vip' | 'vipUntil'>): boolean {
  if (!u.vip) return false;
  if (u.vipUntil && new Date(u.vipUntil).getTime() < Date.now()) return false;
  return true;
}

// ── 行 → 前端 IBook / IChapter 形状 ──────────────────────────
export function bookJson(b: Book) {
  return {
    id: b.id, type: b.type, title: b.title, authorId: b.authorId, authorName: b.authorName,
    genre: b.genre, status: b.status, coverSeed: b.coverSeed, coverStyle: b.coverStyle || undefined,
    coverType: b.coverType || undefined, coverFont: b.coverFont || undefined,
    description: b.description, tags: parseJson<string[]>(b.tags, []), serial: b.serial,
    words: b.words, views: b.views, likes: b.likes, rating: b.rating,
    createdAt: b.createdAt.toISOString(), chapterPrice: b.chapterPrice,
    chapterIds: parseJson<string[]>(b.chapterIds, []), featured: b.featured,
    animeKey: b.animeKey || undefined, gameKind: b.gameKind || undefined, quarantined: b.quarantined,
  };
}

export function chapterJson(c: { id: string; bookId: string; index: number; title: string; content: string; price: number }) {
  return { id: c.id, bookId: c.bookId, index: c.index, title: c.title, content: c.content, price: c.price };
}

// ── 解锁判定（服务端权威，镜像前端 isUnlocked） ─────────────
// 免费(price<=0) 或 VIP 或存在对应 subscribe 交易；互动/动漫为整本（无 chapterId）
export async function isUnlocked(
  user: User | null,
  bookId: string,
  kind: 'chapter' | 'comic' | 'visual',
  targetId: string | null,
  price: number,
): Promise<boolean> {
  if (price <= 0) return true;
  if (!user) return false;
  if (isVip(user)) return true;
  const tx = await prisma.tx.findFirst({
    where: {
      userId: user.id, kind: 'subscribe', bookId,
      ...(targetId ? { chapterId: targetId } : {}),
    },
    select: { id: true },
  });
  return !!tx;
}

// ── 系统设置 ────────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  let s = await prisma.settings.findUnique({ where: { id: 'main' } });
  if (!s) {
    s = await prisma.settings.create({ data: { id: 'main' } });
  }
  return s;
}

/** 公开设置（下发前端；管理字段不下发） */
export function settingsPublic(s: Settings) {
  return {
    siteName: s.siteName,
    announcement: s.announcement,
    vipPrice: s.vipPrice,
    rechargeRate: s.rechargeRate,
    subShare: s.subShare,
    tipShare: s.tipShare,
    openRegister: s.openRegister,
    rechargeMethods: parseJson<string[]>(s.rechargeMethods, []),
    layoutStyle: s.layoutStyle || undefined,
    fontFamily: s.fontFamily || undefined,
    fontSize: s.fontSize || undefined,
    lineHeight: s.lineHeight || undefined,
  };
}
