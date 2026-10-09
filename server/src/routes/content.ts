import { Router } from 'express';
import { prisma } from '../db.js';
import { fail, ok, str, wrap } from '../lib/http.js';
import { uid, audit } from '../lib/audit.js';
import { addExp } from '../lib/exp.js';
import { scanFields } from '../lib/scan.js';
import { parseJson, toJson } from '../lib/json.js';
import { verifyAccess } from '../lib/jwt.js';
import { bookJson, chapterJson, getSettings, isUnlocked, isVip, settingsPublic } from '../lib/access.js';
import { requireAuth } from '../middleware/auth.js';

export const contentRouter = Router();

/** 可选登录态：带 token 则解析挂 req.auth，不带也放行 */
export function optionalAuth(req: { headers: Record<string, unknown>; auth?: { userId: string; role: string } }, _res: unknown, next: () => void): void {
  const header = (req.headers.authorization as string) || '';
  if (header.startsWith('Bearer ')) {
    const payload = verifyAccess(header.slice(7));
    if (payload) req.auth = { userId: payload.sub, role: payload.role };
  }
  next();
}

async function userOf(req: { auth?: { userId: string } }) {
  if (!req.auth) return null;
  return prisma.user.findUnique({ where: { id: req.auth.userId } });
}

// ── 公开快照 / 设置 ──────────────────────────────────────────

contentRouter.get(
  '/bootstrap',
  wrap(async (_req, res) => {
    const [settings, books] = await Promise.all([
      getSettings(),
      prisma.book.findMany({ where: { status: 'published' }, orderBy: { createdAt: 'desc' } }),
    ]);
    ok(res, {
      settings: settingsPublic(settings),
      books: books.map(bookJson),
      featured: books.filter((b) => b.featured).map(bookJson),
      serverTime: Date.now(),
    });
  }),
);

contentRouter.get(
  '/settings',
  wrap(async (_req, res) => {
    ok(res, { settings: settingsPublic(await getSettings()) });
  }),
);

// ── 书目 ─────────────────────────────────────────────────────

contentRouter.get(
  '/books',
  wrap(async (req, res) => {
    const { type, genre } = req.query as { type?: string; genre?: string };
    const books = await prisma.book.findMany({
      where: { status: 'published', ...(type ? { type } : {}), ...(genre ? { genre } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, { books: books.map(bookJson) });
  }),
);

contentRouter.get(
  '/books/:id',
  optionalAuth,
  wrap(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) {
      fail(res, 404, '作品不存在');
      return;
    }
    if (book.status !== 'published') {
      const me = await userOf(req);
      const allowed = me && (me.role === 'admin' || me.id === book.authorId);
      if (!allowed) {
        fail(res, 404, '作品不存在');
        return;
      }
    }
    ok(res, { book: bookJson(book) });
  }),
);

contentRouter.post(
  '/books/:id/view',
  wrap(async (req, res) => {
    await prisma.book.update({ where: { id: req.params.id }, data: { views: { increment: 1 } } }).catch(() => null);
    ok(res);
  }),
);

// ── 章节目录（含 locked，不含正文）与正文（403 核心接口） ────

contentRouter.get(
  '/books/:id/chapters',
  optionalAuth,
  wrap(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) {
      fail(res, 404, '作品不存在');
      return;
    }
    const me = await userOf(req);
    const chapters = await prisma.chapter.findMany({ where: { bookId: book.id }, orderBy: { index: 'asc' } });
    const toc = [];
    for (const c of chapters) {
      const unlocked = await isUnlocked(me, book.id, 'chapter', c.id, c.price);
      toc.push({ id: c.id, bookId: c.bookId, index: c.index, title: c.title, price: c.price, locked: !unlocked });
    }
    ok(res, { chapters: toc });
  }),
);

contentRouter.get(
  '/chapters/:id/content',
  optionalAuth,
  wrap(async (req, res) => {
    const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id } });
    if (!chapter) {
      fail(res, 404, '章节不存在');
      return;
    }
    const me = await userOf(req);
    const book = await prisma.book.findUnique({ where: { id: chapter.bookId } });
    // 作者本人与管理员可读自己的/全站内容（后台核对需要）；普通用户严格校验解锁
    const privileged = me && (me.role === 'admin' || book?.authorId === me.id);
    const unlocked = privileged || (await isUnlocked(me, chapter.bookId, 'chapter', chapter.id, chapter.price));
    if (!unlocked) {
      fail(res, 403, chapter.price > 0 ? '本章节需要解锁后阅读' : '内容暂时无法阅读');
      return;
    }
    ok(res, { chapter: chapterJson(chapter) });
  }),
);

