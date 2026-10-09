// 资金与收益侧：提现渠道（绑审）/ 提现状态机（二次验证+风控+冻结）/ 收益结算审核 / 收款平台配置与代付。
// 镜像前端 api.ts：requestWithdraw L1665 / saveChannel L1729 / decideWithdrawal L1789 / paymentProviders L1823 / simulateTransfer L1904。
import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../db.js';
import { ok, fail, wrap, str, intVal, rateLimit } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uid, audit } from '../lib/audit.js';
import { verifyPassword } from '../lib/password.js';
import { parseJson } from '../lib/json.js';

export const channelsRouter = Router();
export const withdrawalsRouter = Router();
export const settlementsRouter = Router();
export const paymentsRouter = Router();

const CHANNEL_TYPES = ['alipay', 'wechat', 'bank'];
const PROVIDER_TPL = [
  { id: 'wxpay', label: '微信支付（收款码直连）', fields: ['receiveLink', 'receiveQr'] },
  { id: 'alipay', label: '支付宝（收款码直连）', fields: ['receiveLink', 'receiveQr'] },
  { id: 'bankpay', label: '银行卡代付（收款码直连）', fields: ['receiveLink', 'receiveQr'] },
];
const channelLabel = (t: string) => (t === 'alipay' ? '支付宝' : t === 'wechat' ? '微信' : t === 'bank' ? '银行卡' : t);
const maskAccount = (a: string) => (a.trim().length <= 7 ? `${a.slice(0, 1)}****${a.slice(-1)}` : `${a.slice(0, 3)}****${a.slice(-3)}`);

async function currentUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

