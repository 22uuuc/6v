import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { deviceOf, publicUser } from '../lib/user.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { newRefreshToken, sha256, signAccess } from '../lib/jwt.js';
import { clientIp, fail, ok, rateLimit, str, wrap } from '../lib/http.js';
import { parseJson } from '../lib/json.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// 登录成功统一签发：access(30m) + refresh(7d) + 会话记录
async function issueTokens(userId: string, role: string, ua: string | undefined) {
  const accessToken = signAccess(userId, role);
  const rt = newRefreshToken();
  await prisma.refreshToken.create({
    data: { tokenHash: rt.hash, userId, expiresAt: rt.expiresAt },
  });
  await prisma.loginSession.create({
    data: { userId, device: deviceOf(ua) },
  });
  return { accessToken, refreshToken: rt.token };
}

/** 注册：开放注册受系统设置控制；新号默认读者、0 书币 */
authRouter.post(
  '/register',
  wrap(async (req, res) => {
    if (!rateLimit(`reg:${clientIp(req)}`, 5, 10 * 60_000)) {
      fail(res, 429, '注册过于频繁，请稍后再试');
      return;
    }
    const settings = await prisma.settings.findUnique({ where: { id: 'main' } });
    if (settings && !settings.openRegister) {
      fail(res, 403, '平台已关闭注册');
      return;
    }
    const username = str(req.body?.username, 24);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const nickname = str(req.body?.nickname, 16) || `书友${Date.now() % 10000}`;
    if (!username || !/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,24}$/.test(username)) {
      fail(res, 400, '用户名需为 2-24 位字母/数字/下划线/中文');
      return;
    }
    if (password.length < 6 || password.length > 64) {
      fail(res, 400, '口令长度需为 6-64 位');
      return;
    }
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      fail(res, 409, '用户名已被占用');
      return;
    }
    const user = await prisma.user.create({
      data: {
        id: `u-${crypto.randomUUID().slice(0, 12)}`,
        username,
        password: await hashPassword(password),
        nickname,
        privacy: JSON.stringify({
          hideBalance: false, hideRecent: false, hideShelf: false,
          hideRecords: false, stealth: false,
        }),
        verified: JSON.stringify({}),
      },
    });
    const tokens = await issueTokens(user.id, user.role, req.headers['user-agent']);
    ok(res, { ...tokens, user: publicUser(user) });
  }),
);

/** 登录：统一错误文案不泄露账号是否存在；IP+用户名双维频控防爆破 */
authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const username = str(req.body?.username, 24) || '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 20, 5 * 60_000) || !rateLimit(`login:${ip}:${username}`, 10, 5 * 60_000)) {
      fail(res, 429, '尝试过于频繁，请 5 分钟后再试');
      return;
    }
    if (!username || !password) {
      fail(res, 400, '请输入用户名与口令');
      return;
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await verifyPassword(password, user.password))) {
      fail(res, 401, '用户名或口令错误');
      return;
    }
    if (user.banned) {
      fail(res, 403, '账号已被封禁，如有疑问请联系客服');
      return;
    }
    const tokens = await issueTokens(user.id, user.role, req.headers['user-agent']);
    ok(res, { ...tokens, user: publicUser(user) });
  }),
);

/** 刷新：轮换旧 refresh（旧令牌立即失效） */
authRouter.post(
  '/refresh',
  wrap(async (req, res) => {
    const token = str(req.body?.refreshToken, 200) || '';
    if (!token) {
      fail(res, 400, '缺少 refreshToken');
      return;
    }
    const hash = sha256(token);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.revoked || record.expiresAt < new Date()) {
      fail(res, 401, '登录已过期，请重新登录');
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || user.banned) {
      fail(res, 401, '账号不可用');
      return;
    }
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
    const accessToken = signAccess(user.id, user.role);
    const rt = newRefreshToken();
    await prisma.refreshToken.create({
      data: { tokenHash: rt.hash, userId: user.id, expiresAt: rt.expiresAt },
    });
    ok(res, { accessToken, refreshToken: rt.token, user: publicUser(user) });
  }),
);

/** 登出：吊销 refresh */
authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    const token = str(req.body?.refreshToken, 200) || '';
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(token) },
        data: { revoked: true },
      });
    }
    ok(res);
  }),
);