// ── 互动IP / 动漫剧本（整本解锁） ────────────────────────────

contentRouter.get(
  '/books/:id/visual',
  optionalAuth,
  wrap(async (req, res) => {
    const script = await prisma.visualScript.findUnique({ where: { bookId: req.params.id } });
    if (!script) {
      fail(res, 404, '该作品暂无互动剧本');
      return;
    }
    const me = await userOf(req);
    const book = await prisma.book.findUnique({ where: { id: script.bookId } });
    const privileged = me && (me.role === 'admin' || book?.authorId === me.id);
    const unlocked = privileged || (await isUnlocked(me, script.bookId, 'visual', null, book?.chapterPrice ?? 0));
    if (!unlocked) {
      fail(res, 403, '解锁整本后开始阅读');
      return;
    }
    ok(res, { script: { bookId: script.bookId, startNode: script.startNode, nodes: parseJson(script.nodes, []) } });
  }),
);

// ── 漫画 ─────────────────────────────────────────────────────

contentRouter.get(
  '/books/:id/comic',
  optionalAuth,
  wrap(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) {
      fail(res, 404, '作品不存在');
      return;
    }
    const me = await userOf(req);
    const chapters = await prisma.comicChapter.findMany({ where: { bookId: book.id }, orderBy: { index: 'asc' } });
    const list = [];
    for (const c of chapters) {
      const unlocked = await isUnlocked(me, book.id, 'comic', c.id, c.price);
      list.push({
        id: c.id, bookId: c.bookId, index: c.index, title: c.title,
        pageIds: parseJson<string[]>(c.pageIds, []), price: c.price, locked: !unlocked,
      });
    }
    ok(res, { chapters: list });
  }),
);

contentRouter.get(
  '/comics/:chapterId/pages',
  optionalAuth,
  wrap(async (req, res) => {
    const chapter = await prisma.comicChapter.findUnique({ where: { id: req.params.chapterId } });
    if (!chapter) {
      fail(res, 404, '漫画章节不存在');
      return;
    }
    const me = await userOf(req);
    const book = await prisma.book.findUnique({ where: { id: chapter.bookId } });
    const privileged = me && (me.role === 'admin' || book?.authorId === me.id);
    const unlocked = privileged || (await isUnlocked(me, chapter.bookId, 'comic', chapter.id, chapter.price));
    if (!unlocked) {
      fail(res, 403, chapter.price > 0 ? '本话需要解锁后阅读' : '内容暂时无法阅读');
      return;
    }
    const pages = await prisma.comicPage.findMany({ where: { chapterId: chapter.id }, orderBy: { index: 'asc' } });
    ok(res, {
      pages: pages.map((p) => ({
        id: p.id, bookId: p.bookId, chapterId: p.chapterId, index: p.index,
        scene: p.scene, imageKey: p.imageKey || undefined, caption: p.caption || undefined,
        dialogue: parseJson<string[]>(p.dialogue, []),
      })),
    });
  }),
);

// ── 评论 ─────────────────────────────────────────────────────

