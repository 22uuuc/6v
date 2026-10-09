// 创作者：资质申请 / 收益统计 / 作品与内容上传（服务端唯一权威，写入前病毒拦截）。
// 镜像前端 api.ts：applyCreator L538 / creatorStats L1396 / createBook L810 / saveChapters L1056 / saveVisualScript L1086 / saveComic L1124。
import { Router } from 'express';
import { prisma } from '../db.js';
import { ok, fail, wrap, str, intVal } from '../lib/http.js';
import { requireAuth, requireAdmin, requireCreator } from '../middleware/auth.js';
import { uid, audit, securityLog } from '../lib/audit.js';
import { addExp } from '../lib/exp.js';
import { scanFields } from '../lib/scan.js';
import { bookJson } from '../lib/access.js';
import { toJson as j } from '../lib/json.js';

export const creatorRouter = Router();
export const applicationsRouter = Router();

const BOOK_TYPES = ['novel', 'visual', 'comic', 'dialogue', 'game'];
const GENRES = ['玄幻', '都市', '科幻', '悬疑', '古言', '青春', '武侠', '奇幻', '仙侠', '历史', '游戏', '言情', '轻小说', '现实'];

async function currentUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

/** 作品归属校验：作者本人或管理员 */
async function ownBook(userId: string, role: string, bookId: string) {
  const b = await prisma.book.findUnique({ where: { id: bookId } });
  if (!b) return null;
  if (b.authorId !== userId && role !== 'admin') return null;
  return b;
}

/** 内容安全拦截：命中载荷写安全日志并抛出（由全局错误中间件转成 400） */
export class ContentBlocked extends Error {
  hits: string[];
  constructor(hits: string[]) {
    super('CONTENT_BLOCKED');
    this.hits = hits;
  }
}

export async function intercept(fields: { field: string; text: string }[]) {
  const hit = scanFields(fields);
  if (hit) {
    await securityLog({
      kind: 'xss', level: 'danger', targetType: 'content',
      field: hit.field,
      message: `创作者提交内容含风险载荷已拦截（${hit.hits.join('、')}）：字段 ${hit.field}`,
    });
    throw new ContentBlocked(hit.hits);
  }
}

// ── 资质申请 ─────────────────────────────────────────────────
creatorRouter.post(
  '/apply',
  requireAuth,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    if (me.banned) return fail(res, 403, '账号已被封禁');
    if (me.role !== 'reader') return fail(res, 400, '已是创作者/管理员');

    const reason = str(req.body?.reason, 2000);
    const workTitle = str(req.body?.workTitle, 100);
    const workType = str(req.body?.workType, 20);
    const workIntro = str(req.body?.workIntro, 2000);
    if (!reason || !workTitle || !workType || !workIntro) return fail(res, 400, '资质说明、作品名、类型与简介不能为空');
    if (!BOOK_TYPES.includes(workType)) return fail(res, 400, '作品类型不合法');

    const pending = await prisma.applicant.findFirst({ where: { userId: me.id, status: 'pending' } });
    if (pending) return fail(res, 409, '已提交资质申请，请等待管理员审核');

    await intercept([
      { field: 'reason', text: reason },
      { field: 'workTitle', text: workTitle },
      { field: 'workIntro', text: workIntro },
    ]);
    await prisma.applicant.create({
      data: {
        id: uid('ap'), userId: me.id, nickname: me.nickname,
        reason, workTitle, workType, workIntro, status: 'pending',
      },
    });
    await addExp(me.id, 5, '提交创作者资质申请');
    ok(res);
  }),
);

