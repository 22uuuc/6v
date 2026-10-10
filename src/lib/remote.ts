// 远程权威后端客户端：墨影书城前端三层化接入（第一层：快照镜像同步读，第二层：写走 HTTP）
// 后端契约见 moying-backend/docs/API.md；类型与 src/lib/types.ts 一一对应。
import type {
  IUser, IBook, IChapter, IVisualScript, IComicChapter, IComicPage,
  IComment, IReview, ITx, ISettings, IShelfEntry, IProgress, IWithdrawal,
  IWithdrawChannel, ISettlement, IApplicant, IFeedback, IMessage, ISecurityLog, IAuditLog,
} from '@/lib/types';

export const REMOTE_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:8787';

/** 远程模式就绪标记：initRemote 成功拉取 bootstrap 后置 true（失败自动回退本地演示模式） */
let remoteReady = false;
export function isRemoteReady(): boolean { return remoteReady; }
export function markRemoteReady(v: boolean) { remoteReady = v; }

const TOKEN_KEY = 'moying_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

/** 快照镜像（bootstrap 或写操作响应携带） */
export interface Snapshot {
  v: number;
  serverTime: string;
  today: string;
  me: IUser | null;
  settings: ISettings;
  books: IBook[];
  chapters: IChapter[];
  visualScripts: IVisualScript[];
  comicChapters: IComicChapter[];
  comicPages: IComicPage[];
  comments: IComment[];
  reviews: IReview[];
  tipTotals: { bookId: string; amount: number }[];
  shelf?: IShelfEntry[];
  progress?: IProgress[];
  txs?: ITx[];
  withdrawals?: IWithdrawal[];
  channels?: IWithdrawChannel[];
  settlements?: ISettlement[];
  applicants?: IApplicant[];
  feedback?: IFeedback[];
  messages?: IMessage[];
  daily?: Record<string, { date: string; streak: number; readDone: boolean }>;
  checkinInfo?: { today: boolean; streak: number; readDone: boolean; checkinReward: number; readReward: number };
  users?: IUser[];
  securityLogs?: ISecurityLog[];
  auditLogs?: IAuditLog[];
  stats?: unknown;
}

let snap: Snapshot | null = null;

export function getSnap(): Snapshot | null { return snap; }

/** 后端 settings 到前端 ISettings 映射（锁定时间为秒级 epoch，映射为毫秒） */
function mapSettings(s: any): ISettings {
  return {
    siteName: s.siteName ?? '墨影书城',
    announcement: s.announcement ?? '',
    vipPrice: s.vipPrice ?? 1800,
    rechargeRate: s.rechargeRate ?? 100,
    subShare: s.subShare ?? 0.7,
    tipShare: s.tipShare ?? 1,
    openRegister: s.openRegister ?? true,
    rechargeMethods: s.rechargeMethods ?? ['alipay', 'wechat', 'bank', 'cloud'],
    adminCode: '',
    adminLockedUntil: (s.adminLockedUntilSec ?? 0) * 1000,
    adminFailCount: 0,
  };
}

/** 用后端快照覆盖本地镜像（用户/设置归一化；正文按需获取，快照章节不含 content） */
export function applySnap(s: any) {
  snap = {
    v: s.v ?? 0,
    serverTime: s.serverTime ?? new Date().toISOString(),
    today: s.today ?? new Date().toISOString().slice(0, 10),
    me: s.me ? { ...s.me, password: '' } : null,
    settings: mapSettings(s.settings),
    books: s.books ?? [],
    chapters: (s.chapters ?? []).map((c: any) => ({ ...c, content: '' })),
    visualScripts: s.visualScripts ?? [],
    comicChapters: s.comicChapters ?? [],
    comicPages: s.comicPages ?? [],
    comments: s.comments ?? [],
    reviews: s.reviews ?? [],
    tipTotals: s.tipTotals ?? [],
    shelf: s.shelf,
    progress: s.progress,
    txs: s.txs,
    withdrawals: s.withdrawals,
    channels: s.channels,
    settlements: s.settlements,
    applicants: s.applicants,
    feedback: s.feedback,
    messages: s.messages,
    daily: s.daily,
    checkinInfo: s.checkinInfo,
    users: s.users,
    securityLogs: s.securityLogs,
    auditLogs: s.auditLogs,
    stats: s.stats,
  };
}

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const t = getToken();
  if (t) h.authorization = `Bearer ${t}`;
  return h;
}

/** 统一请求：始终解析 JSON；非 2xx 返回 { ok:false, status, msg, code? }；写成功自动同步快照 */
export async function remoteCall(path: string, opts: { method?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(`${REMOTE_BASE}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: authHeaders(),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* 忽略解析失败 */ }
  const out = { status: res.status, ok: res.ok, ...(json ?? {}) };
  if (out.ok && out.snapshot) applySnap(out.snapshot);
  return out;
}

/** 启动时拉取 bootstrap（匿名或带 token）；成功置远程就绪，失败回退本地演示模式 */
export async function initRemote(): Promise<Snapshot | null> {
  try {
    const res = await fetch(`${REMOTE_BASE}/api/bootstrap`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`后端 bootstrap 失败 HTTP ${res.status}`);
    const data = await res.json();
    applySnap(data);
    markRemoteReady(true);
    return snap!;
  } catch (e) {
    markRemoteReady(false);
    console.warn('[remote] 后端不可用，回退本地演示模式:', e);
    return null;
  }
}