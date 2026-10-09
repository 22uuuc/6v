import express from 'express';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { contentRouter } from './routes/content.js';
import { walletRouter } from './routes/wallet.js';
import { creatorRouter, applicationsRouter, ContentBlocked } from './routes/creator.js';
import { channelsRouter, withdrawalsRouter, settlementsRouter, paymentsRouter } from './routes/money.js';
import { adminRouter } from './routes/admin.js';
import { feedbackRouter } from './routes/feedback.js';
import { messagesRouter } from './routes/messages.js';
import { fail, ok } from './lib/http.js';

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '4mb' }));

// JSON 解析错误 → 400（而非 500）
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    fail(res, 400, '请求体格式错误');
    return;
  }
  next(err);
});

app.get('/api/health', (_req, res) => ok(res, { service: 'moying-server', ts: Date.now() }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api', contentRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/creator', creatorRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/withdrawals', withdrawalsRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/messages', messagesRouter);

// 未知接口
app.use('/api', (_req, res) => fail(res, 404, '接口不存在'));

// 兜底错误
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ContentBlocked) {
    fail(res, 400, `内容含风险信息，已被安全中心拦截（${err.hits.join('、')}）`);
    return;
  }
  console.error('[server]', err);
  if (!res.headersSent) fail(res, 500, '服务内部错误');
});

app.listen(PORT, () => {
  console.log(`[moying-server] listening on http://localhost:${PORT}`);
});