creatorRouter.get(
  '/my-application',
  requireAuth,
  wrap(async (req, res) => {
    const app = await prisma.applicant.findFirst({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, { application: app ? { ...app, createdAt: app.createdAt.toISOString(), handledAt: app.handledAt?.toISOString() } : null });
  }),
);

// ── 收益统计 ─────────────────────────────────────────────────
creatorRouter.get(
  '/stats',
  requireAuth,
  wrap(async (req, res) => {
    const authorId = req.auth!.userId;
    const rewards = await prisma.tx.findMany({ where: { userId: authorId, kind: 'reward' }, select: { coin: true } });
    const me = await currentUser(authorId);
    const books = await prisma.book.findMany({ where: { authorId, status: { not: 'draft' } }, select: { likes: true, views: true } });
    const drafts = await prisma.book.count({ where: { authorId, status: 'draft' } });
    const pendingCount = await prisma.book.count({ where: { authorId, status: 'pending' } });
    ok(res, {
      income: rewards.reduce((s, t) => s + t.coin, 0),
      pending: me?.withdrawable ?? 0,
      books: books.length,
      fans: books.reduce((s, b) => s + b.likes, 0),
      views: books.reduce((s, b) => s + b.views, 0),
      drafts,
      pendingCount,
    });
  }),
);

creatorRouter.get(
  '/trend',
  requireAuth,
  wrap(async (req, res) => {
    const days = Math.min(intVal(req.query.days, 1, 31) ?? 7, 31);
    const authorId = req.auth!.userId;
    const list = await prisma.settlement.findMany({ where: { userId: authorId, status: 'approved' }, select: { amount: true, createdAt: true } });
    const map = new Map<string, number>();
    for (const s of list) map.set(s.createdAt.toISOString().slice(0, 10), (map.get(s.createdAt.toISOString().slice(0, 10)) ?? 0) + s.amount);
    const out: { date: string; label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, amount: map.get(key) ?? 0 });
    }
    ok(res, { trend: out });
  }),
);

creatorRouter.get(
  '/settlements',
  requireAuth,
  wrap(async (req, res) => {
    const list = await prisma.settlement.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    ok(res, { settlements: list.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), decidedAt: s.decidedAt?.toISOString() })) });
  }),
);

// ── 作品 CRUD（创作者/管理员） ───────────────────────────────
creatorRouter.post(
  '/books',
  requireCreator,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    if (me.banned) return fail(res, 403, '账号已被封禁，请联系管理员');

    const type = str(req.body?.type, 20) ?? '';
    const title = str(req.body?.title, 100);
    const genre = str(req.body?.genre, 20) ?? '';
    const coverSeed = str(req.body?.coverSeed, 60) ?? `seed-${Date.now()}`;
    const description = str(req.body?.description, 2000) ?? '';
    const serial = str(req.body?.serial, 20) ?? 'serial';
    const chapterPrice = intVal(req.body?.chapterPrice, 0, 10000) ?? 0;
    const status = str(req.body?.status, 20) ?? 'draft';
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 10) : [];
    if (!title) return fail(res, 400, '作品名不能为空');
    if (!BOOK_TYPES.includes(type)) return fail(res, 400, '作品类型不合法');
    if (!GENRES.includes(genre)) return fail(res, 400, '题材不合法');
    if (!['draft', 'pending'].includes(status)) return fail(res, 400, '状态不合法（发布需经管理员审核）');

    await intercept([
      { field: 'title', text: title },
      { field: 'description', text: description },
      { field: 'tags', text: (tags as string[]).join(',') },
    ]);
    const book = await prisma.book.create({
      data: {
        id: uid('b'), type, title, authorId: me.id, authorName: me.nickname,
        genre, status, coverSeed, description, tags: j(tags), serial,
        chapterPrice, coverStyle: str(req.body?.coverStyle, 20) || null,
        coverType: str(req.body?.coverType, 20) || null, coverFont: str(req.body?.coverFont, 40) || null,
        animeKey: str(req.body?.animeKey, 40) || null, gameKind: str(req.body?.gameKind, 20) || null,
      },
    });
    await audit(me.id, me.nickname, status === 'pending' ? '提交作品审核' : '创建作品草稿', title, book.id);
    ok(res, { book: bookJson(book) });
  }),
);