contentRouter.get(
  '/books/:id/comments',
  wrap(async (req, res) => {
    const comments = await prisma.comment.findMany({
      where: { bookId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    ok(res, {
      comments: comments.map((c) => ({
        id: c.id, bookId: c.bookId, userId: c.userId, userName: c.userName, content: c.content,
        likes: c.likes, likedBy: parseJson<string[]>(c.likedBy, []), replyToId: c.replyToId || undefined,
        replyToName: c.replyToName || undefined, createdAt: c.createdAt.toISOString(),
      })),
    });
  }),
);

contentRouter.post(
  '/books/:id/comments',
  requireAuth,
  wrap(async (req, res) => {
    const me = await userOf(req);
    if (!me) {
      fail(res, 404, '用户不存在');
      return;
    }
    if (me.banned) {
      fail(res, 403, '账号已被封禁');
      return;
    }
    const text = str(req.body?.content, 300) || '';
    if (!text) {
      fail(res, 400, '评论不能为空');
      return;
    }
    const replyToId = str(req.body?.replyToId, 64) || undefined;
    let replyToName: string | undefined;
    if (replyToId) {
      const target = await prisma.comment.findUnique({ where: { id: replyToId } });
      replyToName = target?.userName || undefined;
    }
    // 写入前风险扫描（与前端同规则）
    const hit = scanFields([{ field: 'content', text }]);
    if (hit) {
      await audit(me.id, me.nickname, '发布评论被拦截', `作品 ${req.params.id}`, `命中风险内容: ${hit.hits.join('、')}`);
      fail(res, 400, '内容含风险词，已被拦截并记录');
      return;
    }
    const c = await prisma.comment.create({
      data: {
        id: uid('cm'), bookId: req.params.id, userId: me.id, userName: me.nickname,
        content: text, likedBy: '[]', replyToId: replyToId || null, replyToName: replyToName || null,
      },
    });
    await addExp(me.id, 2, '发布评论');
    ok(res, {
      comment: {
        id: c.id, bookId: c.bookId, userId: c.userId, userName: c.userName, content: c.content,
        likes: 0, likedBy: [], createdAt: c.createdAt.toISOString(),
      },
    });
  }),
);

contentRouter.post(
  '/comments/:id/like',
  requireAuth,
  wrap(async (req, res) => {
    const c = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!c) {
      fail(res, 404, '评论不存在');
      return;
    }
    const likedBy = parseJson<string[]>(c.likedBy, []);
    const has = likedBy.includes(req.auth!.userId);
    const next = has ? likedBy.filter((x) => x !== req.auth!.userId) : [...likedBy, req.auth!.userId];
    const updated = await prisma.comment.update({
      where: { id: c.id },
      data: { likedBy: toJson(next), likes: has ? Math.max(0, c.likes - 1) : c.likes + 1 },
    });
    ok(res, { liked: !has, likes: updated.likes });
  }),
);

contentRouter.delete(
  '/comments/:id',
  requireAuth,
  wrap(async (req, res) => {
    const me = await userOf(req);
    const target = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!me || !target) {
      fail(res, 404, '评论不存在');
      return;
    }
    if (me.role !== 'admin' && target.userId !== me.id) {
      fail(res, 403, '只能删除自己的评论');
      return;
    }
    // 连同回复一起删
    await prisma.comment.deleteMany({ where: { OR: [{ id: target.id }, { replyToId: target.id }] } });
    await audit(me.id, me.nickname, '删除评论', target.content.slice(0, 20), target.id);
    ok(res);
  }),
);

// ── 书架 ─────────────────────────────────────────────────────

contentRouter.get(
  '/shelf',
  requireAuth,
  wrap(async (req, res) => {
    const entries = await prisma.shelfEntry.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { addedAt: 'desc' },
    });
    const bookIds = entries.map((e) => e.bookId);
    const books = bookIds.length
      ? await prisma.book.findMany({ where: { id: { in: bookIds } } })
      : [];
    const byId = new Map(books.map((b) => [b.id, b]));
    ok(res, { books: entries.map((e) => byId.get(e.bookId)).filter(Boolean).map((b) => bookJson(b!)) });
  }),
);

contentRouter.get(
  '/shelf/:bookId',
  requireAuth,
  wrap(async (req, res) => {
    const entry = await prisma.shelfEntry.findUnique({
      where: { userId_bookId: { userId: req.auth!.userId, bookId: req.params.bookId } },
    });
    ok(res, { in: !!entry });
  }),
);

contentRouter.post(
  '/shelf/:bookId',
  requireAuth,
  wrap(async (req, res) => {
    const bookId = req.params.bookId;
    const exists = await prisma.shelfEntry.findUnique({
      where: { userId_bookId: { userId: req.auth!.userId, bookId } },
    });
    if (exists) {
      ok(res);
      return;
    }
    await prisma.shelfEntry.create({ data: { userId: req.auth!.userId, bookId } });
    const book = await prisma.book.update({ where: { id: bookId }, data: { likes: { increment: 1 } } }).catch(() => null);
    if (book) await addExp(book.authorId, 3, '作品被收藏');
    ok(res);
  }),
);

contentRouter.delete(
  '/shelf/:bookId',
  requireAuth,
  wrap(async (req, res) => {
    const bookId = req.params.bookId;
    const entry = await prisma.shelfEntry.findUnique({
      where: { userId_bookId: { userId: req.auth!.userId, bookId } },
    });
    if (entry) {
      await prisma.shelfEntry.delete({ where: { userId_bookId: { userId: req.auth!.userId, bookId } } });
      await prisma.book.update({ where: { id: bookId }, data: { likes: { decrement: 1 } } }).catch(() => null);
    }
    ok(res);
  }),
);

// ── 阅读进度 ─────────────────────────────────────────────────

