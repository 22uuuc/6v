// 管理后台：统计看板 / 作品审核 / 精选与隔离 / 安全扫描与日志 / 审计 / 用户管理（封禁/调币/VIP）/ 实时收款 / 安全码解锁 / 系统设置。
// 镜像前端 api.ts：adminStats L2155 / setBookStatus L998 / setFeatured L848 / quarantine L924 / scanAll L908 / setBanned L621 / adjustCoins L634 / setVip L651 / verifyAdminCode L735 / setSettings L711。
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { prisma } from '../db.js';
import { ok, fail, wrap, str, intVal } from '../lib/http.js';
import { requireAdmin } from '../middleware/auth.js';
import { uid, audit, securityLog } from '../lib/audit.js';
import { getSettings, isVip, bookJson, settingsPublic } from '../lib/access.js';
import { publicUser } from '../lib/user.js';
import { scanFields } from '../lib/scan.js';
import { parseJson } from '../lib/json.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const RECHARGE_METHODS = ['alipay', 'wechat', 'bank', 'cloud'];
const LOCK_MS = 10 * 60_000; // 连续错 5 次锁 10 分钟（与前端一致）
const LOCK_FAILS = 5;

const sameDay = (d: Date, day: Date) =>
  d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();

// ── 统计看板 ─────────────────────────────────────────────────
adminRouter.get(
  '/stats',
  wrap(async (_req, res) => {
    const [users, books, txs, settlements, withdrawals, channels, applicants, feedbacks, messages] = await Promise.all([
      prisma.user.findMany({ select: { createdAt: true, vip: true, vipUntil: true } }),
      prisma.book.findMany({ select: { status: true, featured: true } }),
      prisma.tx.findMany({ select: { kind: true, amount: true, coin: true, note: true, createdAt: true } }),
      prisma.settlement.findMany({ select: { status: true, amount: true } }),
      prisma.withdrawal.findMany({ select: { status: true, amount: true } }),
      prisma.withdrawChannel.count({ where: { status: 'pending' } }),
      prisma.applicant.count({ where: { status: 'pending' } }),
      prisma.feedback.count({ where: { status: 'pending' } }),
      prisma.message.count({ where: { sender: 'user', read: false } }),
    ]);
    const flaggedCount = await prisma.securityLog.count({ where: { status: 'flagged' } });

    const rechargeTxs = txs.filter((t) => t.kind === 'recharge');
    const rechargeYuan = rechargeTxs.reduce((s, t) => s + t.amount, 0);
    const payout = txs.filter((t) => t.kind === 'reward').reduce((s, t) => s + t.coin, 0);
    const subscribeYuan = txs.filter((t) => t.kind === 'reward' && t.note.includes('订阅')).reduce((s, t) => s + t.coin, 0) / 100;
    const tipYuan = txs.filter((t) => t.kind === 'reward' && t.note.includes('打赏')).reduce((s, t) => s + t.coin, 0) / 100;

    const now = new Date();
    const series = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return {
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        users: users.filter((u) => sameDay(u.createdAt, d)).length,
        income: Math.round(rechargeTxs.filter((t) => sameDay(t.createdAt, d)).reduce((s, t) => s + t.amount * 0.3, 0) * 100) / 100,
        orders: txs.filter((t) => sameDay(t.createdAt, d) && ['recharge', 'subscribe', 'vip', 'tip'].includes(t.kind)).length,
      };
    });

    ok(res, {
      userCount: users.length,
      bookCount: books.length,
      publishedCount: books.filter((b) => b.status === 'published').length,
      pendingBooks: books.filter((b) => b.status === 'pending').length,
      rechargeYuan,
      payout,
      platformIncome: Math.round(rechargeYuan * 0.3 * 100) / 100,
      subscribeYuan: Math.round(subscribeYuan * 100) / 100,
      tipYuan: Math.round(tipYuan * 100) / 100,
      vipUsers: users.filter((u) => isVip(u)).length,
      settlePending: settlements.filter((s) => s.status === 'pending').reduce((sum, s) => sum + s.amount, 0),
      settleApproved: settlements.filter((s) => s.status === 'approved').reduce((sum, s) => sum + s.amount, 0),
      withdrawPending: withdrawals.filter((w) => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0),
      channelPending: channels,
      applicantPending: applicants,
      feedbackPending: feedbacks,
      supportUnread: messages,
      flaggedCount,
      featuredCount: books.filter((b) => b.featured).length,
      series,
    });
  }),
);