/** 第三方登录（演示实现：openid 建号/登录，真实部署接 OAuth） */
authRouter.post(
  '/third',
  wrap(async (req, res) => {
    const provider = str(req.body?.provider, 16) || '';
    const openid = str(req.body?.openid, 64) || '';
    const nickname = str(req.body?.nickname, 16) || '书友';
    if (!provider || !openid || !/^[a-z]{2,16}$/.test(provider)) {
      fail(res, 400, '参数不完整');
      return;
    }
    const username = `${provider}_${openid.slice(0, 24)}`;
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: `u-${crypto.randomUUID().slice(0, 12)}`,
          username,
          password: await hashPassword(crypto.randomBytes(24).toString('hex')),
          nickname,
          verified: JSON.stringify({}),
        },
      });
    }
    if (user.banned) {
      fail(res, 403, '账号已被封禁');
      return;
    }
    const tokens = await issueTokens(user.id, user.role, req.headers['user-agent']);
    ok(res, { ...tokens, user: publicUser(user) });
  }),
);

/** 邮箱/手机验证（演示实现：直接置已验证） */
authRouter.post(
  '/verify',
  requireAuth,
  wrap(async (req, res) => {
    const channel = str(req.body?.channel, 8) || '';
    if (channel !== 'email' && channel !== 'phone') {
      fail(res, 400, '无效验证渠道');
      return;
    }
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    const verified = { email: false, phone: false, ...parseJson(user.verified, {}) as Record<string, boolean> };
    verified[channel] = true;
    const authLevel = verified.email && verified.phone ? 2 : 1;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { verified: JSON.stringify(verified), authLevel },
    });
    ok(res, { user: publicUser(updated) });
  }),
);

/** 找回密码：申请验证码（演示：服务端生成直接返回；真实部署走 SMTP/短信） */
authRouter.post(
  '/reset-request',
  wrap(async (req, res) => {
    if (!rateLimit(`reset:${clientIp(req)}`, 5, 10 * 60_000)) {
      fail(res, 429, '请求过于频繁');
      return;
    }
    const username = str(req.body?.username, 24) || '';
    const user = await prisma.user.findUnique({ where: { username } });
    // 不泄露用户是否存在：统一 ok，但仅真实用户拿得到 demoCode
    if (!user) {
      ok(res, { sent: true });
      return;
    }
    const code = String(crypto.randomInt(100000, 1000000));
    await prisma.resetCode.upsert({
      where: { username },
      update: { code, expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 },
      create: { username, code, expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    ok(res, { sent: true, demoCode: code }); // 演示环境直接下发
  }),
);

/** 找回密码：校验验证码并重置 */
authRouter.post(
  '/reset',
  wrap(async (req, res) => {
    const username = str(req.body?.username, 24) || '';
    const code = str(req.body?.code, 8) || '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 6 || newPassword.length > 64) {
      fail(res, 400, '新口令长度需为 6-64 位');
      return;
    }
    const record = await prisma.resetCode.findUnique({ where: { username } });
    if (!record || record.expiresAt < new Date() || record.attempts >= 5) {
      fail(res, 400, '验证码已失效，请重新申请');
      return;
    }
    if (record.code !== code) {
      await prisma.resetCode.update({ where: { username }, data: { attempts: { increment: 1 } } });
      fail(res, 400, '验证码错误');
      return;
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } }),
      prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } }),
      prisma.resetCode.delete({ where: { username } }),
    ]);
    ok(res);
  }),
);

/** 我的登录设备 */
authRouter.get(
  '/sessions',
  requireAuth,
  wrap(async (req, res) => {
    const userId = req.auth!.userId;
    const sessions = await prisma.loginSession.findMany({
      where: { userId },
      orderBy: { lastAt: 'desc' },
      take: 50,
    });
    ok(res, {
      sessions: sessions.map((s) => ({
        id: s.id, userId: s.userId, device: s.device,
        at: s.at.toISOString(), lastAt: s.lastAt.toISOString(),
      })),
    });
  }),
);

/** 退出其他设备：吊销全部 refresh + 清空其它会话 */
authRouter.delete(
  '/sessions/others',
  requireAuth,
  wrap(async (req, res) => {
    const userId = req.auth!.userId;
    await prisma.$transaction([
      prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } }),
      prisma.loginSession.deleteMany({ where: { userId } }),
    ]);
    ok(res);
  }),
);
