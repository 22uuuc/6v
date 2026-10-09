// 钱包与付费闭环（服务端唯一权威）：充值订单+HMAC回调幂等入账 / 订阅解锁 / VIP / 打赏 / 流水。
// 镜像前端 api.ts L1235-1364 的语义：pushTx 记流水并动余额；creditAuthor 生成待结算收益单。
import crypto from 'node:crypto';
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ok, fail, wrap, rateLimit, clientIp, intVal } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { isVip, getSettings } from '../lib/access.js';
import { uid, audit } from '../lib/audit.js';
import { addExp } from '../lib/exp.js';

export const walletRouter = Router();

/** 支付回调密钥：演示环境默认值，生产必须从环境变量注入 */
const PAY_SECRET = process.env.PAY_SECRET || 'moying-pay-demo-secret-2026';
const METHOD_LABEL: Record<string, string> = { alipay: '支付宝', wechat: '微信支付', bank: '银行卡', cloud: '云闪付' };

function methodLabel(m: string): string {
  return METHOD_LABEL[m] ?? m;
}

/** HMAC-SHA256 签名：payNo|status|ts */
function paySign(payNo: string, status: string, ts: number): string {
  return crypto.createHmac('sha256', PAY_SECRET).update(`${payNo}|${status}|${ts}`).digest('hex');
}

/** 创作者分成：earn = round(paidCoins × 分成比例 × VIP加成1.1)；立即加币 + 待结算单，管理员审核通过后进可提现余额。
 *  仅用传入的 tx 客户端操作（严禁在事务内使用全局 prisma，SQLite 会锁等待超时）；settings 与经验加成由调用方在事务外处理。 */
async function creditAuthorTx(
  tx: Prisma.TransactionClient,
  settings: { subShare: number; tipShare: number },
  bookId: string,
  paidCoins: number,
  kind: '订阅' | '打赏',
): Promise<{ authorId: string; earn: number } | null> {
  const book = await tx.book.findUnique({ where: { id: bookId } });
  if (!book) return null;
  const author = await tx.user.findUnique({ where: { id: book.authorId } });
  if (!author) return null;
  const rate = kind === '订阅' ? settings.subShare : settings.tipShare;
  const boost = isVip(author) ? 1.1 : 1;
  const earn = Math.round(paidCoins * rate * boost);
  const note = kind === '订阅' ? `订阅分成《${book.title}》` : `打赏分成《${book.title}》`;
  await tx.user.update({ where: { id: author.id }, data: { coins: { increment: earn } } });
  await tx.tx.create({
    data: { id: uid('tx'), userId: author.id, kind: 'reward', amount: 0, coin: earn, note, bookId },
  });
  await tx.settlement.create({
    data: {
      id: uid('st'), userId: author.id, bookId,
      kind: kind === '订阅' ? 'subscribe' : 'tip',
      amount: earn, note, status: 'pending',
    },
  });
  return { authorId: author.id, earn };
}

/** 查用户（登录态） */
async function currentUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

// ── 余额与流水 ───────────────────────────────────────────────
walletRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const u = await currentUser(req.auth!.userId);
    if (!u) return fail(res, 404, '用户不存在');
    const txs = await prisma.tx.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    ok(res, {
      coins: u.coins,
      withdrawable: u.withdrawable,
      vip: isVip(u),
      txs: txs.map((t) => ({
        id: t.id, userId: t.userId, kind: t.kind, amount: t.amount, coin: t.coin, note: t.note,
        createdAt: t.createdAt.toISOString(), bookId: t.bookId || undefined, chapterId: t.chapterId || undefined,
        method: t.method || undefined, payNo: t.payNo || undefined,
      })),
    });
  }),
);