creatorRouter.patch(
  '/books/:id',
  requireCreator,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    const book = await ownBook(req.auth!.userId, req.auth!.role, req.params.id);
    if (!book) return fail(res, 404, '作品不存在或无权操作');

    // 白名单字段（authorId/authorName/status/views/likes 不可由此改：防伪造数据与绕过审核）
    const patch: Record<string, unknown> = {};
    if (req.body?.title !== undefined) {
      const t = str(req.body.title, 100);
      if (!t) return fail(res, 400, '作品名不能为空');
      patch.title = t;
    }
    if (req.body?.description !== undefined) patch.description = str(req.body.description, 2000) ?? '';
    if (req.body?.genre !== undefined) {
      const g = str(req.body.genre, 20) ?? '';
      if (!GENRES.includes(g)) return fail(res, 400, '题材不合法');
      patch.genre = g;
    }
    if (req.body?.tags !== undefined) {
      patch.tags = j(Array.isArray(req.body.tags) ? req.body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 10) : []);
    }
    if (req.body?.serial !== undefined) patch.serial = str(req.body.serial, 20) ?? 'serial';
    if (req.body?.chapterPrice !== undefined) patch.chapterPrice = intVal(req.body.chapterPrice, 0, 10000) ?? 0;
    if (req.body?.coverSeed !== undefined) patch.coverSeed = str(req.body.coverSeed, 60) ?? book.coverSeed;
    if (req.body?.coverStyle !== undefined) patch.coverStyle = str(req.body.coverStyle, 20) || null;
    if (req.body?.coverType !== undefined) patch.coverType = str(req.body.coverType, 20) || null;
    if (req.body?.coverFont !== undefined) patch.coverFont = str(req.body.coverFont, 40) || null;
    // 重新提交审核：published → pending 允许；draft → pending 允许；其余非法（不能自我上架）
    if (req.body?.status !== undefined) {
      const s = str(req.body.status, 20) ?? '';
      if (!['draft', 'pending'].includes(s) || book.status === 'pending') return fail(res, 400, '状态不合法（发布需经管理员审核）');
      patch.status = s;
    }
    await intercept([
      { field: 'title', text: (patch.title as string) ?? book.title },
      { field: 'description', text: (patch.description as string) ?? book.description },
      { field: 'tags', text: patch.tags !== undefined ? String(patch.tags) : book.tags },
    ]);
    const updated = await prisma.book.update({ where: { id: book.id }, data: patch });
    await audit(me.id, me.nickname, '编辑作品', updated.title, updated.id);
    ok(res, { book: bookJson(updated) });
  }),
);

creatorRouter.delete(
  '/books/:id',
  requireCreator,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    const book = await ownBook(req.auth!.userId, req.auth!.role, req.params.id);
    if (!book) return fail(res, 404, '作品不存在或无权操作');
    await prisma.$transaction([
      prisma.chapter.deleteMany({ where: { bookId: book.id } }),
      prisma.visualScript.deleteMany({ where: { bookId: book.id } }),
      prisma.comicPage.deleteMany({ where: { bookId: book.id } }),
      prisma.comicChapter.deleteMany({ where: { bookId: book.id } }),
      prisma.comment.deleteMany({ where: { bookId: book.id } }),
      prisma.shelfEntry.deleteMany({ where: { bookId: book.id } }),
      prisma.progress.deleteMany({ where: { bookId: book.id } }),
      prisma.book.delete({ where: { id: book.id } }),
    ]);
    await audit(me.id, me.nickname, '删除作品', book.title, book.id);
    ok(res);
  }),
);