function channelJson(c: { id: string; userId: string; type: string; account: string; accountName: string; bankName: string | null; status: string; note: string | null; createdAt: Date }) {
  return {
    id: c.id, userId: c.userId, type: c.type, account: c.account, accountName: c.accountName,
    bankName: c.bankName || undefined, status: c.status, note: c.note || undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

function withdrawalJson(w: {
  id: string; userId: string; amount: number; status: string; note: string | null; channelId: string | null;
  channel: string | null; providerId: string | null; payTradeNo: string | null; payStatus: string | null;
  payQrContent: string | null; createdAt: Date;
}) {
  return {
    id: w.id, userId: w.userId, amount: w.amount, status: w.status, note: w.note || undefined,
    channelId: w.channelId || undefined, channel: parseJson(w.channel, null) || undefined,
    providerId: w.providerId || undefined, payTradeNo: w.payTradeNo || undefined,
    payStatus: w.payStatus || undefined, payQrContent: w.payQrContent || undefined,
    createdAt: w.createdAt.toISOString(),
  };
}

function settlementJson(s: { id: string; userId: string; bookId: string | null; kind: string; amount: number; note: string; status: string; createdAt: Date; decidedAt: Date | null }) {
  return {
    id: s.id, userId: s.userId, bookId: s.bookId || undefined, kind: s.kind, amount: s.amount,
    note: s.note, status: s.status, createdAt: s.createdAt.toISOString(), decidedAt: s.decidedAt?.toISOString(),
  };
}

// ── 提现渠道 ─────────────────────────────────────────────────
channelsRouter.get(
  '/mine',
  requireAuth,
  wrap(async (req, res) => {
    const list = await prisma.withdrawChannel.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' } });
    ok(res, { channels: list.map(channelJson) });
  }),
);

/** 新增或更新渠道：同类型覆盖更新并重新进入待审核 */
channelsRouter.post(
  '/save',
  requireAuth,
  wrap(async (req, res) => {
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    if (me.banned) return fail(res, 403, '账号已被封禁，请联系管理员');
    const type = str(req.body?.type, 20) ?? '';
    const account = str(req.body?.account, 100);
    const accountName = str(req.body?.accountName, 60);
    const bankName = str(req.body?.bankName, 60);
    if (!CHANNEL_TYPES.includes(type)) return fail(res, 400, '渠道类型不合法');
    if (!account || !accountName) return fail(res, 400, '请填写完整的渠道信息');
    if (account.length < 4) return fail(res, 400, '账号长度不合法');

    const exists = await prisma.withdrawChannel.findFirst({ where: { userId: me.id, type } });
    if (exists) {
      await prisma.withdrawChannel.update({
        where: { id: exists.id },
        data: { account, accountName, bankName: bankName || null, status: 'pending', note: null, createdAt: new Date() },
      });
    } else {
      await prisma.withdrawChannel.create({
        data: { id: uid('ch'), userId: me.id, type, account, accountName, bankName: bankName || null, status: 'pending' },
      });
    }
    await audit(me.id, me.nickname, '提交提现渠道审核', channelLabel(type), `${maskAccount(account)}（${accountName}）`);
    ok(res);
  }),
);

channelsRouter.get(
  '/all',
  requireAdmin,
  wrap(async (_req, res) => {
    const list = await prisma.withdrawChannel.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, { channels: list.map(channelJson) });
  }),
);

channelsRouter.post(
  '/:id/decide',
  requireAdmin,
  wrap(async (req, res) => {
    const c = await prisma.withdrawChannel.findUnique({ where: { id: req.params.id } });
    if (!c) return fail(res, 404, '渠道不存在');
    const pass = req.body?.ok === true;
    const note = str(req.body?.note, 200) || undefined;
    await prisma.withdrawChannel.update({ where: { id: c.id }, data: { status: pass ? 'approved' : 'rejected', note: note || null } });
    const admin = await currentUser(req.auth!.userId);
    const owner = await currentUser(c.userId);
    await audit(req.auth!.userId, admin?.nickname ?? '', pass ? '通过提现渠道' : '驳回提现渠道', `${owner?.nickname ?? ''}的${channelLabel(c.type)}`, `${maskAccount(c.account)}（${c.accountName}）`);
    ok(res);
  }),
);

// ── 提现（二次验证 + 风控 + 冻结 + 状态机） ──────────────────
withdrawalsRouter.post(
  '/request',
  requireAuth,
  wrap(async (req, res) => {
    if (!rateLimit(`wd:${req.auth!.userId}`, 5, 60_000)) return fail(res, 429, '操作过于频繁，请稍后再试');
    const me = await currentUser(req.auth!.userId);
    if (!me) return fail(res, 404, '用户不存在');
    if (me.banned) return fail(res, 403, '账号已被封禁，请联系管理员');

    const confirmPwd = typeof req.body?.confirmPwd === 'string' ? req.body.confirmPwd : '';
    if (!confirmPwd || !(await verifyPassword(confirmPwd, me.password))) {
      return fail(res, 403, '安全验证失败：登录密码不正确（二次验证）');
    }
    const amount = intVal(req.body?.amount, 1, 500);
    if (amount === null) {
      const n = Number(req.body?.amount);
      return fail(res, 400, Number.isFinite(n) && n > 500 ? '单笔提现上限 500 元，请分批申请' : '金额不对');
    }
    // 单日最多 3 次
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.withdrawal.count({ where: { userId: me.id, createdAt: { gte: dayStart } } });
    if (todayCount >= 3) return fail(res, 429, '今日提现次数已达上限（3 次），明天再试');

    const needCoins = amount * 100;
    if (needCoins > me.withdrawable) return fail(res, 402, '可提现余额不足（需后台审核通过后的收益）');

    // 渠道：指定 id 或取已审核通过的第一个
    const channelId = str(req.body?.channelId, 60);
    const channel = channelId
      ? await prisma.withdrawChannel.findFirst({ where: { id: channelId, userId: me.id } })
      : await prisma.withdrawChannel.findFirst({ where: { userId: me.id, status: 'approved' } });
    if (!channel) return fail(res, 400, '请先绑定提现渠道，并通过管理员审核后再提现');
    if (channel.status !== 'approved') return fail(res, 400, '提现渠道尚未通过管理员审核，暂不能提现');

    // 代付通道必须已启用
    const providerId = str(req.body?.providerId, 20);
    const provider = providerId
      ? await prisma.paymentProvider.findUnique({ where: { id: providerId } })
      : await prisma.paymentProvider.findFirst({ where: { enabled: true } });
    if (!provider || !provider.enabled) return fail(res, 400, '平台未启用代付通道，请联系管理员在「支付对接」中完成配置');

    // 冻结：立即扣减可提现余额（不动 coins 书币），状态机 pending → done / rejected
    let wdId = '';
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.user.findUnique({ where: { id: me.id } });
        if (!fresh || fresh.withdrawable < needCoins) throw new Error('INSUFFICIENT');
        await tx.user.update({ where: { id: me.id }, data: { withdrawable: { decrement: needCoins } } });
        const created = await tx.withdrawal.create({
          data: {
            id: uid('wd'), userId: me.id, amount, status: 'pending',
            channelId: channel.id,
            channel: JSON.stringify({ type: channel.type, account: channel.account, accountName: channel.accountName, bankName: channel.bankName || undefined }),
            providerId: provider.id,
          },
        });
        // 提现流水只记账：此处仅写 Tx，不更新 coins（与申请冻结语义对称）
        await tx.tx.create({
          data: {
            id: uid('tx'), userId: me.id, kind: 'withdraw', amount, coin: -needCoins,
            note: `申请提现 ${amount} 元（${channelLabel(channel.type)} · ${maskAccount(channel.account)} · ${provider.label}代付）`,
          },
        });
        wdId = created.id;
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'INSUFFICIENT') return fail(res, 402, '可提现余额不足（需后台审核通过后的收益）');
      throw e;
    }
    const wd = await prisma.withdrawal.findUnique({ where: { id: wdId } });
    ok(res, { withdrawal: wd ? withdrawalJson(wd) : null });
  }),
);