// ── 充值：创建订单（模拟支付网关下单） ──────────────────────
walletRouter.post(
  '/recharge/order',
  requireAuth,
  wrap(async (req, res) => {
    if (!rateLimit(`ro:${req.auth!.userId}`, 10, 60_000)) return fail(res, 429, '操作过于频繁，请稍后再试');
    const u = await currentUser(req.auth!.userId);
    if (!u) return fail(res, 404, '用户不存在');
    if (u.banned) return fail(res, 403, '账号已被封禁，请联系管理员');

    const rawYuan = req.body?.yuan;
    const yuan = intVal(rawYuan, 1, 10000);
    if (yuan === null) {
      const n = typeof rawYuan === 'number' ? rawYuan : Number(rawYuan);
      return fail(res, 400, Number.isFinite(n) && n > 10000 ? '单笔充值上限 10000 元，请分批充值' : '充值金额不合法');
    }
    const method = typeof req.body?.method === 'string' ? req.body.method : 'alipay';
    const settings = await getSettings();
    const methods = JSON.parse(settings.rechargeMethods || '[]') as string[];
    if (!methods.includes(method)) return fail(res, 400, '充值方式不存在');

    const rate = settings.rechargeRate;
    const coin = yuan * rate;
    const payNo = uid('po');
    await prisma.rechargeOrder.create({
      data: { id: payNo, userId: u.id, method, yuan, coin, status: 'pending' },
    });
    // 演示网关：直接下发"支付服务商签名好的回调载荷"，前端原样 POST 回 /callback 即完成支付闭环；
    // 真实接入时由服务商服务器携带其签名回调，本接口结构不变。
    const ts = Date.now();
    ok(res, {
      payNo, yuan, coin, method, status: 'pending',
      demoCallback: { payNo, status: 'paid', ts, sign: paySign(payNo, 'paid', ts) },
    });
  }),
);

// ── 充值回调：HMAC 验签 + pending→paid 幂等入账 ─────────────
walletRouter.post(
  '/recharge/callback',
  wrap(async (req, res) => {
    if (!rateLimit(`cb:${clientIp(req)}`, 60, 60_000)) return fail(res, 429, '操作过于频繁，请稍后再试');
    const payNo = typeof req.body?.payNo === 'string' ? req.body.payNo : '';
    const status = typeof req.body?.status === 'string' ? req.body.status : '';
    const ts = typeof req.body?.ts === 'number' ? req.body.ts : NaN;
    const sign = typeof req.body?.sign === 'string' ? req.body.sign : '';
    if (!payNo || status !== 'paid' || !Number.isFinite(ts) || !sign) return fail(res, 400, '回调参数不合法');
    // 时间窗 10 分钟，防截获重放
    if (Math.abs(Date.now() - ts) > 10 * 60_000) return fail(res, 400, '回调已过期');
    const expect = paySign(payNo, status, ts);
    const a = Buffer.from(expect);
    const b = Buffer.from(sign);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail(res, 401, '回调验签失败');

    const order = await prisma.rechargeOrder.findUnique({ where: { id: payNo } });
    if (!order) return fail(res, 404, '充值订单不存在');

    // 幂等：只有 pending→paid 一次入账；重放/重复通知直接返回成功
    const updated = await prisma.rechargeOrder.updateMany({
      where: { id: payNo, status: 'pending' },
      data: { status: 'paid', paidAt: new Date(), callbackAt: new Date() },
    });
    if (updated.count === 0) {
      const fresh = await prisma.rechargeOrder.findUnique({ where: { id: payNo } });
      if (fresh?.status === 'paid') return ok(res, { payNo, status: 'paid', idempotent: true });
      return fail(res, 409, '订单状态不允许入账');
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: order.userId }, data: { coins: { increment: order.coin } } }),
      prisma.tx.create({
        data: {
          id: uid('tx'), userId: order.userId, kind: 'recharge',
          amount: order.yuan, coin: order.coin,
          note: `充值 ${order.yuan} 元（${methodLabel(order.method)} · 1元=${order.coin / order.yuan}币 · 支付单号 ${payNo}）`,
          method: order.method, payNo,
        },
      }),
    ]);
    ok(res, { payNo, status: 'paid', coin: order.coin });
  }),
);