// ── 章节保存（保留原章节 id，按 index 匹配） ─────────────────
creatorRouter.put(
  '/books/:id/chapters',
  requireCreator,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    const book = await ownBook(req.auth!.userId, req.auth!.role, req.params.id);
    if (!book) return fail(res, 404, '作品不存在或无权操作');
    const input = Array.isArray(req.body?.chapters) ? req.body.chapters : null;
    if (!input || input.length > 200) return fail(res, 400, '章节参数不合法');

    const cleaned: { title: string; content: string; price: number }[] = [];
    for (const c of input) {
      const title = str(c?.title, 100);
      const content = typeof c?.content === 'string' ? c.content.slice(0, 50000) : null;
      const price = intVal(c?.price, 0, 10000) ?? 0;
      if (!title || content === null) return fail(res, 400, '章节标题与正文不能为空');
      cleaned.push({ title, content, price });
    }
    await intercept(cleaned.flatMap((c) => [{ field: 'title', text: c.title }, { field: 'content', text: c.content }]));

    // 保留已有章节 id（按 index 匹配）：编辑作品不重建 id，已订阅/进度不失效
    const old = await prisma.chapter.findMany({ where: { bookId: book.id }, orderBy: { index: 'asc' } });
    await prisma.$transaction(async (tx) => {
      await tx.chapter.deleteMany({ where: { bookId: book.id } });
      for (let i = 0; i < cleaned.length; i += 1) {
        const prev = old.find((o) => o.index === i + 1);
        await tx.chapter.create({
          data: { id: prev?.id ?? uid('c'), bookId: book.id, index: i + 1, ...cleaned[i] },
        });
      }
      await tx.book.update({
        where: { id: book.id },
        data: {
          chapterIds: j([]), // 先占位，下面回填真实顺序
        },
      });
    });
    const created = await prisma.chapter.findMany({ where: { bookId: book.id }, orderBy: { index: 'asc' } });
    await prisma.book.update({
      where: { id: book.id },
      data: { chapterIds: j(created.map((c) => c.id)), words: created.reduce((s, c) => s + c.content.length, 0) },
    });
    ok(res, { chapters: created.map((c) => ({ id: c.id, bookId: c.bookId, index: c.index, title: c.title, price: c.price })) });
  }),
);

// ── 互动剧本保存 ─────────────────────────────────────────────
creatorRouter.put(
  '/books/:id/visual',
  requireCreator,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    const book = await ownBook(req.auth!.userId, req.auth!.role, req.params.id);
    if (!book) return fail(res, 404, '作品不存在或无权操作');
    const startNode = str(req.body?.startNode, 60);
    const nodes = Array.isArray(req.body?.nodes) ? req.body.nodes : null;
    if (!startNode || !nodes || nodes.length > 300) return fail(res, 400, '剧本参数不合法');

    const cleanNodes: unknown[] = [];
    const texts: { field: string; text: string }[] = [];
    for (const n of nodes) {
      const id = str(n?.id, 60);
      const text = typeof n?.text === 'string' ? n.text.slice(0, 20000) : null;
      if (!id || text === null || !Array.isArray(n?.choices)) return fail(res, 400, '节点参数不合法');
      const choices = n.choices
        .map((c: { label?: unknown; to?: unknown }) => ({ label: str(c?.label, 100) ?? '', to: str(c?.to, 60) ?? '' }))
        .filter((c: { label: string; to: string }) => c.label && c.to)
        .slice(0, 6);
      texts.push({ field: 'text', text });
      choices.forEach((c: { label: string }, ci: number) => texts.push({ field: `choice${ci}`, text: c.label }));
      cleanNodes.push({ id, text, choices, ...(typeof n?.ending === 'boolean' ? { ending: n.ending } : {}) });
    }
    await intercept(texts);

    await prisma.visualScript.upsert({
      where: { bookId: book.id },
      update: { startNode, nodes: j(cleanNodes) },
      create: { bookId: book.id, startNode, nodes: j(cleanNodes) },
    });
    await prisma.book.update({ where: { id: book.id }, data: { chapterIds: j([startNode]) } });
    ok(res);
  }),
);