withdrawalsRouter.get(
  '/mine',
  requireAuth,
  wrap(async (req, res) => {
    const list = await prisma.withdrawal.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    ok(res, { withdrawals: list.map(withdrawalJson) });
  }),
);

withdrawalsRouter.get(
  '/all',
  requireAdmin,
  wrap(async (_req, res) => {
    const list = await prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, { withdrawals: list.map(withdrawalJson) });
  }),
);

/** 管理员审核：done→模拟代付下发；rejected→退回冻结资金 */
withdrawalsRouter.post(
  '/:id/decide',
  requireAdmin,
  wrap(async (req, res) => {
    const w = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
    if (!w) return fail(res, 404, '提现单不存在');
    if (w.status !== 'pending') return fail(res, 409, '该提现单已处理');
    const status = req.body?.status === 'done' ? 'done' : req.body?.status === 'rejected' ? 'rejected' : null;
    if (!status) return fail(res, 400, '状态不合法');
    const admin = await currentUser(req.auth!.userId);

    await prisma.withdrawal.update({ where: { id: w.id }, data: { status } });
    if (status === 'rejected') {
      const back = w.amount * 100;
      await prisma.user.update({ where: { id: w.userId }, data: { withdrawable: { increment: back } } });
      await prisma.tx.create({
        data: { id: uid('tx'), userId: w.userId, kind: 'withdraw', amount: w.amount, coin: back, note: '提现被驳回，资金退回' },
      });
    }
    if (status === 'done' && w.providerId) {
      await simulateTransfer(w, req.auth!.userId, admin?.nickname ?? '管理员');
    }
    await audit(req.auth!.userId, admin?.nickname ?? '', status === 'done' ? '确认提现到账' : '驳回提现', `${w.amount} 元`, w.id);
    ok(res);
  }),
);

/** 模拟代付：生成平台单号与收款码（真实对接由服务端替换此实现） */
async function simulateTransfer(w: { id: string; userId: string; amount: number; providerId: string | null; channel: string | null }, byUserId: string, byName: string) {
  const p = w.providerId ? await prisma.paymentProvider.findUnique({ where: { id: w.providerId } }) : null;
  if (!p) return;
  const fields = parseJson<Record<string, string>>(p.fields, {});
  const ch = parseJson<{ type: string; account: string } | null>(w.channel, null);
  const prefix = p.id === 'wxpay' ? 'wx' : p.id === 'alipay' ? 'alipay' : 'bank';
  const tradeNo = `${prefix}${Date.now().toString(36)}${crypto.randomInt(100, 999)}`;
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
  const qrContent = (fields.receiveQr ?? '').trim()
    || (fields.receiveLink ?? '').trim()
    || (p.id === 'wxpay'
      ? `wxp://f2f0/${rand}`
      : p.id === 'alipay'
        ? `https://qr.alipay.com/${rand}`
        : `https://pay.bank.example/transfer?out=${w.id}&amt=${w.amount * 100}&no=${rand}`);
  const chLabel = ch ? `${channelLabel(ch.type)} ${maskAccount(ch.account)}` : '';
  const payload = JSON.stringify({
    out_biz_no: w.id,
    amount: w.amount * 100,
    account: chLabel,
    remark: `墨影书城创作者收益结算 ${w.amount} 元`,
    channel: p.label,
    pay: (fields.receiveQr ?? '').trim() ? '平台收款二维码直连' : (fields.receiveLink ?? '').trim() ? '平台收款链接直连' : '演示收款码（未配置平台收款码）',
    qr: qrContent,
  });
  await prisma.payTransfer.create({
    data: { id: uid('pt'), withdrawalId: w.id, userId: w.userId, provider: p.id, amount: w.amount, channelLabel: chLabel, status: 'done', tradeNo, payload, qrContent },
  });
  await prisma.withdrawal.update({ where: { id: w.id }, data: { payTradeNo: tradeNo, payStatus: 'done', payQrContent: qrContent } });
  await audit(byUserId, byName, '代付平台模拟回调·实时下发', p.label, `${tradeNo} · ${w.amount} 元`);
}