// ── 订阅解锁（小说章节 / 漫画单话 / 互动全本）：事务扣币+解锁+分成 ──
type UnlockKind = 'chapter' | 'comic' | 'visual';

walletRouter.post(
  '/unlock/:kind',
  requireAuth,
  wrap(async (req, res) => {
    const kind = req.params.kind as UnlockKind;
    if (!['chapter', 'comic', 'visual'].includes(kind)) return fail(res, 404, '接口不存在');
    if (!rateLimit(`ul:${req.auth!.userId}`, 30, 60_000)) return fail(res, 429, '操作过于频繁，请稍后再试');
    const u = await currentUser(req.auth!.userId);
    if (!u) return fail(res, 404, '用户不存在');
    if (u.banned) return fail(res, 403, '账号已被封禁，请联系管理员');

    // 定位目标与价格
    let bookId = '';
    let targetId = '';
    let price = 0;
    let note = '';
    if (kind === 'chapter' || kind === 'comic') {
      const chapterId = typeof req.body?.chapterId === 'string' ? req.body.chapterId : '';
      if (!chapterId) return fail(res, 400, '参数不合法');
      if (kind === 'chapter') {
        const c = await prisma.chapter.findUnique({ where: { id: chapterId } });
        if (!c) return fail(res, 404, '章节不存在');
        const b = await prisma.book.findUnique({ where: { id: c.bookId } });
        if (!b || b.status !== 'published') return fail(res, 404, '作品不存在或未发布');
        price = c.price;
        bookId = b.id;
        targetId = c.id;
        note = `订阅《${b.title}》第${c.index}章`;
      } else {
        const c = await prisma.comicChapter.findUnique({ where: { id: chapterId } });
        if (!c) return fail(res, 404, '漫画话不存在');
        const b = await prisma.book.findUnique({ where: { id: c.bookId } });
        if (!b || b.status !== 'published') return fail(res, 404, '作品不存在或未发布');
        price = c.price;
        bookId = b.id;
        targetId = c.id;
        note = `订阅漫画《${b.title}》第${c.index}章`;
      }
    } else {
      const bid = typeof req.body?.bookId === 'string' ? req.body.bookId : '';
      if (!bid) return fail(res, 400, '参数不合法');
      const b = await prisma.book.findUnique({ where: { id: bid } });
      if (!b || b.status !== 'published') return fail(res, 404, '作品不存在或未发布');
      price = b.chapterPrice;
      bookId = b.id;
      targetId = b.id;
      note = `解锁互动小说《${b.title}》`;
    }

    // 与前端 payChapter/unlockVisual/payComic 一致：免费/VIP 直接放行
    if (price <= 0) return ok(res, { charged: 0, coins: u.coins });
    if (isVip(u)) return ok(res, { charged: 0, coins: u.coins });
    if (u.coins < price) return fail(res, 402, '书币不足，请先充值');

    // 已解锁则幂等放行（防重复扣费）
    const existed = await prisma.unlock.findUnique({
      where: { userId_kind_targetId: { userId: u.id, kind, targetId } },
    });
    if (existed) return ok(res, { charged: 0, coins: u.coins });

    const authorId = (await prisma.book.findUnique({ where: { id: bookId }, select: { authorId: true } }))?.authorId ?? '';
    const settings = await getSettings();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const fresh = await tx.user.findUnique({ where: { id: u.id } });
        if (!fresh || fresh.coins < price) throw new Error('INSUFFICIENT');
        const user = await tx.user.update({ where: { id: u.id }, data: { coins: { decrement: price } } });
        await tx.tx.create({
          data: { id: uid('tx'), userId: u.id, kind: 'subscribe', amount: 0, coin: -price, note, bookId, chapterId: kind === 'visual' ? null : targetId },
        });
        await tx.unlock.create({ data: { userId: u.id, bookId, kind, targetId } });
        if (authorId) await creditAuthorTx(tx, settings, bookId, price, '订阅');
        return user.coins;
      });
      await addExp(authorId, 5, '作品获得收益'); // 非资金操作，事务外补发
      ok(res, { charged: price, coins: result });
    } catch (e) {
      if (e instanceof Error && e.message === 'INSUFFICIENT') return fail(res, 402, '书币不足，请先充值');
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return ok(res, { charged: 0, coins: u.coins }); // 并发重复解锁：幂等
      }
      throw e;
    }
  }),
);