// ── 作品审核 ─────────────────────────────────────────────────
adminRouter.get(
  '/reviews',
  wrap(async (_req, res) => {
    const [pending, reviews] = await Promise.all([
      prisma.book.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' } }),
      prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);
    const titles = new Map((await prisma.book.findMany({ select: { id: true, title: true } })).map((b) => [b.id, b.title]));
    ok(res, {
      pendingBooks: pending.map(bookJson),
      reviews: reviews.map((r) => ({ id: r.id, bookId: r.bookId, bookTitle: titles.get(r.bookId) ?? '', action: r.action, note: r.note || undefined, createdAt: r.createdAt.toISOString() })),
    });
  }),
);

adminRouter.post(
  '/reviews/:bookId/decide',
  wrap(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.bookId } });
    if (!book) return fail(res, 404, '作品不存在');
    if (book.status !== 'pending') return fail(res, 409, '该作品不在待审状态');
    const pass = req.body?.ok === true;
    const note = str(req.body?.note, 200) || null;
    await prisma.$transaction([
      prisma.book.update({ where: { id: book.id }, data: { status: pass ? 'published' : 'rejected' } }),
      prisma.review.create({ data: { id: uid('rv'), bookId: book.id, action: pass ? 'approve' : 'reject', note } }),
    ]);
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', pass ? '通过作品审核' : '驳回作品审核', book.title, note || book.id);
    ok(res);
  }),
);

// ── 精选 / 隔离 ──────────────────────────────────────────────
adminRouter.post(
  '/books/:id/featured',
  wrap(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) return fail(res, 404, '作品不存在');
    const featured = req.body?.ok === true;
    await prisma.book.update({ where: { id: book.id }, data: { featured } });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', featured ? '设为精选' : '取消精选', book.title, book.id);
    ok(res);
  }),
);

adminRouter.post(
  '/books/:id/quarantine',
  wrap(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) return fail(res, 404, '作品不存在');
    if (req.body?.ok !== true) return fail(res, 400, '参数不合法');
    if (book.quarantined) return fail(res, 409, '该作品已隔离');
    await prisma.book.update({ where: { id: book.id }, data: { status: 'offline', quarantined: true } });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', '隔离作品（下架待查）', book.title, book.id);
    ok(res);
  }),
);

// ── 安全中心 ─────────────────────────────────────────────────
adminRouter.get(
  '/security/logs',
  wrap(async (_req, res) => {
    const logs = await prisma.securityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, {
      logs: logs.map((l) => ({
        id: l.id, kind: l.kind, level: l.level, targetType: l.targetType || undefined, targetId: l.targetId || undefined,
        field: l.field || undefined, snippet: l.snippet || undefined, message: l.message, status: l.status,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  }),
);

adminRouter.post(
  '/security/logs/:id/status',
  wrap(async (req, res) => {
    const status = str(req.body?.status, 20) ?? '';
    if (!['flagged', 'cleaned', 'ignored', 'resolved'].includes(status)) return fail(res, 400, '状态不合法');
    const log = await prisma.securityLog.findUnique({ where: { id: req.params.id } });
    if (!log) return fail(res, 404, '日志不存在');
    await prisma.securityLog.update({ where: { id: log.id }, data: { status } });
    ok(res);
  }),
);

/** 全库内容安全扫描：书元信息 + 章节正文 + 互动剧本 + 漫画页，命中写安全日志 */
adminRouter.post(
  '/security/scan',
  wrap(async (req, res) => {
    const [books, visuals, pages] = await Promise.all([
      prisma.book.findMany({ include: { chapters: true } }),
      prisma.visualScript.findMany(),
      prisma.comicPage.findMany(),
    ]);
    const texts: { targetType: string; targetId: string; field: string; text: string }[] = [];
    for (const b of books) {
      texts.push({ targetType: 'book', targetId: b.id, field: 'title', text: b.title });
      texts.push({ targetType: 'book', targetId: b.id, field: 'description', text: b.description });
      texts.push({ targetType: 'book', targetId: b.id, field: 'tags', text: parseJson<string[]>(b.tags, []).join(',') });
      for (const c of b.chapters) {
        texts.push({ targetType: 'chapter', targetId: c.id, field: 'title', text: c.title });
        texts.push({ targetType: 'chapter', targetId: c.id, field: 'content', text: c.content });
      }
    }
    for (const v of visuals) {
      for (const n of parseJson<{ id: string; text?: string; choices?: { label?: string }[] }[]>(v.nodes, [])) {
        if (n.text) texts.push({ targetType: 'visual', targetId: v.bookId, field: `node.${n.id}.text`, text: n.text });
        for (const [ci, c] of (n.choices ?? []).entries()) {
          if (c.label) texts.push({ targetType: 'visual', targetId: v.bookId, field: `node.${n.id}.choice${ci}`, text: c.label });
        }
      }
    }
    for (const p of pages) {
      texts.push({ targetType: 'comic', targetId: p.id, field: 'scene', text: p.scene });
      if (p.caption) texts.push({ targetType: 'comic', targetId: p.id, field: 'caption', text: p.caption });
      const dlg = parseJson<string[]>(p.dialogue, []).join(' ');
      if (dlg) texts.push({ targetType: 'comic', targetId: p.id, field: 'dialogue', text: dlg });
    }

    let hits = 0;
    let logged = 0;
    for (const t of texts) {
      const hit = scanFields([{ field: `${t.targetType}.${t.field}`, text: t.text }]);
      if (!hit) continue;
      hits += 1;
      if (logged < 50) {
        logged += 1;
        await securityLog({
          kind: 'xss', level: 'danger', targetType: t.targetType, targetId: t.targetId,
          field: t.field, snippet: t.text.slice(0, 120),
          message: `全库扫描命中风险载荷（${hit.hits.join('、')}）：${t.targetType}.${t.field}`,
        });
      }
    }
    await audit(req.auth!.userId, '管理员', '执行全库安全扫描', `${texts.length} 个字段`, `命中 ${hits} 处`);
    ok(res, { scanned: texts.length, hits });
  }),
);

adminRouter.get(
  '/audit',
  wrap(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, {
      logs: logs.map((l) => ({ id: l.id, userId: l.userId, userName: l.userName, action: l.action, target: l.target || undefined, detail: l.detail || undefined, createdAt: l.createdAt.toISOString() })),
    });
  }),
);

// ── 用户管理 ─────────────────────────────────────────────────
adminRouter.post(
  '/users/:id/ban',
  wrap(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return fail(res, 404, '用户不存在');
    if (target.role === 'admin') return fail(res, 400, '不能封禁管理员账号');
    const banned = req.body?.ok === true;
    await prisma.user.update({ where: { id: target.id }, data: { banned } });
    if (banned) await prisma.refreshToken.updateMany({ where: { userId: target.id }, data: { revoked: true } });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', banned ? '封禁账号' : '解封账号', target.nickname, target.id);
    ok(res, { user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })) });
  }),
);

