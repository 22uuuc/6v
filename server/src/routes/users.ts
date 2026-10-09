import { Router } from 'express';
import { prisma } from '../db.js';
import { publicUser } from '../lib/user.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { fail, ok, str, wrap } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const usersRouter = Router();

/** 我的信息（登录态） */
usersRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    ok(res, { user: publicUser(user) });
  }),
);

/** 改资料（昵称/简介） */
usersRouter.patch(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const data: { nickname?: string; bio?: string } = {};
    const nickname = str(req.body?.nickname, 16);
    if (nickname) data.nickname = nickname;
    if (typeof req.body?.bio === 'string') data.bio = str(req.body.bio, 200) || '';
    const user = await prisma.user.update({ where: { id: req.auth!.userId }, data });
    ok(res, { user: publicUser(user) });
  }),
);

/** 个性化偏好（合并写入） */
usersRouter.put(
  '/me/prefs',
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    const current = JSON.parse(user.prefs || '{}') as Record<string, unknown>;
    const next = { ...current, ...(typeof req.body === 'object' && req.body ? req.body : {}) };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { prefs: JSON.stringify(next) },
    });
    ok(res, { user: publicUser(updated) });
  }),
);

/** 读者隐私设置（合并写入） */
usersRouter.put(
  '/me/privacy',
  requireAuth,
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    const current = JSON.parse(user.privacy || '{}') as Record<string, unknown>;
    const next = { ...current, ...(typeof req.body === 'object' && req.body ? req.body : {}) };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { privacy: JSON.stringify(next) },
    });
    ok(res, { user: publicUser(updated) });
  }),
);

/** 改口令：验旧口令，全端下线 */
usersRouter.post(
  '/me/password',
  requireAuth,
  wrap(async (req, res) => {
    const oldPassword = typeof req.body?.oldPassword === 'string' ? req.body.oldPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 6 || newPassword.length > 64) {
      fail(res, 400, '新口令长度需为 6-64 位');
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !(await verifyPassword(oldPassword, user.password))) {
      fail(res, 401, '旧口令错误');
      return;
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } }),
      prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } }),
      prisma.loginSession.deleteMany({ where: { userId: user.id } }),
    ]);
    ok(res);
  }),
);

/** 用户列表（管理员） */
usersRouter.get(
  '/',
  requireAdmin,
  wrap(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, take: 500 });
    ok(res, { users: users.map(publicUser) });
  }),
);

/** 设置角色（管理员） */
usersRouter.post(
  '/:id/role',
  requireAdmin,
  wrap(async (req, res) => {
    const role = str(req.body?.role, 8) || '';
    if (!['reader', 'creator', 'admin'].includes(role)) {
      fail(res, 400, '无效角色');
      return;
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    ok(res, { user: publicUser(user) });
  }),
);