// ── 收益结算（管理员审核；通过→进可提现余额） ────────────────
settlementsRouter.get(
  '/all',
  requireAdmin,
  wrap(async (_req, res) => {
    const list = await prisma.settlement.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, { settlements: list.map(settlementJson) });
  }),
);

settlementsRouter.post(
  '/:id/decide',
  requireAdmin,
  wrap(async (req, res) => {
    const s = await prisma.settlement.findUnique({ where: { id: req.params.id } });
    if (!s) return fail(res, 404, '结算单不存在');
    if (s.status !== 'pending') return fail(res, 409, '该结算单已处理');
    const pass = req.body?.ok === true;
    await prisma.settlement.update({ where: { id: s.id }, data: { status: pass ? 'approved' : 'rejected', decidedAt: new Date() } });
    if (pass) {
      await prisma.user.update({ where: { id: s.userId }, data: { withdrawable: { increment: s.amount } } });
    }
    const admin = await currentUser(req.auth!.userId);
    await audit(req.auth!.userId, admin?.nickname ?? '', pass ? '通过收益结算' : '驳回收益结算', s.note, `${s.amount} 币`);
    ok(res);
  }),
);

// ── 收款平台配置（只存收款链接/收款码，无任何密钥） ──────────
paymentsRouter.get(
  '/providers',
  wrap(async (_req, res) => {
    const saved = await prisma.paymentProvider.findMany();
    const list = PROVIDER_TPL.map((t) => {
      const s = saved.find((x) => x.id === t.id);
      const all: Record<string, string> = {};
      for (const k of t.fields) all[k] = typeof s?.fields === 'string' ? (parseJson<Record<string, string>>(s.fields, {})[k] ?? '') : '';
      return { id: t.id, label: t.label, enabled: s?.enabled ?? false, fields: all, updatedAt: s?.updatedAt?.toISOString() };
    });
    ok(res, { providers: list });
  }),
);

paymentsRouter.put(
  '/providers/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const tpl = PROVIDER_TPL.find((t) => t.id === req.params.id);
    if (!tpl) return fail(res, 404, '未知平台');
    const raw = req.body?.fields;
    const merged: Record<string, string> = {};
    for (const k of tpl.fields) {
      const v = typeof raw?.[k] === 'string' ? (raw[k] as string).trim() : '';
      // 收款链接必须 http(s)；收款码拦截注入载荷
      if (v && k === 'receiveLink' && !/^https?:\/\//i.test(v)) return fail(res, 400, '收款链接必须是 http(s):// 开头的安全地址');
      if (v && k === 'receiveQr' && /^javascript:|^data:\s*text\/html/i.test(v)) return fail(res, 400, '收款码含注入载荷，已被安全拦截');
      merged[k] = v;
    }
    const enabled = req.body?.enabled === true;
    await prisma.paymentProvider.upsert({
      where: { id: tpl.id },
      update: { enabled, fields: JSON.stringify(merged), updatedAt: new Date() },
      create: { id: tpl.id, label: tpl.label, enabled, fields: JSON.stringify(merged), updatedAt: new Date() },
    });
    // 打码审计（不含完整收款信息）
    const masked = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v ? `${v.slice(0, 4)}****${v.slice(-4)}` : '']));
    await audit(req.auth!.userId, '管理员', `${enabled ? '启用' : '停用'}收款通道`, tpl.label, JSON.stringify(masked));
    ok(res);
  }),
);

paymentsRouter.get(
  '/transfers',
  requireAdmin,
  wrap(async (_req, res) => {
    const list = await prisma.payTransfer.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, {
      transfers: list.map((t) => ({
        id: t.id, withdrawalId: t.withdrawalId, userId: t.userId, provider: t.provider,
        amount: t.amount, channelLabel: t.channelLabel, status: t.status, tradeNo: t.tradeNo,
        payload: t.payload, qrContent: t.qrContent || undefined, createdAt: t.createdAt.toISOString(),
      })),
    });
  }),
);