adminRouter.post(
  '/users/:id/coins',
  wrap(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return fail(res, 404, '用户不存在');
    if (target.role === 'admin') return fail(res, 400, '不能调整管理员余额');
    const delta = intVal(req.body?.delta, -100000, 100000);
    if (delta === null || delta === 0) return fail(res, 400, '调整数额不合法');
    const next = Math.max(0, target.coins + delta);
    const changed = next - target.coins;
    if (changed === 0) return fail(res, 400, '调整后余额不变（不能为负）');
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { coins: next } }),
      prisma.tx.create({
        data: { id: uid('tx'), userId: target.id, kind: 'settle', amount: 0, coin: changed, note: `管理员调整书币 ${delta > 0 ? '+' : ''}${delta}` },
      }),
    ]);
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', '调整书币', target.nickname, `${delta > 0 ? '+' : ''}${delta} → ${next}`);
    ok(res, { user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })) });
  }),
);

adminRouter.post(
  '/users/:id/vip',
  wrap(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return fail(res, 404, '用户不存在');
    const vip = req.body?.ok === true;
    const days = intVal(req.body?.days, 1, 365) ?? 30;
    const vipUntil = vip ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
    await prisma.user.update({ where: { id: target.id }, data: { vip, vipUntil } });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', vip ? `开通 VIP ${days} 天` : '取消 VIP', target.nickname, target.id);
    ok(res, { user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })) });
  }),
);

// ── 实时收款 ─────────────────────────────────────────────────
adminRouter.get(
  '/recharges/recent',
  wrap(async (req, res) => {
    const limit = Math.min(intVal(req.query.limit, 1, 50) ?? 12, 50);
    const txs = await prisma.tx.findMany({ where: { kind: 'recharge' }, orderBy: { createdAt: 'desc' }, take: limit });
    const users = await prisma.user.findMany({ where: { id: { in: txs.map((t) => t.userId) } }, select: { id: true, nickname: true } });
    const names = new Map(users.map((u) => [u.id, u.nickname]));
    ok(res, {
      recharges: txs.map((t) => ({
        tx: { id: t.id, amount: t.amount, coin: t.coin, method: t.method || '', payNo: t.payNo || undefined, note: t.note, createdAt: t.createdAt.toISOString() },
        user: { id: t.userId, nickname: names.get(t.userId) ?? '' },
      })),
    });
  }),
);

// ── 管理安全码（本地解锁通道；邮箱通道由外部工作流负责） ─────
adminRouter.get(
  '/unlock/locked-until',
  wrap(async (_req, res) => {
    const s = await getSettings();
    // adminLockedUntil 存秒级 epoch（Int32 上限 ~2.1e9，毫秒级会溢出），读取时 ×1000 转毫秒
    const lockedSec = s.adminLockedUntil;
    ok(res, { lockedUntil: lockedSec * 1000 > Date.now() ? lockedSec * 1000 : 0 });
  }),
);