contentRouter.get(
  '/progress/:bookId',
  requireAuth,
  wrap(async (req, res) => {
    const p = await prisma.progress.findUnique({
      where: { userId_bookId: { userId: req.auth!.userId, bookId: req.params.bookId } },
    });
    ok(res, {
      progress: p
        ? { userId: p.userId, bookId: p.bookId, chapterId: p.chapterId || undefined, nodeId: p.nodeId || undefined, updatedAt: p.updatedAt.toISOString() }
        : null,
    });
  }),
);

contentRouter.put(
  '/progress/:bookId',
  requireAuth,
  wrap(async (req, res) => {
    const chapterId = str(req.body?.chapterId, 64);
    const nodeId = str(req.body?.nodeId, 64);
    await prisma.progress.upsert({
      where: { userId_bookId: { userId: req.auth!.userId, bookId: req.params.bookId } },
      update: { chapterId: chapterId || null, nodeId: nodeId || null, updatedAt: new Date() },
      create: { userId: req.auth!.userId, bookId: req.params.bookId, chapterId: chapterId || null, nodeId: nodeId || null },
    });
    ok(res);
  }),
);

contentRouter.get(
  '/recent-reads',
  requireAuth,
  wrap(async (req, res) => {
    const all = await prisma.progress.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });
    const result = [];
    for (const p of all) {
      const book = await prisma.book.findUnique({ where: { id: p.bookId } });
      if (!book) continue;
      const chapter = p.chapterId
        ? await prisma.chapter.findUnique({ where: { id: p.chapterId }, select: { title: true } })
        : null;
      result.push({
        book: bookJson(book),
        chapterTitle: chapter?.title,
        updatedAt: p.updatedAt.toISOString(),
      });
    }
    ok(res, { items: result });
  }),
);

// ── 签到 / 阅读任务 ──────────────────────────────────────────

function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function taskInfo(userId: string) {
  const [today, yesterday] = await Promise.all([
    prisma.dailyTask.findUnique({ where: { userId_date: { userId, date: dayKey() } } }),
    prisma.dailyTask.findUnique({ where: { userId_date: { userId, date: dayKey(-1) } } }),
  ]);
  const payload = parseJson<{ readDone?: boolean }>(today?.payload, {});
  return {
    today: !!today,
    streak: today?.streak ?? (yesterday?.streak ?? 0),
    readDone: !!payload.readDone,
    checkinReward: 10,
    readReward: 5,
  };
}

contentRouter.get(
  '/tasks/checkin-info',
  requireAuth,
  wrap(async (req, res) => {
    ok(res, await taskInfo(req.auth!.userId));
  }),
);

contentRouter.post(
  '/tasks/checkin',
  requireAuth,
  wrap(async (req, res) => {
    const me = await userOf(req);
    if (!me) {
      fail(res, 404, '用户不存在');
      return;
    }
    if (me.banned) {
      fail(res, 403, '账号已被封禁');
      return;
    }
    const info = await taskInfo(me.id);
    if (info.today) {
      fail(res, 400, '今天已经签到过啦，明天再来');
      return;
    }
    const streak = info.streak + 1;
    await prisma.dailyTask.upsert({
      where: { userId_date: { userId: me.id, date: dayKey() } },
      update: { checkinAt: new Date(), streak },
      create: { userId: me.id, date: dayKey(), checkinAt: new Date(), streak },
    });
    await prisma.tx.create({
      data: { id: uid('tx'), userId: me.id, kind: 'settle', coin: 10, note: '每日签到奖励' },
    });
    await prisma.user.update({ where: { id: me.id }, data: { coins: { increment: 10 } } });
    await addExp(me.id, 5, '每日签到');
    await audit(me.id, me.nickname, '每日签到', `连续 ${streak} 天`, '+10 币');
    ok(res, { reward: 10, streak });
  }),
);

contentRouter.post(
  '/tasks/read',
  requireAuth,
  wrap(async (req, res) => {
    const me = await userOf(req);
    if (!me) {
      fail(res, 404, '用户不存在');
      return;
    }
    const info = await taskInfo(me.id);
    if (!info.today) {
      fail(res, 400, '请先完成今日签到');
      return;
    }
    if (info.readDone) {
      fail(res, 400, '今日阅读任务已完成');
      return;
    }
    await prisma.dailyTask.update({
      where: { userId_date: { userId: me.id, date: dayKey() } },
      data: { payload: toJson({ readDone: true }) },
    });
    await prisma.tx.create({
      data: { id: uid('tx'), userId: me.id, kind: 'settle', coin: 5, note: '每日阅读任务奖励' },
    });
    await prisma.user.update({ where: { id: me.id }, data: { coins: { increment: 5 } } });
    ok(res, { reward: 5 });
  }),
);
