// 客服站内信：用户发送 / 我的会话 / 管理员查看全部与回复 / 标记已读。
// 镜像前端 api.ts：sendMessage L2093 / myMessages L2114 / adminMessages L2118 / adminReply L2122 / markSupportRead L2140。
import { Router } from 'express';
import { prisma } from '../db.js';
import { ok, fail, wrap, str, intVal } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uid, audit } from '../lib/audit.js';
import { intercept } from './creator.js';

export const messagesRouter = Router();

function messageJson(m: { id: string; userId: string; userName: string; sender: string; text: string; createdAt: Date; read: boolean }) {
  return { id: m.id, userId: m.userId, userName: m.userName, sender: m.sender, text: m.text, createdAt: m.createdAt.toISOString(), read: m.read };
}

/** 用户发送站内信给客服 */
messagesRouter.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!me) return fail(res, 404, '用户不存在');
    if (me.banned) return fail(res, 403, '账号已被封禁，无法发送消息');
    const text = str(req.body?.text, 500);
    if (!text) return fail(res, 400, '消息内容不能为空');
    await intercept([{ field: 'message.text', text }]);
    await prisma.message.create({
      data: { id: uid('msg'), userId: me.id, userName: me.nickname, sender: 'user', text, read: false },
    });
    ok(res);
  }),
);

messagesRouter.get(
  '/mine',
  requireAuth,
  wrap(async (req, res) => {
    const list = await prisma.message.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'asc' }, take: 200 });
    // 用户查看自己的会话时，管理员回复标记已读
    const unread = list.filter((m) => m.sender === 'admin' && !m.read).map((m) => m.id);
    if (unread.length) await prisma.message.updateMany({ where: { id: { in: unread } }, data: { read: true } });
    ok(res, { messages: list.map(messageJson) });
  }),
);

messagesRouter.get(
  '/all',
  requireAdmin,
  wrap(async (req, res) => {
    const limit = Math.min(intVal(req.query.limit, 1, 500) ?? 200, 500);
    const list = await prisma.message.findMany({ orderBy: { createdAt: 'asc' }, take: limit });
    ok(res, { messages: list.map(messageJson) });
  }),
);

/** 管理员回复指定用户的会话 */
messagesRouter.post(
  '/:userId/reply',
  requireAdmin,
  wrap(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!target) return fail(res, 404, '用户不存在');
    const text = str(req.body?.text, 500);
    if (!text) return fail(res, 400, '回复内容不能为空');
    await prisma.message.create({
      data: { id: uid('msg'), userId: target.id, userName: target.nickname, sender: 'admin', text, read: false },
    });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', '回复客服消息', `${target.nickname}·${text.slice(0, 20)}`, target.id);
    ok(res);
  }),
);

/** 管理员查看后把用户发来的未读消息标记已读 */
messagesRouter.post(
  '/support-read',
  requireAdmin,
  wrap(async (_req, res) => {
    const r = await prisma.message.updateMany({ where: { sender: 'user', read: false }, data: { read: true } });
    ok(res, { updated: r.count });
  }),
);
