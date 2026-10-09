// 意见反馈与退款工单：提交（带安全拦截）/ 我的工单 / 管理员列表与回复 / 退款审核（原路退回书币）。
// 镜像前端 api.ts：submitFeedback L1988 / myFeedback / adminFeedback L2019 / replyFeedback L2023 / decideRefund L2042。
import { Router } from 'express';
import { prisma } from '../db.js';
import { ok, fail, wrap, str } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uid, audit } from '../lib/audit.js';
import { addExp } from '../lib/exp.js';
import { parseJson } from '../lib/json.js';
import { ContentBlocked, intercept } from './creator.js';

export const feedbackRouter = Router();

const FEEDBACK_TYPES = ['suggest', 'bug', 'report', 'refund', 'other'];

function feedbackJson(f: {
  id: string; userId: string; userName: string; type: string; title: string; content: string;
  contact: string | null; status: string; reply: string | null; replyAt: Date | null;
  createdAt: Date; refund: string | null;
}) {
  return {
    id: f.id, userId: f.userId, userName: f.userName, type: f.type, title: f.title, content: f.content,
    contact: f.contact || undefined, status: f.status, reply: f.reply || undefined,
    replyAt: f.replyAt?.toISOString(), createdAt: f.createdAt.toISOString(),
    refund: f.refund ? parseJson(f.refund, null) : undefined,
  };
}

/** 提交反馈（退款单附 {txId,yuan,coin} 结构化信息） */
feedbackRouter.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!me) return fail(res, 404, '用户不存在');
    if (me.banned) return fail(res, 403, '账号已被封禁，无法提交反馈');
    const type = str(req.body?.type, 20) ?? '';
    const title = str(req.body?.title, 60);
    const content = str(req.body?.content, 2000);
    const contact = str(req.body?.contact, 100);
    if (!FEEDBACK_TYPES.includes(type)) return fail(res, 400, '反馈类型不合法');
    if (!title || !content) return fail(res, 400, '请填写标题与内容');

    let refundJson: string | null = null;
    if (type === 'refund' && req.body?.refund && typeof req.body.refund === 'object') {
      const txId = str(req.body.refund.txId, 60);
      const yuan = Number(req.body.refund.yuan);
      const coin = Number(req.body.refund.coin);
      if (!txId || !Number.isFinite(yuan) || !Number.isFinite(coin) || coin <= 0) {
        return fail(res, 400, '退款工单信息不完整');
      }
      // 防伪造：关联充值流水必须真实存在且属于本人
      const tx = await prisma.tx.findFirst({ where: { id: txId, userId: me.id, kind: 'recharge' } });
      if (!tx) return fail(res, 400, '关联充值流水不存在或不属于该用户');
      refundJson = JSON.stringify({ txId, yuan: Math.round(yuan), coin: Math.round(coin), status: 'none' });
    }

    await intercept([
      { field: 'feedback.title', text: title },
      { field: 'feedback.content', text: content },
    ]);
    await prisma.feedback.create({
      data: {
        id: uid('fb'), userId: me.id, userName: me.nickname, type, title, content,
        contact: contact || null, refund: refundJson, status: 'pending',
      },
    });
    ok(res);
  }),
);

feedbackRouter.get(
  '/mine',
  requireAuth,
  wrap(async (req, res) => {
    const list = await prisma.feedback.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    ok(res, { feedbacks: list.map(feedbackJson) });
  }),
);

feedbackRouter.get(
  '/all',
  requireAdmin,
  wrap(async (_req, res) => {
    const list = await prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    ok(res, { feedbacks: list.map(feedbackJson) });
  }),
);

feedbackRouter.post(
  '/:id/reply',
  requireAdmin,
  wrap(async (req, res) => {
    const reply = str(req.body?.reply, 1000);
    if (!reply) return fail(res, 400, '回复内容不能为空');
    const f = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!f) return fail(res, 404, '反馈不存在');
    await prisma.feedback.update({ where: { id: f.id }, data: { reply, replyAt: new Date(), status: 'resolved' } });
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    await audit(req.auth!.userId, admin?.nickname ?? '', '回复反馈工单', `${f.userName}·${f.title}`, reply.slice(0, 50));
    ok(res);
  }),
);

/** 退款审核：通过 → 校验原充值流水后原路退回书币；驳回 → 关闭工单 */
feedbackRouter.post(
  '/:id/refund',
  requireAdmin,
  wrap(async (req, res) => {
    const f = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!f) return fail(res, 404, '退款工单不存在');
    const refund = f.refund ? parseJson<{ txId: string; yuan: number; coin: number; status: string } | null>(f.refund, null) : null;
    if (f.type !== 'refund' || !refund) return fail(res, 400, '该工单不是退款申请');
    if (refund.status !== 'none') return fail(res, 409, '该退款工单已处理，请勿重复操作');
    const target = await prisma.user.findUnique({ where: { id: f.userId } });
    if (!target) return fail(res, 404, '申请退款用户不存在');
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    const pass = req.body?.ok === true;
    const now = new Date();

    if (pass) {
      // 校验流水真实存在且属于该用户（防止伪造工单盗刷）
      const tx = await prisma.tx.findFirst({ where: { id: refund.txId, userId: f.userId, kind: 'recharge' } });
      if (!tx) return fail(res, 400, '关联充值流水不存在或不属于该用户，已拒绝退款并留痕');
      const coin = Math.max(0, Math.round(refund.coin));
      if (coin > 0) {
        await prisma.$transaction([
          prisma.user.update({ where: { id: target.id }, data: { coins: { increment: coin } } }),
          prisma.tx.create({
            data: { id: uid('tx'), userId: target.id, kind: 'settle', amount: 0, coin, note: `退款到账：${refund.yuan} 元（原充值单 ${refund.txId}）`, payNo: tx.payNo },
          }),
        ]);
      }
      await prisma.feedback.update({
        where: { id: f.id },
        data: {
          refund: JSON.stringify({ ...refund, status: 'approved', handledAt: now.toISOString(), handledBy: req.auth!.userId }),
          status: 'resolved',
          reply: f.reply ?? `管理员已审核通过，原路退回 ${refund.yuan} 元对应的 ${coin} 书币。`,
          replyAt: now,
        },
      });
      await addExp(target.id, 2, '退款到账');
      await audit(req.auth!.userId, admin?.nickname ?? '', '审核通过退款', `${target.nickname}·${refund.yuan} 元`, `${coin} 币已退回`);
      ok(res, { msg: `已通过，原路退回 ${coin} 书币` });
      return;
    }
    await prisma.feedback.update({
      where: { id: f.id },
      data: {
        refund: JSON.stringify({ ...refund, status: 'rejected', handledAt: now.toISOString(), handledBy: req.auth!.userId }),
        status: 'resolved',
        reply: f.reply ?? '管理员驳回本次退款申请。',
        replyAt: now,
      },
    });
    await audit(req.auth!.userId, admin?.nickname ?? '', '驳回退款申请', `${target.nickname}·${refund.yuan} 元`, f.id);
    ok(res, { msg: '已驳回退款申请' });
  }),
);