adminRouter.post(
  '/unlock/verify',
  wrap(async (req, res) => {
    const s = await getSettings();
    if (s.adminLockedUntil * 1000 > Date.now()) return fail(res, 429, '安全码错误次数过多，已临时锁定');
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code) return fail(res, 400, '请输入安全码');
    // 未设置安全码：放行（演示环境与前端语义一致）
    if (!s.adminCode) return ok(res, { unlocked: true });
    if (await bcrypt.compare(code, s.adminCode)) {
      await prisma.settings.update({ where: { id: 'main' }, data: { adminFailCount: 0, adminLockedUntil: 0 } });
      ok(res, { unlocked: true });
      return;
    }
    const fails = s.adminFailCount + 1;
    if (fails >= LOCK_FAILS) {
      await prisma.settings.update({ where: { id: 'main' }, data: { adminFailCount: 0, adminLockedUntil: Math.floor((Date.now() + LOCK_MS) / 1000) } });
      await securityLog({ kind: 'suspicious', level: 'warn', message: '管理安全码连续错误 5 次，已临时锁定 10 分钟' });
      fail(res, 429, '安全码错误次数过多，已临时锁定');
      return;
    }
    await prisma.settings.update({ where: { id: 'main' }, data: { adminFailCount: fails } });
    await audit(req.auth!.userId, '管理员', '安全码验证失败', '', `第 ${fails} 次错误`);
    fail(res, 403, '安全码错误');
  }),
);

adminRouter.post(
  '/unlock/ensure',
  wrap(async (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (code.length < 4 || code.length > 64) return fail(res, 400, '安全码至少 4 位');
    await prisma.settings.update({
      where: { id: 'main' },
      data: { adminCode: await bcrypt.hash(code, 10), adminFailCount: 0, adminLockedUntil: 0 },
    });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', '设置管理安全码', '', '首次启用代码锁');
    ok(res);
  }),
);

// ── 系统设置 ─────────────────────────────────────────────────
adminRouter.put(
  '/settings',
  wrap(async (req, res) => {
    const patch: Record<string, unknown> = {};
    if (req.body?.siteName !== undefined) patch.siteName = str(req.body.siteName, 30) || '墨影书城';
    if (req.body?.announcement !== undefined) patch.announcement = str(req.body.announcement, 500) ?? '';
    if (req.body?.vipPrice !== undefined) {
      const v = intVal(req.body.vipPrice, 0, 100000);
      if (v === null) return fail(res, 400, 'VIP 价格不合法');
      patch.vipPrice = v;
    }
    if (req.body?.rechargeRate !== undefined) {
      const v = intVal(req.body.rechargeRate, 1, 10000);
      if (v === null) return fail(res, 400, '充值汇率不合法');
      patch.rechargeRate = v;
    }
    for (const k of ['subShare', 'tipShare'] as const) {
      if (req.body?.[k] !== undefined) {
        const v = Number(req.body[k]);
        if (!Number.isFinite(v) || v < 0 || v > 1) return fail(res, 400, '分成比例需在 0-1 之间');
        patch[k] = v;
      }
    }
    if (req.body?.openRegister !== undefined) patch.openRegister = req.body.openRegister === true;
    if (req.body?.rechargeMethods !== undefined) {
      const list = Array.isArray(req.body.rechargeMethods) ? req.body.rechargeMethods.filter((m: unknown) => typeof m === 'string' && RECHARGE_METHODS.includes(m as string)) : [];
      if (!list.length) return fail(res, 400, '至少启用一种充值方式');
      patch.rechargeMethods = JSON.stringify(list);
    }
    if (req.body?.layoutStyle !== undefined) patch.layoutStyle = str(req.body.layoutStyle, 30);
    if (req.body?.fontFamily !== undefined) patch.fontFamily = str(req.body.fontFamily, 60);
    if (req.body?.fontSize !== undefined) {
      const v = intVal(req.body.fontSize, 12, 32);
      if (v === null) return fail(res, 400, '字号不合法');
      patch.fontSize = v;
    }
    if (req.body?.lineHeight !== undefined) {
      const v = Number(req.body.lineHeight);
      if (!Number.isFinite(v) || v < 1 || v > 3) return fail(res, 400, '行距不合法');
      patch.lineHeight = v;
    }
    await prisma.settings.update({ where: { id: 'main' }, data: patch });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', '更新系统设置', Object.keys(patch).join(','), '');
    ok(res, { settings: settingsPublic(await getSettings()) });
  }),
);