// ── 漫画保存（全删重建，保留话 id 按 index 匹配） ────────────
creatorRouter.put(
  '/books/:id/comic',
  requireCreator,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    const book = await ownBook(req.auth!.userId, req.auth!.role, req.params.id);
    if (!book) return fail(res, 404, '作品不存在或无权操作');
    const input = Array.isArray(req.body?.chapters) ? req.body.chapters : null;
    if (!input || input.length > 100) return fail(res, 400, '漫画参数不合法');

    const old = await prisma.comicChapter.findMany({ where: { bookId: book.id }, orderBy: { index: 'asc' } });
    const texts: { field: string; text: string }[] = [];
    const built: { id: string; title: string; price: number; pages: { id: string; scene: string; imageKey: string | null; caption: string | null; dialogue: string[] }[] }[] = [];
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      const title = str(ch?.title, 100);
      const price = intVal(ch?.price, 0, 10000) ?? 0;
      if (!title || !Array.isArray(ch?.pages)) return fail(res, 400, '漫画话参数不合法');
      const pages: { id: string; scene: string; imageKey: string | null; caption: string | null; dialogue: string[] }[] = [];
      for (const p of ch.pages.slice(0, 100)) {
        const scene = typeof p?.scene === 'string' ? p.scene.slice(0, 2000) : null;
        if (scene === null) return fail(res, 400, '页面场景不能为空');
        const dialogue = Array.isArray(p?.dialogue) ? p.dialogue.filter((d: unknown) => typeof d === 'string').slice(0, 20) : [];
        pages.push({
          id: uid('p'), scene,
          imageKey: str(p?.imageKey, 200) || null,
          caption: str(p?.caption, 500) || null,
          dialogue: dialogue as string[],
        });
        texts.push({ field: 'scene', text: scene });
        if (pages[pages.length - 1].caption) texts.push({ field: 'caption', text: pages[pages.length - 1].caption! });
        if (dialogue.length) texts.push({ field: 'dialogue', text: (dialogue as string[]).join(' ') });
      }
      const prev = old.find((o) => o.index === i + 1);
      built.push({ id: prev?.id ?? uid('k'), title, price, pages });
    }
    await intercept(texts);

    await prisma.$transaction(async (tx) => {
      await tx.comicPage.deleteMany({ where: { bookId: book.id } });
      await tx.comicChapter.deleteMany({ where: { bookId: book.id } });
      for (const [i, ch] of built.entries()) {
        await tx.comicChapter.create({
          data: { id: ch.id, bookId: book.id, index: i + 1, title: ch.title, price: ch.price, pageIds: j(ch.pages.map((p) => p.id)) },
        });
        for (const [pi, p] of ch.pages.entries()) {
          await tx.comicPage.create({
            data: { id: p.id, bookId: book.id, chapterId: ch.id, index: pi + 1, scene: p.scene, imageKey: p.imageKey, caption: p.caption, dialogue: j(p.dialogue) },
          });
        }
      }
      await tx.book.update({ where: { id: book.id }, data: { chapterIds: j(built.map((c) => c.id)) } });
    });
    ok(res, { chapterIds: built.map((c) => c.id) });
  }),
);

// ── 管理员：资质申请审核（通过→开通创作者+自动建书） ─────────
applicationsRouter.use(requireAdmin);
applicationsRouter.get(
  '/',
  wrap(async (_req, res) => {
    const list = await prisma.applicant.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, { applications: list.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), handledAt: a.handledAt?.toISOString() })) });
  }),
);
applicationsRouter.post(
  '/:id/decide',
  wrap(async (req, res) => {
    const byId = req.auth!.userId;
    const admin = await currentUser(byId);
    const app = await prisma.applicant.findUnique({ where: { id: req.params.id } });
    if (!app) return fail(res, 404, '申请不存在');
    if (app.status !== 'pending') return fail(res, 409, '该申请已处理');
    const pass = req.body?.ok === true;
    const note = str(req.body?.note, 200) || null;
    const now = new Date();
    if (pass) {
      await prisma.applicant.update({ where: { id: app.id }, data: { status: 'approved', note, handledAt: now } });
      const u = await prisma.user.findUnique({ where: { id: app.userId } });
      if (u && u.role === 'reader') {
        await prisma.user.update({ where: { id: u.id }, data: { role: 'creator' } });
        await addExp(u.id, 30, '创作者资质审核通过');
        await prisma.book.create({
          data: {
            id: uid('b'), type: app.workType, title: app.workTitle, authorId: u.id, authorName: u.nickname,
            genre: GENRES[0], status: 'pending', coverSeed: `seed-${app.workTitle}`.slice(0, 60),
            description: app.workIntro, tags: j([]), serial: 'serial', chapterPrice: 0,
          },
        });
      }
      await audit(byId, admin?.nickname ?? '', '通过创作者资质', `${u?.nickname ?? ''}（${app.workTitle}）`, app.id);
    } else {
      await prisma.applicant.update({ where: { id: app.id }, data: { status: 'rejected', note: note || '未通过审核', handledAt: now } });
      await audit(byId, admin?.nickname ?? '', '驳回创作者资质', `${app.nickname}（${app.workTitle}）`, app.id);
    }
    ok(res);
  }),
);