// ── 开通月度 VIP ─────────────────────────────────────────────
walletRouter.post(
  '/vip',
  requireAuth,
  wrap(async (req, res) => {
    if (!rateLimit(`vip:${req.auth!.userId}`, 5, 60_000)) return fail(res, 429, '操作过于频繁，请稍后再试');
    const u = await currentUser(req.auth!.userId);
    if (!u) return fail(res, 404, '用户不存在');
    if (u.banned) return fail(res, 403, '账号已被封禁，请联系管理员');
    const price = (await getSettings()).vipPrice;
    if (u.coins < price) return fail(res, 402, '书币不足，请先充值');

    const until = new Date();
    until.setDate(until.getDate() + 30);
    const coins = await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: u.id } });
      if (!fresh || fresh.coins < price) throw new Error('INSUFFICIENT');
      const user = await tx.user.update({
        where: { id: u.id },
        data: { coins: { decrement: price }, vip: true, vipUntil: until.toISOString() },
      });
      await tx.tx.create({
        data: { id: uid('tx'), userId: u.id, kind: 'vip', amount: 0, coin: -price, note: '开通月度 VIP' },
      });
      return user.coins;
    });
    await addExp(u.id, 20, '开通 VIP');
    await audit(u.id, u.nickname, '开通VIP', `-${price}币`);
    ok(res, { coins, vip: true, vipUntil: until.toISOString() });
  }),
);

// ── 打赏 ─────────────────────────────────────────────────────
walletRouter.post(
  '/tip',
  requireAuth,
  wrap(async (req, res) => {
    if (!rateLimit(`tip:${req.auth!.userId}`, 20, 60_000)) return fail(res, 429, '操作过于频繁，请稍后再试');
    const u = await currentUser(req.auth!.userId);
    if (!u) return fail(res, 404, '用户不存在');
    if (u.banned) return fail(res, 403, '账号已被封禁，请联系管理员');

    const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId : '';
    const coins = intVal(req.body?.coins, 1, 1_000_000); // 正整数，防负值/零值反向刷币
    if (!bookId || coins === null) return fail(res, 400, '打赏参数不合法');
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book || book.status !== 'published') return fail(res, 404, '作品不存在或未发布');
    // 防自刷：打赏自己 = 用 tipShare>0 的分成套现平台币
    if (book.authorId === u.id) return fail(res, 400, '不能打赏自己的作品');
    if (u.coins < coins) return fail(res, 402, '书币不足，请先充值');

    const settings = await getSettings();
    const left = await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: u.id } });
      if (!fresh || fresh.coins < coins) throw new Error('INSUFFICIENT');
      const user = await tx.user.update({ where: { id: u.id }, data: { coins: { decrement: coins } } });
      await tx.tx.create({
        data: { id: uid('tx'), userId: u.id, kind: 'tip', amount: 0, coin: -coins, note: `打赏《${book.title}》${coins}书币`, bookId },
      });
      const credited = await creditAuthorTx(tx, settings, bookId, coins, '打赏');
      return { coins: user.coins, authorId: credited?.authorId ?? '' };
    });
    if (left.authorId) await addExp(left.authorId, 5, '作品获得收益'); // 非资金操作，事务外补发
    ok(res, { coins: left.coins });
  }),
);
