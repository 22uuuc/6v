// EXPORTS: api, isVip, fmtCoins, fmtYuan, todayLabel, INIT_DATA

// 数据层：localStorage + IndexedDB 模拟后端。所有写操作后 notify() 触发订阅刷新。
// 安全：store 签名校验防篡改；收益走“待结算→管理员审核→可提现”；管理入口安全码 + 审计留痕。
import { store, notify } from '@/lib/store';
import { buildSeed } from '@/data/seed';
import { security, scanText, obfuscate, deobfuscate, hashString } from '@/lib/security';
import type {
  IUser, IBook, IChapter, IVisualScript, IComicChapter, IComicPage,
  IProgress, IShelfEntry, ITx, IWithdrawal, IReview, BookType, BookGenre,
  BookStatus, UserRole, TxKind, ISettings, ISettlement, IAuditLog,
  IWithdrawChannel, ChannelType, IApplicant, IPrivacy, IFeedback, IMessage,
  CoverStyle, CoverFont, IComment,
} from '@/lib/types';
import { LEVELS } from '@/lib/types';

const DB_VERSION = '4';

/* ---------- 基础读写 ---------- */

function read<T>(k: string, fb: T): T {
  return store.get(k, fb);
}
function write(k: string, v: unknown) {
  store.set(k, v);
}

let idSeq = 0;
function uid(prefix: string): string {
  idSeq += 1;
  return `${prefix}${Date.now().toString(36)}${idSeq}`;
}

/** 用户对象兜底：老数据补齐新增字段 */
function normalizeUser(u: IUser): IUser {
  return { level: 1, exp: 0, withdrawable: 0, ...u };
}
function readUsers(): IUser[] {
  return read<IUser[]>('users', []).map(normalizeUser);
}

/* ---------- 找回密码验证码（后端模拟层：内存存储，10 分钟有效、一次性、防爆破） ---------- */

interface IResetCode {
  code: string;
  sentAt: number;
  expiresAt: number;
  attempts: number;
}
const resetCodeStore = new Map<string, IResetCode>();
const RESET_CODE_TTL = 10 * 60 * 1000; // 10 分钟
const RESET_CODE_MAX_ATTEMPTS = 5; // 连错 5 次作废
const RESET_CODE_COOLDOWN = 60 * 1000; // 同账号 60 秒内只能发一次

/** 生成 6 位数字验证码 */
function genResetCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ---------- 系统设置 ---------- */

const DEFAULT_SETTINGS: ISettings = {
  siteName: '墨影书城',
  announcement: '深夜书城，一页一画。创作者收益经后台审核后发放，请勿在内容中插入脚本代码。',
  vipPrice: 1800,
  rechargeRate: 100,
  subShare: 0.7,
  tipShare: 1,
  openRegister: true,
  rechargeMethods: ['alipay', 'wechat', 'bank', 'cloud'],
  adminCode: '',
  adminLockedUntil: 0,
  adminFailCount: 0,
};

export function defaultSettings(): ISettings {
  return { ...DEFAULT_SETTINGS };
}

/* ---------- 会话（加密存储） ---------- */

function getSessionUserId(): string | null {
  const raw = store.get<string | null>('session', null);
  if (!raw) return null;
  try {
    const s = JSON.parse(deobfuscate(raw)) as { userId: string };
    return s.userId ?? null;
  } catch {
    return null;
  }
}
function writeSession(userId: string | null) {
  write('session', userId ? obfuscate(JSON.stringify({ userId })) : null);
}

/** 初始化种子数据（仅首次 / 版本升级） */
export function INIT_DATA() {
  if ((store.get('v', '') as string) === DB_VERSION) return;
  const seed = buildSeed();
  write('users', seed.users);
  write('books', seed.books);
  write('chapters', seed.chapters);
  write('visualScripts', seed.visualScripts);
  write('comicChapters', seed.comicChapters);
  write('comicPages', seed.comicPages);
  write('reviews', seed.reviews);
  write('txs', seed.txs);
  write('shelf', [] as IShelfEntry[]);
  write('progress', [] as IProgress[]);
  write('withdrawals', [] as IWithdrawal[]);
  write('channels', seed.channels);
  write('settlements', [] as ISettlement[]);
  write('securityLogs', []);
  write('auditLogs', [] as IAuditLog[]);
  write('settings', defaultSettings());
  writeSession(null);
  write('v', DB_VERSION);
}

/* ---------- 工具 ---------- */

export function isVip(u: IUser): boolean {
  if (!u.vip) return false;
  if (u.vipUntil && new Date(u.vipUntil).getTime() < Date.now()) return false;
  return true;
}

export function fmtCoins(n: number): string {
  return n.toLocaleString('zh-CN');
}

export function fmtYuan(coins: number): string {
  return (coins / 100).toFixed(2);
}

/** 渠道类型标签 */
export function channelLabel(type: string): string {
  return type === 'alipay' ? '支付宝' : type === 'wechat' ? '微信' : type === 'bank' ? '银行卡' : type;
}

/** 充值方式标签 */
export function rechargeMethodLabel(m: string): string {
  return m === 'alipay' ? '支付宝' : m === 'wechat' ? '微信支付' : m === 'bank' ? '银行卡' : m === 'cloud' ? '云闪付' : m;
}

/** 账号脱敏：前 3 后 3，中间打码 */
export function maskAccount(account: string): string {
  const a = account.trim();
  if (a.length <= 7) return `${a.slice(0, 1)}****${a.slice(-1)}`;
  return `${a.slice(0, 3)}****${a.slice(-3)}`;
}

export function todayLabel(d: Date): string {
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${mm}-${dd}`;
}

function _daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function sameDay(a: string, b: Date): boolean {
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() && da.getMonth() === b.getMonth() && da.getDate() === b.getDate();
}

export const api = {
  /* ---- 会话 ---- */
  getSession(): IUser | null {
    const id = getSessionUserId();
    if (!id) return null;
    return readUsers().find((u) => u.id === id) ?? null;
  },

  login(username: string, password: string): { ok: boolean; msg?: string; user?: IUser } {
    const users = readUsers();
    const u = users.find((x) => x.username === username && x.password === password);
    if (!u) return { ok: false, msg: '账号或密码不对' };
    if (u.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    writeSession(u.id);
    this.addExp(u.id, 10, '每日登录');
    notify();
    return { ok: true, user: this.getUser(u.id) ?? u };
  },

  register(username: string, password: string, nickname: string): { ok: boolean; msg?: string; user?: IUser } {
    const settings = this.getSettings();
    if (!settings.openRegister) return { ok: false, msg: '本站暂停注册，请联系管理员' };
    const users = readUsers();
    if (users.some((x) => x.username === username)) return { ok: false, msg: '账号已存在' };
    const u: IUser = {
      id: uid('u'), username, password, nickname: nickname || username,
      role: 'reader', vip: false, banned: false, coins: 100,
      withdrawable: 0, level: 1, exp: 0, createdAt: new Date().toISOString(),
    };
    users.push(u);
    write('users', users);
    writeSession(u.id);
    this.addExp(u.id, 10, '新账号注册');
    notify();
    return { ok: true, user: this.getUser(u.id) ?? u };
  },

  logout() {
    writeSession(null);
    notify();
  },

  /** 第三方快捷登录/注册（演示：微信/QQ 固定演示账号，首次自动注册） */
  thirdPartyLogin(provider: 'wechat' | 'qq'): { ok: boolean; msg?: string; user?: IUser } {
    const username = provider === 'wechat' ? 'wx_demo' : 'qq_demo';
    const nickname = provider === 'wechat' ? '微信书友' : 'QQ书友';
    const users = readUsers();
    let u = users.find((x) => x.username === username);
    if (!u) {
      u = {
        id: uid('u'), username, password: `${provider}_${Date.now().toString(36)}`, nickname,
        role: 'reader', vip: false, banned: false, coins: 100,
        withdrawable: 0, level: 1, exp: 0, createdAt: new Date().toISOString(),
      };
      users.push(u);
      write('users', users);
      this.addExp(u.id, 10, '第三方账号注册');
    }
    if (u.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    writeSession(u.id);
    this.addExp(u.id, 10, '每日登录');
    notify();
    return { ok: true, user: this.getUser(u.id) ?? u };
  },

  /* ---- 用户 ---- */
  getUser(id: string): IUser | null {
    const u = readUsers().find((u) => u.id === id);
    return u ? normalizeUser(u) : null;
  },

  allUsers(): IUser[] {
    return readUsers();
  },

  updateProfile(id: string, patch: Partial<Pick<IUser, 'nickname' | 'bio'>>) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i >= 0) {
      users[i] = { ...users[i], ...patch };
      write('users', users);
      notify();
    }
  },

  setRole(id: string, role: UserRole) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i >= 0) {
      users[i].role = role;
      write('users', users);
      notify();
    }
  },

  applyCreator(
    id: string,
    payload: { reason: string; workTitle: string; workType: BookType; workIntro: string },
  ): { ok: boolean; msg?: string } {
    const me = this.getUser(id);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁' };
    if (me.role !== 'reader') return { ok: false, msg: '已是创作者/管理员' };
    if (!payload.reason.trim() || !payload.workTitle.trim() || !payload.workIntro.trim()) {
      return { ok: false, msg: '资质说明、作品名与简介不能为空' };
    }
    const all = read<IApplicant[]>('applicants', []);
    if (all.some((a) => a.userId === id && a.status === 'pending')) {
      return { ok: false, msg: '已提交资质申请，请等待管理员审核' };
    }
    const hits = scanText(`${payload.reason} ${payload.workTitle} ${payload.workIntro}`);
    if (hits.length > 0) {
      security.recordAttack(`创作者资质申请含风险内容已拦截（${hits.join('、')}）：${payload.workTitle}`);
      return { ok: false, msg: '申请内容含风险信息，已被安全中心拦截' };
    }
    all.unshift({
      id: uid('ap'), userId: id, nickname: me.nickname,
      reason: payload.reason.trim(), workTitle: payload.workTitle.trim(),
      workType: payload.workType, workIntro: payload.workIntro.trim(),
      status: 'pending', createdAt: new Date().toISOString(),
    });
    write('applicants', all);
    this.addExp(id, 5, '提交创作者资质申请');
    notify();
    return { ok: true };
  },

  /** 我的最近一条创作者申请 */
  myApplication(userId: string): IApplicant | null {
    return read<IApplicant[]>('applicants', []).find((a) => a.userId === userId) ?? null;
  },

  allApplications(): IApplicant[] {
    return read<IApplicant[]>('applicants', []);
  },

  /** 管理员审核创作者资质：通过则开通创作者身份并生成首部作品（待审核） */
  decideApplication(appId: string, ok: boolean, byUserId: string, note = '') {
    const all = read<IApplicant[]>('applicants', []);
    const i = all.findIndex((a) => a.id === appId);
    if (i < 0) return;
    const app = all[i];
    if (app.status !== 'pending') return;
    const me = this.getUser(byUserId);
    const now = new Date().toISOString();
    if (ok) {
      all[i] = { ...app, status: 'approved', note: note || undefined, handledAt: now };
      const u = this.getUser(app.userId);
      if (u && u.role === 'reader') {
        this.setRole(u.id, 'creator');
        this.addExp(u.id, 30, '创作者资质审核通过');
        const genres: BookGenre[] = ['玄幻', '都市', '科幻', '悬疑', '古言', '青春', '武侠', '奇幻', '仙侠', '历史', '游戏', '言情', '轻小说', '现实'];
        this.createBook({
          type: app.workType,
          title: app.workTitle,
          genre: genres[0],
          coverSeed: `seed-${app.workTitle}`,
          description: app.workIntro,
          tags: [],
          serial: 'serial',
          chapterPrice: 0,
          authorId: u.id,
          authorName: u.nickname,
          status: 'pending',
        });
      }
      security.audit(byUserId, me?.nickname ?? '', '通过创作者资质', `${u?.nickname ?? ''}（${app.workTitle}）`, app.id);
    } else {
      all[i] = { ...app, status: 'rejected', note: note || '未通过审核', handledAt: now };
      security.audit(byUserId, me?.nickname ?? '', '驳回创作者资质', `${app.nickname}（${app.workTitle}）`, app.id);
    }
    write('applicants', all);
    notify();
  },

  /* ---- 管理员更多权限：封禁 / 调币 ---- */

  setBanned(id: string, banned: boolean, byUserId: string) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i < 0 || users[i].role === 'admin') return;
    users[i].banned = banned;
    write('users', users);
    const me = this.getUser(byUserId);
    security.audit(byUserId, me?.nickname ?? '', banned ? '封禁账号' : '解封账号', users[i].nickname, id);
    notify();
  },

  /** 管理员调整用户书币（delta 可为负，不能低于 0） */
  adjustCoins(id: string, delta: number, byUserId: string) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i < 0 || users[i].role === 'admin') return;
    const next = Math.max(0, users[i].coins + delta);
    const changed = next - users[i].coins;
    if (changed === 0) return;
    users[i].coins = next;
    write('users', users);
    this.pushTx(id, 'settle', changed, `管理员调币 ${changed > 0 ? '+' : ''}${changed} 币`, 0);
    const me = this.getUser(byUserId);
    security.audit(byUserId, me?.nickname ?? '', changed > 0 ? '发放书币' : '扣除书币', `${users[i].nickname} ${changed > 0 ? '+' : ''}${changed}`, id);
    notify();
  },

  /** 后台 VIP 授权 */
  setVip(id: string, vip: boolean, days = 30) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i >= 0) {
      users[i].vip = vip;
      if (vip) {
        const until = new Date();
        until.setDate(until.getDate() + days);
        users[i].vipUntil = until.toISOString();
      } else {
        users[i].vipUntil = undefined;
      }
      write('users', users);
      notify();
    }
  },

  /* ---- 用户等级 ---- */
  addExp(id: string, n: number, reason: string) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i < 0) return;
    const before = users[i].level;
    users[i].exp = (users[i].exp ?? 0) + n;
    let lv = users[i].level;
    for (const L of LEVELS) {
      if (users[i].exp >= L.need) lv = L.level;
    }
    users[i].level = lv;
    write('users', users);
    if (lv > before) {
      const L = LEVELS.find((x) => x.level === lv);
      security.audit(id, users[i].nickname, '等级提升', `Lv${before}→Lv${lv}`, `${L?.name}（${reason}）`);
    }
    notify();
  },

  setLevel(id: string, level: number) {
    const users = readUsers();
    const i = users.findIndex((u) => u.id === id);
    if (i >= 0) {
      users[i].level = Math.min(6, Math.max(1, Math.round(level)));
      write('users', users);
      notify();
    }
  },

  levelTitle(level: number): string {
    const L = LEVELS.find((x) => x.level === level) ?? LEVELS[0];
    return L.name;
  },

  /* ---- 系统设置（管理员可改全站） ---- */
  getSettings(): ISettings {
    const s = read<ISettings | null>('settings', null);
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  },

  setSettings(patch: Partial<ISettings>, byUserId?: string) {
    const next = { ...this.getSettings(), ...patch };
    if ('adminCode' in patch && patch.adminCode) {
      next.adminCode = hashString(patch.adminCode);
      next.adminFailCount = 0;
    }
    write('settings', next);
    if (byUserId) {
      const me = this.getUser(byUserId);
      security.audit(byUserId, me?.nickname ?? '管理员', '修改系统设置', Object.keys(patch).join(','), 'settings');
    }
    notify();
  },

  /* ---- 管理安全码（代码锁） ---- */
  ensureAdminCode(code: string, byUserId: string): { ok: boolean; msg?: string } {
    if (code.length < 4) return { ok: false, msg: '安全码至少 4 位' };
    this.setSettings({ adminCode: code }, byUserId);
    security.audit(byUserId, this.getUser(byUserId)?.nickname ?? '', '设置管理安全码', '', '首次启用代码锁');
    return { ok: true };
  },

  verifyAdminCode(code: string): { ok: boolean; lockedUntil?: number; msg?: string } {
    const s = this.getSettings();
    if (s.adminLockedUntil && s.adminLockedUntil > Date.now()) {
      return { ok: false, lockedUntil: s.adminLockedUntil, msg: '安全码错误次数过多，已临时锁定' };
    }
    if (!s.adminCode) return { ok: true };
    if (hashString(code) === s.adminCode) {
      this.setSettings({ adminFailCount: 0 });
      return { ok: true };
    }
    const fails = s.adminFailCount + 1;
    if (fails >= 5) {
      const lockedUntil = Date.now() + 10 * 60 * 1000;
      this.setSettings({ adminFailCount: 0, adminLockedUntil: lockedUntil });
      security.recordAttack('管理后台安全码连续错误 5 次，已锁定 10 分钟');
      return { ok: false, lockedUntil, msg: '错误次数过多，已锁定 10 分钟' };
    }
    this.setSettings({ adminFailCount: fails });
    security.recordAttack(`管理后台安全码验证失败（第 ${fails} 次）`);
    return { ok: false, msg: `安全码错误，还可尝试 ${5 - fails} 次` };
  },

  adminLockedUntil(): number {
    const s = this.getSettings();
    return s.adminLockedUntil && s.adminLockedUntil > Date.now() ? s.adminLockedUntil : 0;
  },

  /* ---- 书籍 ---- */
  publishedBooks(type?: BookType, genre?: BookGenre): IBook[] {
    let list = read<IBook[]>('books', []).filter((b) => b.status === 'published');
    if (type) list = list.filter((b) => b.type === type);
    if (genre) list = list.filter((b) => b.genre === genre);
    return list;
  },

  allBooks(): IBook[] {
    return read<IBook[]>('books', []);
  },

  creatorBooks(authorId: string): IBook[] {
    return read<IBook[]>('books', []).filter((b) => b.authorId === authorId);
  },

  getBook(id: string): IBook | null {
    return read<IBook[]>('books', []).find((b) => b.id === id) ?? null;
  },

  createBook(input: {
    type: BookType; title: string; genre: BookGenre; coverSeed: string;
    description: string; tags: string[]; serial: 'serial' | 'finished';
    chapterPrice: number; authorId: string; authorName: string; status: BookStatus;
    animeKey?: string; coverStyle?: CoverStyle; coverType?: 'svg' | 'image'; coverFont?: CoverFont;
  }): IBook {
    const books = read<IBook[]>('books', []);
    const b: IBook = {
      id: uid('b'), ...input, words: 0, views: 0, likes: 0, rating: 0,
      featured: false, quarantined: false,
      createdAt: new Date().toISOString(), chapterIds: [],
    };
    books.push(b);
    write('books', books);
    this.scanBookContent(b.id);
    this.addExp(input.authorId, 50, '发布新作品');
    notify();
    return b;
  },

  featuredBooks(): IBook[] {
    return this.publishedBooks().filter((b) => b.featured);
  },

  setFeatured(id: string, featured: boolean, byUserId?: string) {
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === id);
    if (i >= 0) {
      books[i].featured = featured;
      write('books', books);
      if (byUserId) {
        const me = this.getUser(byUserId);
        const b = books[i];
        security.audit(byUserId, me?.nickname ?? '', featured ? '推送编辑推荐' : '取消编辑推荐', b.title, id);
      }
      notify();
    }
  },

  /* ---- 内容安全扫描 / 查杀 ---- */

  /** 扫描一个作品的全部文本字段，发现风险写入安全日志（同位置不重复标记） */
  scanBookContent(bookId: string): number {
    const book = this.getBook(bookId);
    if (!book) return 0;
    const targets: { targetType: string; targetId: string; field: string; text: string }[] = [
      { targetType: 'book', targetId: book.id, field: 'title', text: book.title },
      { targetType: 'book', targetId: book.id, field: 'description', text: book.description },
      { targetType: 'book', targetId: book.id, field: 'tags', text: book.tags.join(',') },
    ];
    this.chaptersOf(bookId).forEach((c) => {
      targets.push({ targetType: 'chapter', targetId: c.id, field: 'title', text: c.title });
      targets.push({ targetType: 'chapter', targetId: c.id, field: 'content', text: c.content });
    });
    const vis = this.visualScript(bookId);
    if (vis) {
      vis.nodes.forEach((n) => targets.push({ targetType: 'visualNode', targetId: n.id, field: 'text', text: `${n.text} ${n.choices.map((c) => c.label).join(' ')}` }));
    }
    this.comicChapters(bookId).forEach((cc) => {
      this.comicPages(cc.id).forEach((p) => targets.push({ targetType: 'comicPage', targetId: p.id, field: 'dialogue', text: p.dialogue.join(' ') }));
    });
    let found = 0;
    const existing = security.logs().filter((l) => l.status === 'flagged');
    for (const t of targets) {
      const hits = scanText(t.text);
      if (hits.length === 0) continue;
      const dup = existing.some((l) => l.targetId === t.targetId && l.field === t.field);
      if (dup) continue;
      security.write({
        kind: 'xss',
        level: 'danger',
        targetType: t.targetType,
        targetId: t.targetId,
        field: t.field,
        snippet: t.text.slice(0, 80),
        message: `检测到危险内容：${hits.join('、')}（《${book.title}》）`,
      });
      found += 1;
    }
    return found;
  },

  /** 全库查杀：扫描所有作品 */
  scanAll(): number {
    let n = 0;
    for (const b of this.allBooks()) n += this.scanBookContent(b.id);
    return n;
  },

  hasDanger(): boolean {
    return security.hasDanger();
  },

  ignoreSecurityLog(id: string) {
    security.setStatus(id, 'ignored');
    notify();
  },

  /** 隔离危险作品：下架 + 清除内容 + 封禁作者 */
  quarantine(id: string, byUserId: string) {
    const book = this.getBook(id);
    if (!book) return;
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === id);
    if (i >= 0) {
      books[i].status = 'offline';
      books[i].quarantined = true;
      write('books', books);
    }
    // 清除章节内容
    const chs = this.chaptersOf(id).map((c) => ({ ...c, content: '[内容已被安全系统清除]' }));
    write('chapters', [...read<IChapter[]>('chapters', []).filter((c) => c.bookId !== id), ...chs]);
    // 清除互动剧本与漫画对白
    write('visualScripts', read<IVisualScript[]>('visualScripts', []).filter((v) => v.bookId !== id));
    const ccs = this.comicChapters(id).map((cc) => ({ ...cc, pageIds: [] as string[] }));
    write('comicChapters', [...read<IComicChapter[]>('comicChapters', []).filter((c) => c.bookId !== id), ...ccs]);
    write('comicPages', read<IComicPage[]>('comicPages', []).filter((p) => p.bookId !== id));
    // 封禁作者
    this.setBanned(book.authorId, true, byUserId);
    // 标记日志已清理 + 审计
    security.logs().forEach((l) => {
      if (l.targetId === id || l.targetType === 'chapter' && l.targetId && chs.some((c) => c.id === l.targetId)) {
        security.setStatus(l.id, 'cleaned');
      }
    });
    const me = this.getUser(byUserId);
    security.audit(byUserId, me?.nickname ?? '', '隔离危险作品', book.title, '已下架并清除内容，封禁作者');
    notify();
  },

  updateBook(id: string, patch: Partial<IBook>) {
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === id);
    if (i >= 0) {
      books[i] = { ...books[i], ...patch };
      write('books', books);
      notify();
    }
  },

  /** 创作者/管理员编辑作品信息（封面、简介、题材、风格等）：仅作者本人或管理员可改，写入审计，内容经风险扫描 */
  updateBookInfo(
    id: string,
    patch: { title?: string; description?: string; genre?: BookGenre; coverSeed?: string; coverStyle?: CoverStyle; tags?: string[]; serial?: 'serial' | 'finished' },
    operatorId?: string,
  ): { ok: boolean; msg?: string } {
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === id);
    if (i < 0) return { ok: false, msg: '作品不存在' };
    const book = books[i];
    const me = operatorId ? this.getUser(operatorId) : null;
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁' };
    if (me.role !== 'admin' && book.authorId !== me.id) return { ok: false, msg: '只能修改自己的作品' };
    const combined = [patch.title ?? '', patch.description ?? '', (patch.tags ?? []).join(',')].join(' ');
    const hits = scanText(combined);
    if (hits.length > 0) {
      security.audit(me.id, me.nickname, '编辑作品被拦截', book.title, `命中风险内容: ${hits.join('、')}`);
      return { ok: false, msg: '内容含风险词，已被拦截并记录' };
    }
    books[i] = { ...book, ...patch };
    write('books', books);
    security.audit(me.id, me.nickname, '编辑作品信息', book.title, id);
    notify();
    return { ok: true };
  },

  setBookStatus(id: string, status: BookStatus, note = '') {
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === id);
    if (i >= 0) {
      books[i].status = status;
      write('books', books);
      const reviews = read<IReview[]>('reviews', []);
      reviews.unshift({ id: uid('rv'), bookId: id, action: status === 'published' ? 'approve' : status === 'rejected' ? 'reject' : 'approve', note, createdAt: new Date().toISOString() });
      write('reviews', reviews);
      notify();
    }
  },

  deleteBook(id: string) {
    const books = read<IBook[]>('books', []);
    write('books', books.filter((b) => b.id !== id));
    const chapters = read<IChapter[]>('chapters', []);
    write('chapters', chapters.filter((c) => c.bookId !== id));
    const vis = read<IVisualScript[]>('visualScripts', []);
    write('visualScripts', vis.filter((v) => v.bookId !== id));
    const ccs = read<IComicChapter[]>('comicChapters', []);
    write('comicChapters', ccs.filter((c) => c.bookId !== id));
    const cps = read<IComicPage[]>('comicPages', []);
    write('comicPages', cps.filter((c) => c.bookId !== id));
    notify();
  },

  addView(id: string) {
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === id);
    if (i >= 0) {
      books[i].views += 1;
      write('books', books);
      notify();
    }
  },

  /* ---- 章节与剧本 ---- */
  chaptersOf(bookId: string): IChapter[] {
    return read<IChapter[]>('chapters', [])
      .filter((c) => c.bookId === bookId)
      .sort((a, b) => a.index - b.index);
  },

  getChapter(id: string): IChapter | null {
    return read<IChapter[]>('chapters', []).find((c) => c.id === id) ?? null;
  },

  saveChapters(bookId: string, chapters: Omit<IChapter, 'id' | 'bookId'>[]) {
    const all = read<IChapter[]>('chapters', []).filter((c) => c.bookId !== bookId);
    const created = chapters.map((c, i) => ({ ...c, id: uid('c'), bookId, index: i + 1 }));
    write('chapters', [...all, ...created]);
    const books = read<IBook[]>('books', []);
    const bi = books.findIndex((b) => b.id === bookId);
    if (bi >= 0) {
      books[bi].chapterIds = created.map((c) => c.id);
      books[bi].words = created.reduce((s, c) => s + c.content.length, 0);
      write('books', books);
    }
    this.scanBookContent(bookId);
    notify();
  },

  visualScript(bookId: string): IVisualScript | null {
    return read<IVisualScript[]>('visualScripts', []).find((v) => v.bookId === bookId) ?? null;
  },

  saveVisualScript(bookId: string, script: IVisualScript) {
    const all = read<IVisualScript[]>('visualScripts', []).filter((v) => v.bookId !== bookId);
    write('visualScripts', [...all, script]);
    const books = read<IBook[]>('books', []);
    const bi = books.findIndex((b) => b.id === bookId);
    if (bi >= 0) {
      books[bi].chapterIds = [script.startNode];
      write('books', books);
    }
    this.scanBookContent(bookId);
    notify();
  },

  comicChapters(bookId: string): IComicChapter[] {
    return read<IComicChapter[]>('comicChapters', [])
      .filter((c) => c.bookId === bookId)
      .sort((a, b) => a.index - b.index);
  },

  comicChapter(id: string): IComicChapter | null {
    return read<IComicChapter[]>('comicChapters', []).find((c) => c.id === id) ?? null;
  },

  comicPages(chapterId: string): IComicPage[] {
    return read<IComicPage[]>('comicPages', [])
      .filter((p) => p.chapterId === chapterId)
      .sort((a, b) => a.index - b.index);
  },

  saveComic(bookId: string, chapters: { title: string; price: number; pages: { scene: string; imageKey?: string; caption?: string; dialogue: string[] }[] }[]) {
    const allC = read<IComicChapter[]>('comicChapters', []).filter((c) => c.bookId !== bookId);
    const allP = read<IComicPage[]>('comicPages', []).filter((c) => c.bookId !== bookId);
    const created: IComicChapter[] = [];
    const pages: IComicPage[] = [];
    chapters.forEach((ch, i) => {
      const cc: IComicChapter = { id: uid('k'), bookId, index: i + 1, title: ch.title, price: ch.price, pageIds: [] };
      created.push(cc);
      ch.pages.forEach((p, pi) => {
        const cp: IComicPage = { id: uid('p'), bookId, chapterId: cc.id, index: pi + 1, scene: p.scene, imageKey: p.imageKey, caption: p.caption, dialogue: p.dialogue };
        pages.push(cp);
        cc.pageIds.push(cp.id);
      });
    });
    write('comicChapters', [...allC, ...created]);
    write('comicPages', [...allP, ...pages]);
    const books = read<IBook[]>('books', []);
    const bi = books.findIndex((b) => b.id === bookId);
    if (bi >= 0) {
      books[bi].chapterIds = created.map((c) => c.id);
      books[bi].words = pages.reduce((s, p) => s + p.dialogue.join('').length, 0);
      write('books', books);
    }
    this.scanBookContent(bookId);
    notify();
  },

  /* ---- 书架与进度 ---- */
  shelfOf(userId: string): IBook[] {
    const entries = read<IShelfEntry[]>('shelf', []).filter((e) => e.userId === userId);
    const books = read<IBook[]>('books', []);
    return entries
      .map((e) => books.find((b) => b.id === e.bookId))
      .filter((b): b is IBook => !!b);
  },

  inShelf(userId: string, bookId: string): boolean {
    return read<IShelfEntry[]>('shelf', []).some((e) => e.userId === userId && e.bookId === bookId);
  },

  addShelf(userId: string, bookId: string) {
    const entries = read<IShelfEntry[]>('shelf', []);
    if (!entries.some((e) => e.userId === userId && e.bookId === bookId)) {
      entries.push({ userId, bookId, addedAt: new Date().toISOString() });
      write('shelf', entries);
      const books = read<IBook[]>('books', []);
      const i = books.findIndex((b) => b.id === bookId);
      if (i >= 0) {
        books[i].likes += 1;
        write('books', books);
        this.addExp(books[i].authorId, 3, '作品被收藏');
      }
      notify();
    }
  },

  removeShelf(userId: string, bookId: string) {
    const entries = read<IShelfEntry[]>('shelf', []);
    write('shelf', entries.filter((e) => !(e.userId === userId && e.bookId === bookId)));
    const books = read<IBook[]>('books', []);
    const i = books.findIndex((b) => b.id === bookId);
    if (i >= 0 && books[i].likes > 0) books[i].likes -= 1;
    write('books', books);
    notify();
  },

  getProgress(userId: string, bookId: string): IProgress | null {
    return read<IProgress[]>('progress', []).find((p) => p.userId === userId && p.bookId === bookId) ?? null;
  },

  saveProgress(userId: string, bookId: string, chapterId?: string, nodeId?: string) {
    const all = read<IProgress[]>('progress', []).filter((p) => !(p.userId === userId && p.bookId === bookId));
    all.push({ userId, bookId, chapterId, nodeId, updatedAt: new Date().toISOString() });
    write('progress', all);
    notify();
  },

  recentReads(userId: string): { book: IBook; chapterTitle?: string; updatedAt: string }[] {
    const all = read<IProgress[]>('progress', [])
      .filter((p) => p.userId === userId)
      .sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : 1));
    const books = read<IBook[]>('books', []);
    const chapters = read<IChapter[]>('chapters', []);
    const mapped = all.slice(0, 8).map((p) => {
      const book = books.find((b) => b.id === p.bookId);
      const chapter = p.chapterId ? chapters.find((c) => c.id === p.chapterId) : undefined;
      return book ? { book, chapterTitle: chapter?.title, updatedAt: p.updatedAt } : null;
    });
    return mapped.filter((x): x is NonNullable<typeof x> => x !== null);
  },

  /* ---- 钱包与付费 ---- */
  txsOf(userId: string): ITx[] {
    return read<ITx[]>('txs', [])
      .filter((t) => t.userId === userId)
      .sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
  },

  pushTx(userId: string, kind: TxKind, coin: number, note: string, amount = 0, bookId?: string, method?: string, chapterId?: string) {
    const txs = read<ITx[]>('txs', []);
    txs.unshift({ id: uid('tx'), userId, kind, amount, coin, note, createdAt: new Date().toISOString(), bookId, method, chapterId });
    write('txs', txs);
    const users = read<IUser[]>('users', []);
    const i = users.findIndex((u) => u.id === userId);
    if (i >= 0) {
      users[i].coins += coin;
      write('users', users);
    }
    notify();
  },

  recharge(userId: string, yuan: number, method: string = 'alipay') {
    const rate = this.getSettings().rechargeRate;
    this.pushTx(userId, 'recharge', yuan * rate, `充值 ${yuan} 元（${rechargeMethodLabel(method)} · 1元=${rate}币）`, yuan, undefined, method);
    notify();
  },

  /** 订阅普通小说章节（VIP 或免费章直接可读） */
  payChapter(userId: string, chapter: IChapter): { ok: boolean; msg?: string } {
    if (chapter.price <= 0) return { ok: true };
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (isVip(me)) return { ok: true };
    if (me.coins < chapter.price) return { ok: false, msg: '书币不足，请先充值' };
    this.pushTx(userId, 'subscribe', -chapter.price, `订阅《${this.getBook(chapter.bookId)?.title ?? ''}》第${chapter.index}章`, 0, chapter.bookId, undefined, chapter.id);
    this.creditAuthor(chapter.bookId, chapter.price, '订阅');
    return { ok: true };
  },

  /** 解锁互动小说全本 */
  unlockVisual(userId: string, book: IBook): { ok: boolean; msg?: string } {
    const price = book.chapterPrice;
    if (price <= 0) return { ok: true };
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (isVip(me)) return { ok: true };
    if (me.coins < price) return { ok: false, msg: '书币不足，请先充值' };
    this.pushTx(userId, 'subscribe', -price, `解锁互动小说《${book.title}》`, 0, book.id);
    this.creditAuthor(book.id, price, '订阅');
    return { ok: true };
  },

  /** 订阅漫画章节 */
  payComic(userId: string, chapter: IComicChapter, book: IBook): { ok: boolean; msg?: string } {
    if (chapter.price <= 0) return { ok: true };
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (isVip(me)) return { ok: true };
    if (me.coins < chapter.price) return { ok: false, msg: '书币不足，请先充值' };
    this.pushTx(userId, 'subscribe', -chapter.price, `订阅漫画《${book.title}》第${chapter.index}章`, 0, book.id, undefined, chapter.id);
    this.creditAuthor(book.id, chapter.price, '订阅');
    return { ok: true };
  },

  tip(userId: string, book: IBook, coins: number) {
    const me = this.getUser(userId);
    if (!me || me.coins < coins) return;
    this.pushTx(userId, 'tip', -coins, `打赏《${book.title}》${coins}书币`, 0, book.id);
    this.creditAuthor(book.id, coins, '打赏');
  },

  buyVip(userId: string): { ok: boolean; msg?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    const price = this.getSettings().vipPrice;
    if (me.coins < price) return { ok: false, msg: '书币不足，请先充值' };
    this.pushTx(userId, 'vip', -price, '开通月度 VIP', 0);
    const users = readUsers();
    const i = users.findIndex((u) => u.id === userId);
    const until = new Date();
    until.setDate(until.getDate() + 30);
    users[i].vip = true;
    users[i].vipUntil = until.toISOString();
    write('users', users);
    this.addExp(userId, 20, '开通 VIP');
    notify();
    return { ok: true };
  },

  /** 创作者分成入账：先生成“待结算”单，管理员审核通过后才进入可提现余额（收益保护） */
  creditAuthor(bookId: string, paidCoins: number, kind: '订阅' | '打赏') {
    const book = this.getBook(bookId);
    if (!book) return;
    const author = this.getUser(book.authorId);
    if (!author) return;
    const settings = this.getSettings();
    const rate = kind === '订阅' ? settings.subShare : settings.tipShare;
    const boost = isVip(author) ? 1.1 : 1;
    const earn = Math.round(paidCoins * rate * boost);
    const note = kind === '订阅' ? `订阅分成《${book.title}》` : `打赏分成《${book.title}》`;
    this.pushTx(book.authorId, 'reward', earn, note, 0, bookId);
    const all = read<ISettlement[]>('settlements', []);
    all.unshift({
      id: uid('st'), userId: book.authorId, bookId, kind: kind === '订阅' ? 'subscribe' : 'tip',
      amount: earn, note, status: 'pending', createdAt: new Date().toISOString(),
    });
    write('settlements', all);
    this.addExp(book.authorId, 5, '作品获得收益');
    notify();
  },

  /* ---- 收益结算审核 ---- */
  allSettlements(): ISettlement[] {
    return read<ISettlement[]>('settlements', []);
  },
  settlementsOf(userId: string): ISettlement[] {
    return read<ISettlement[]>('settlements', []).filter((s) => s.userId === userId);
  },
  decideSettlement(id: string, ok: boolean, byUserId: string) {
    const all = read<ISettlement[]>('settlements', []);
    const i = all.findIndex((s) => s.id === id);
    if (i < 0) return;
    all[i].status = ok ? 'approved' : 'rejected';
    all[i].decidedAt = new Date().toISOString();
    if (ok) {
      const users = readUsers();
      const ui = users.findIndex((u) => u.id === all[i].userId);
      if (ui >= 0) {
        users[ui].withdrawable = (users[ui].withdrawable ?? 0) + all[i].amount;
        write('users', users);
      }
    }
    write('settlements', all);
    const me = this.getUser(byUserId);
    security.audit(byUserId, me?.nickname ?? '', ok ? '通过收益结算' : '驳回收益结算', all[i].note, `${all[i].amount} 币`);
    notify();
  },

  /* ---- 创作者收益 ---- */
  creatorStats(authorId: string): { income: number; pending: number; books: number; fans: number; views: number; drafts: number; pendingCount: number } {
    const txs = read<ITx[]>('txs', []).filter((t) => t.userId === authorId && t.kind === 'reward');
    const income = txs.reduce((s, t) => s + t.coin, 0);
    const me = this.getUser(authorId);
    const pending = me?.withdrawable ?? 0;
    const books = read<IBook[]>('books', []).filter((b) => b.authorId === authorId && b.status !== 'draft');
    const likes = books.reduce((s, b) => s + b.likes, 0);
    const views = books.reduce((s, b) => s + b.views, 0);
    const drafts = read<IBook[]>('books', []).filter((b) => b.authorId === authorId && b.status === 'draft').length;
    const pendingCount = read<IBook[]>('books', []).filter((b) => b.authorId === authorId && b.status === 'pending').length;
    return { income, pending, books: books.length, fans: likes, views, drafts, pendingCount };
  },

  /** 创作者近 N 日收益趋势（按结算单日期聚合，单位书币） */
  creatorIncomeTrend(authorId: string, days = 7): { date: string; label: string; amount: number }[] {
    const out: { date: string; label: string; amount: number }[] = [];
    const now = new Date();
    const map = new Map<string, number>();
    read<ISettlement[]>('settlements', [])
      .filter((s) => s.userId === authorId && s.status === 'approved')
      .forEach((s) => {
        const d = s.createdAt.slice(0, 10);
        map.set(d, (map.get(d) ?? 0) + s.amount);
      });
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, amount: map.get(key) ?? 0 });
    }
    return out;
  },

  /* ---- 作品评论 ---- */

  commentsOf(bookId: string): IComment[] {
    return read<IComment[]>('comments', [])
      .filter((c) => c.bookId === bookId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  addComment(userId: string, bookId: string, content: string, replyTo?: { id: string; name: string } | undefined): { ok: boolean; msg?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁' };
    const text = content.trim();
    if (!text) return { ok: false, msg: '评论不能为空' };
    if (text.length > 300) return { ok: false, msg: '评论最多 300 字' };
    const hits = scanText(text);
    if (hits.length > 0) {
      security.audit(userId, me.nickname, '发布评论被拦截', `作品 ${bookId}`, `命中风险内容: ${hits.join('、')}`);
      return { ok: false, msg: '内容含风险词，已被拦截并记录' };
    }
    const comments = read<IComment[]>('comments', []);
    comments.unshift({
      id: uid('cm'), bookId, userId, userName: me.nickname, content: text,
      likes: 0, likedBy: [], replyToId: replyTo?.id, replyToName: replyTo?.name, createdAt: new Date().toISOString(),
    });
    write('comments', comments);
    this.addExp(userId, 2, '发布评论');
    notify();
    return { ok: true };
  },

  toggleCommentLike(userId: string, commentId: string): { ok: boolean; liked: boolean; msg?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, liked: false, msg: '请先登录' };
    const comments = read<IComment[]>('comments', []);
    const i = comments.findIndex((c) => c.id === commentId);
    if (i < 0) return { ok: false, liked: false, msg: '评论不存在' };
    const c = comments[i];
    const has = c.likedBy.includes(userId);
    if (has) {
      c.likedBy = c.likedBy.filter((x) => x !== userId);
      c.likes = Math.max(0, c.likes - 1);
    } else {
      c.likedBy.push(userId);
      c.likes += 1;
    }
    comments[i] = c;
    write('comments', comments);
    notify();
    return { ok: true, liked: !has };
  },

  deleteComment(commentId: string, byUserId: string): { ok: boolean; msg?: string } {
    const me = this.getUser(byUserId);
    if (!me) return { ok: false, msg: '请先登录' };
    const comments = read<IComment[]>('comments', []);
    const target = comments.find((c) => c.id === commentId);
    if (!target) return { ok: false, msg: '评论不存在' };
    if (me.role !== 'admin' && target.userId !== byUserId) return { ok: false, msg: '只能删除自己的评论' };
    write('comments', comments.filter((c) => c.id !== commentId && c.replyToId !== commentId));
    security.audit(byUserId, me.nickname, '删除评论', target.content.slice(0, 20), commentId);
    notify();
    return { ok: true };
  },

  /* ---- 追更通知 ---- */

  /** 该书相对读者进度是否有未读新章节（读到最新章或无新内容返回 false） */
  bookHasUpdate(userId: string, book: IBook): boolean {
    if (book.type !== 'novel' && book.type !== 'comic') return false;
    const chs = book.type === 'novel' ? this.chaptersOf(book.id) : this.comicChapters(book.id);
    if (chs.length === 0) return false;
    const prog = this.getProgress(userId, book.id);
    if (!prog?.chapterId) return true; // 收藏了但还没开始读 → 视为有未读内容
    const cur = chs.findIndex((c) => c.id === prog.chapterId);
    return cur >= 0 && cur < chs.length - 1;
  },

  /* ---- 签到与每日任务 ---- */

  /** 签到数据：今日是否已签、连续天数、今日阅读任务是否完成 */
  checkinInfo(userId: string): { today: boolean; streak: number; readDone: boolean; checkinReward: number; readReward: number } {
    const daily = read<Record<string, { date: string; streak: number; readDone: boolean }>>('daily', {});
    const row = daily[userId];
    const key = this.todayKey();
    const isToday = row?.date === key;
    return {
      today: isToday,
      streak: row && (isToday || row.date === this.yesterdayKey()) ? (row.streak ?? 1) : 0,
      readDone: isToday ? !!row?.readDone : false,
      checkinReward: 10,
      readReward: 5,
    };
  },

  todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  yesterdayKey(): string {
    const d = new Date(Date.now() - 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  checkin(userId: string): { ok: boolean; msg?: string; reward?: number; streak?: number } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁' };
    const info = this.checkinInfo(userId);
    if (info.today) return { ok: false, msg: '今天已经签到过啦，明天再来' };
    const daily = read<Record<string, { date: string; streak: number; readDone: boolean }>>('daily', {});
    const key = this.todayKey();
    const prev = daily[userId];
    const streak = prev?.date === this.yesterdayKey() ? (prev.streak ?? 0) + 1 : 1;
    daily[userId] = { date: key, streak, readDone: false };
    write('daily', daily);
    this.pushTx(userId, 'settle', info.checkinReward, '每日签到奖励', 0);
    this.addExp(userId, 5, '每日签到');
    security.audit(userId, me.nickname, '每日签到', `连续 ${streak} 天`, `+${info.checkinReward} 币`);
    notify();
    return { ok: true, reward: info.checkinReward, streak };
  },

  /** 今日阅读任务：进入阅读页时调用（每天一次） */
  markReadTask(userId: string): { ok: boolean; reward?: number } {
    const info = this.checkinInfo(userId);
    if (info.today && !info.readDone) {
      const daily = read<Record<string, { date: string; streak: number; readDone: boolean }>>('daily', {});
      const row = daily[userId];
      daily[userId] = { ...row, readDone: true };
      write('daily', daily);
      this.pushTx(userId, 'settle', info.readReward, '今日阅读任务奖励', 0);
      notify();
      return { ok: true, reward: info.readReward };
    }
    return { ok: false };
  },

  /* ---- 排行榜 ---- */

  rankBooks(kind: 'views' | 'new' | 'tips'): { book: IBook; value: number; label: string }[] {
    const published = this.publishedBooks();
    if (kind === 'views') {
      return [...published].sort((a, b) => b.views - a.views).slice(0, 10).map((b) => ({ book: b, value: b.views, label: `${b.views.toLocaleString('zh-CN')} 阅读` }));
    }
    if (kind === 'new') {
      return [...published].sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 10).map((b) => ({ book: b, value: b.likes, label: `${b.likes} 收藏` }));
    }
    // 打赏榜：按已结算打赏金额聚合
    const map = new Map<string, number>();
    read<ISettlement[]>('settlements', [])
      .filter((s) => s.kind === 'tip' && s.status === 'approved' && s.bookId)
      .forEach((s) => map.set(s.bookId!, (map.get(s.bookId!) ?? 0) + s.amount));
    return [...map.entries()]
      .map(([bookId, amount]) => {
        const book = this.getBook(bookId);
        return book && book.status === 'published' ? { book, amount } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(({ book, amount }) => ({ book, value: amount, label: `打赏 ${amount} 币` }));
  },

  /* ---- 账号安全：改密码 / 找回 ---- */

  changePassword(userId: string, oldPwd: string, newPwd: string): { ok: boolean; msg?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (!oldPwd || me.password !== oldPwd) return { ok: false, msg: '原密码不对' };
    if (!newPwd || newPwd.length < 6) return { ok: false, msg: '新密码至少 6 位' };
    if (newPwd === oldPwd) return { ok: false, msg: '新密码不能与原密码相同' };
    const users = readUsers();
    const i = users.findIndex((u) => u.id === userId);
    users[i].password = newPwd;
    write('users', users);
    security.audit(userId, me.nickname, '修改密码', '账号安全', '密码已更新');
    notify();
    return { ok: true };
  },

  /** 申请找回密码验证码：校验账号存在、60 秒频控，验证码存后端模拟层（10 分钟有效） */
  requestResetCode(account: string): { ok: boolean; msg?: string; demoCode?: string } {
    const accountKey = account.trim();
    if (!accountKey) return { ok: false, msg: '请输入注册账号（用户名 / 手机号 / 邮箱）' };
    const users = readUsers();
    const u = users.find((x) => x.username === accountKey);
    if (!u) return { ok: false, msg: '该账号不存在，请检查输入' };
    if (u.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    const exist = resetCodeStore.get(accountKey);
    if (exist && Date.now() - exist.sentAt < RESET_CODE_COOLDOWN) {
      return { ok: false, msg: '验证码已发送，请 60 秒后再试' };
    }
    const code = genResetCode();
    resetCodeStore.set(accountKey, { code, sentAt: Date.now(), expiresAt: Date.now() + RESET_CODE_TTL, attempts: 0 });
    security.audit(u.id, u.nickname, '申请找回密码验证码', '账号安全', '验证码已生成（10 分钟有效）');
    // 演示环境：验证码直接返回展示；真实生产由短信/邮件网关下发
    return { ok: true, msg: '验证码已发送（演示环境直接显示）', demoCode: code };
  },

  /** 忘记密码：按注册账号重置密码。验证码由后端校验：一次性、10 分钟有效、连错 5 次作废 */
  resetPassword(account: string, code: string, newPwd: string): { ok: boolean; msg?: string } {
    const accountKey = account.trim();
    const users = readUsers();
    const u = users.find((x) => x.username === accountKey);
    if (!u) return { ok: false, msg: '该账号不存在，请检查输入' };
    const rec = resetCodeStore.get(accountKey);
    if (!rec) return { ok: false, msg: '请先获取验证码' };
    if (rec.expiresAt < Date.now()) {
      resetCodeStore.delete(accountKey);
      return { ok: false, msg: '验证码已过期，请重新获取' };
    }
    if (rec.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      resetCodeStore.delete(accountKey);
      security.audit(u.id, u.nickname, '重置密码拦截', '账号安全', '验证码尝试次数超限，已作废并要求重新获取');
      return { ok: false, msg: '验证码错误次数过多，已作废，请重新获取' };
    }
    if (rec.code !== code.trim()) {
      rec.attempts += 1;
      resetCodeStore.set(accountKey, rec);
      return { ok: false, msg: `验证码不对，请核对（剩余 ${RESET_CODE_MAX_ATTEMPTS - rec.attempts} 次机会）` };
    }
    if (!newPwd || newPwd.length < 6) return { ok: false, msg: '新密码至少 6 位' };
    if (newPwd === u.password) return { ok: false, msg: '新密码不能与原密码相同' };
    // 校验通过：作废验证码（一次性），更新密码
    resetCodeStore.delete(accountKey);
    const i = users.findIndex((x) => x.id === u.id);
    users[i].password = newPwd;
    write('users', users);
    security.audit(u.id, u.nickname, '重置密码', '账号安全', '通过验证码校验重置密码成功');
    notify();
    return { ok: true };
  },

  /* ---- 钱包与付费 ---- */
  requestWithdraw(userId: string, amount: number, channelId?: string, confirmPwd?: string): { ok: boolean; msg?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (!confirmPwd || me.password !== confirmPwd) return { ok: false, msg: '安全验证失败：登录密码不正确（二次验证）' };
    if (!amount || amount <= 0) return { ok: false, msg: '金额不对' };
    // 提现风控：单笔上限 500 元，单日最多 3 次
    if (amount > 500) return { ok: false, msg: '单笔提现上限 500 元，请分批申请' };
    const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const todayCount = read<IWithdrawal[]>('withdrawals', []).filter((w) => w.userId === userId && w.createdAt.startsWith(todayKey)).length;
    if (todayCount >= 3) return { ok: false, msg: '今日提现次数已达上限（3 次），明天再试' };
    const needCoins = Math.round(amount * 100);
    if (needCoins > (me.withdrawable ?? 0)) return { ok: false, msg: '可提现余额不足（需后台审核通过后的收益）' };
    // 提现必须绑定已审核通过的渠道
    let channel: IWithdrawChannel | undefined;
    if (channelId) {
      channel = read<IWithdrawChannel[]>('channels', []).find((c) => c.id === channelId && c.userId === userId);
    } else {
      channel = read<IWithdrawChannel[]>('channels', []).find((c) => c.userId === userId && c.status === 'approved');
    }
    if (!channel) return { ok: false, msg: '请先绑定提现渠道，并通过管理员审核后再提现' };
    if (channel.status !== 'approved') return { ok: false, msg: '提现渠道尚未通过管理员审核，暂不能提现' };
    // 冻结资金：立即从可提现余额扣除，待管理员审核
    const users = readUsers();
    const ui = users.findIndex((u) => u.id === userId);
    users[ui].withdrawable = Math.max(0, (users[ui].withdrawable ?? 0) - needCoins);
    write('users', users);
    const all = read<IWithdrawal[]>('withdrawals', []);
    all.unshift({
      id: uid('wd'),
      userId,
      amount,
      status: 'pending',
      channelId: channel.id,
      channel: { type: channel.type, account: channel.account, accountName: channel.accountName, bankName: channel.bankName },
      createdAt: new Date().toISOString(),
    });
    write('withdrawals', all);
    this.pushTx(userId, 'withdraw', -needCoins, `申请提现 ${amount} 元（${channelLabel(channel.type)} · ${maskAccount(channel.account)}）`, amount);
    notify();
    return { ok: true };
  },

  /* ---- 提现渠道（绑定需管理员审核） ---- */

  myChannels(userId: string): IWithdrawChannel[] {
    return read<IWithdrawChannel[]>('channels', []).filter((c) => c.userId === userId);
  },

  allChannels(): IWithdrawChannel[] {
    return read<IWithdrawChannel[]>('channels', []);
  },

  /** 新增或更新渠道：保存即进入待审核，审核通过后可用 */
  saveChannel(userId: string, data: { type: ChannelType; account: string; accountName: string; bankName?: string }): { ok: boolean; msg?: string } {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，请联系管理员' };
    if (!data.type || !data.account.trim() || !data.accountName.trim()) return { ok: false, msg: '请填写完整的渠道信息' };
    if (data.account.trim().length < 4) return { ok: false, msg: '账号长度不合法' };
    const all = read<IWithdrawChannel[]>('channels', []);
    const exists = all.find((c) => c.userId === userId && c.type === data.type);
    if (exists) {
      exists.account = data.account.trim();
      exists.accountName = data.accountName.trim();
      exists.bankName = data.bankName?.trim() || undefined;
      exists.status = 'pending';
      exists.note = undefined;
      exists.createdAt = new Date().toISOString();
      write('channels', all);
    } else {
      all.unshift({
        id: uid('ch'),
        userId,
        type: data.type,
        account: data.account.trim(),
        accountName: data.accountName.trim(),
        bankName: data.bankName?.trim() || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      write('channels', all);
    }
    security.audit(userId, me.nickname, '提交提现渠道审核', channelLabel(data.type), `${maskAccount(data.account)}（${data.accountName}）`);
    notify();
    return { ok: true };
  },

  /** 管理员审核渠道 */
  decideChannel(id: string, ok: boolean, byUserId: string, note?: string) {
    const all = read<IWithdrawChannel[]>('channels', []);
    const i = all.findIndex((c) => c.id === id);
    if (i < 0) return;
    all[i].status = ok ? 'approved' : 'rejected';
    all[i].note = note?.trim() || undefined;
    write('channels', all);
    const me = this.getUser(byUserId);
    const owner = this.getUser(all[i].userId);
    security.audit(
      byUserId, me?.nickname ?? '', ok ? '通过提现渠道' : '驳回提现渠道',
      `${owner?.nickname ?? ''}的${channelLabel(all[i].type)}`, `${maskAccount(all[i].account)}（${all[i].accountName}）`,
    );
    notify();
  },

  withdrawalsOf(userId: string): IWithdrawal[] {
    return read<IWithdrawal[]>('withdrawals', []).filter((w) => w.userId === userId);
  },

  allWithdrawals(): IWithdrawal[] {
    return read<IWithdrawal[]>('withdrawals', []);
  },

  decideWithdrawal(id: string, status: 'done' | 'rejected', byUserId: string) {
    const all = read<IWithdrawal[]>('withdrawals', []);
    const i = all.findIndex((w) => w.id === id);
    if (i >= 0) {
      all[i].status = status;
      write('withdrawals', all);
      if (status === 'rejected') {
        // 驳回退回冻结资金
        const users = readUsers();
        const ui = users.findIndex((u) => u.id === all[i].userId);
        if (ui >= 0) {
          users[ui].withdrawable = (users[ui].withdrawable ?? 0) + Math.round(all[i].amount * 100);
          write('users', users);
        }
        this.pushTx(all[i].userId, 'withdraw', Math.round(all[i].amount * 100), `提现被驳回，资金退回`, all[i].amount);
      }
      const me = this.getUser(byUserId);
      const w = all[i];
      security.audit(byUserId, me?.nickname ?? '', status === 'done' ? '确认提现到账' : '驳回提现', `${w.amount} 元`, w.id);
      notify();
    }
  },

  /* ---- 管理后台统计 ---- */
  /* ---- 读者隐私化 ---- */
  savePrivacy(userId: string, patch: Partial<IPrivacy>) {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    const users = readUsers();
    const i = users.findIndex((u) => u.id === userId);
    if (i >= 0) {
      users[i].privacy = { hideBalance: false, hideRecent: false, hideShelf: false, hideRecords: false, stealth: false, ...(users[i].privacy ?? {}), ...patch };
      write('users', users);
      security.audit(userId, me.nickname, '更新隐私设置', Object.entries(patch).map(([k, v]) => `${k}=${v ? '开' : '关'}`).join('、'), userId);
      notify();
    }
    return { ok: true };
  },

  /** 清除阅读历史（隐私化管理） */
  clearHistory(userId: string) {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    write('progress', read<IProgress[]>('progress', []).filter((p) => p.userId !== userId));
    security.audit(userId, me.nickname, '清除阅读历史', '读者主动清除全部阅读记录', userId);
    notify();
    return { ok: true };
  },

  /* ---- 意见反馈 ---- */
  submitFeedback(userId: string, payload: { type: IFeedback['type']; title: string; content: string; contact?: string }) {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，无法提交反馈' };
    if (!payload.title.trim() || !payload.content.trim()) return { ok: false, msg: '请填写标题与内容' };
    const hits = scanText(`${payload.title} ${payload.content}`);
    if (hits.length > 0) {
      security.recordAttack(`反馈内容含风险信息已拦截（${hits.join('、')}）`);
      return { ok: false, msg: '反馈内容含风险信息，已被安全中心拦截' };
    }
    const list = read<IFeedback[]>('feedback', []);
    list.unshift({
      id: uid('fb'), userId, userName: me.nickname, type: payload.type,
      title: payload.title.trim(), content: payload.content.trim(),
      contact: payload.contact?.trim() || undefined,
      status: 'pending', createdAt: new Date().toISOString(),
    });
    write('feedback', list);
    security.audit(userId, me.nickname, '提交意见反馈', payload.title, userId);
    notify();
    return { ok: true };
  },

  myFeedback(userId: string): IFeedback[] {
    return read<IFeedback[]>('feedback', []).filter((f) => f.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  adminFeedback(): IFeedback[] {
    return read<IFeedback[]>('feedback', []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  replyFeedback(feedbackId: string, reply: string, byUserId: string) {
    const me = this.getUser(byUserId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (!reply.trim()) return { ok: false, msg: '回复内容不能为空' };
    const list = read<IFeedback[]>('feedback', []);
    const f = list.find((x) => x.id === feedbackId);
    if (!f) return { ok: false, msg: '反馈不存在' };
    f.status = 'resolved';
    f.reply = reply.trim();
    f.replyAt = new Date().toISOString();
    write('feedback', list);
    security.audit(byUserId, me.nickname, '回复反馈工单', `${f.userName}·${f.title}`, feedbackId);
    notify();
    return { ok: true };
  },

  /* ---- 客服站内信 ---- */
  sendMessage(userId: string, text: string) {
    const me = this.getUser(userId);
    if (!me) return { ok: false, msg: '请先登录' };
    if (me.banned) return { ok: false, msg: '账号已被封禁，无法发送消息' };
    if (!text.trim()) return { ok: false, msg: '消息内容不能为空' };
    if (text.length > 500) return { ok: false, msg: '消息最长 500 字' };
    const hits = scanText(text);
    if (hits.length > 0) {
      security.recordAttack(`站内消息含风险信息已拦截（${hits.join('、')}）`);
      return { ok: false, msg: '消息含风险信息，已被安全中心拦截' };
    }
    const list = read<IMessage[]>('messages', []);
    list.push({
      id: uid('msg'), userId, userName: me.nickname, sender: 'user',
      text: text.trim(), createdAt: new Date().toISOString(), read: false,
    });
    write('messages', list);
    notify();
    return { ok: true };
  },

  myMessages(userId: string): IMessage[] {
    return read<IMessage[]>('messages', []).filter((m) => m.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },

  adminMessages(): IMessage[] {
    return read<IMessage[]>('messages', []).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },

  adminReply(userId: string, text: string, byUserId: string) {
    const me = this.getUser(byUserId);
    if (!me) return { ok: false, msg: '请先登录' };
    const target = this.getUser(userId);
    if (!target) return { ok: false, msg: '用户不存在' };
    if (!text.trim()) return { ok: false, msg: '回复内容不能为空' };
    const list = read<IMessage[]>('messages', []);
    list.push({
      id: uid('msg'), userId, userName: target.nickname, sender: 'admin',
      text: text.trim(), createdAt: new Date().toISOString(), read: false,
    });
    write('messages', list);
    security.audit(byUserId, me.nickname, '回复客服消息', `${target.nickname}·${text.slice(0, 20)}`, userId);
    notify();
    return { ok: true };
  },

  /** 管理员查看会话后标记未读为已读 */
  markSupportRead() {
    const list = read<IMessage[]>('messages', []);
    let changed = false;
    list.forEach((m) => {
      if (m.sender === 'user' && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) {
      write('messages', list);
      notify();
    }
  },

  adminStats() {
    const users = readUsers();
    const books = read<IBook[]>('books', []);
    const txs = read<ITx[]>('txs', []);
    const settlements = read<ISettlement[]>('settlements', []);
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const rechargeYuan = txs.filter((t) => t.kind === 'recharge').reduce((s, t) => s + t.amount, 0);
    const payout = txs.filter((t) => t.kind === 'reward').reduce((s, t) => s + t.coin, 0);
    const subscribeYuan = txs.filter((t) => t.kind === 'reward' && t.note.includes('订阅')).reduce((s, t) => s + t.coin, 0) / 100;
    const tipYuan = txs.filter((t) => t.kind === 'reward' && t.note.includes('打赏')).reduce((s, t) => s + t.coin, 0) / 100;
    const series = days.map((d) => ({
      label: todayLabel(d),
      users: users.filter((u) => sameDay(u.createdAt, d)).length,
      income: txs.filter((t) => t.kind === 'recharge' && sameDay(t.createdAt, d)).reduce((s, t) => s + t.amount * 0.3, 0),
      orders: txs.filter((t) => sameDay(t.createdAt, d) && (t.kind === 'recharge' || t.kind === 'subscribe' || t.kind === 'vip' || t.kind === 'tip')).length,
    }));
    return {
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
      withdrawPending: read<IWithdrawal[]>('withdrawals', []).filter((w) => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0),
      channelPending: read<IWithdrawChannel[]>('channels', []).filter((c) => c.status === 'pending').length,
      applicantPending: read<IApplicant[]>('applicants', []).filter((a) => a.status === 'pending').length,
      feedbackPending: read<IFeedback[]>('feedback', []).filter((f) => f.status === 'pending').length,
      supportUnread: read<IMessage[]>('messages', []).filter((m) => m.sender === 'user' && !m.read).length,
      flaggedCount: security.logs().filter((l) => l.status === 'flagged').length,
      featuredCount: books.filter((b) => b.featured).length,
      series,
    };
  },

  reviewsOf(): IReview[] {
    return read<IReview[]>('reviews', []).sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
  },

  /** 是否已解锁付费内容（VIP / 已购 / 免费）。章节类（novel/comic）按章节 id 粒度判断，互动/动漫按整本判断 */
  isUnlocked(userId: string | null, book: IBook, kind: 'chapter' | 'visual' | 'comic', target?: IChapter | IComicChapter): boolean {
    let targetId: string | undefined;
    if (kind === 'chapter') {
      const ch = target as IChapter;
      if (ch.price <= 0) return true;
      targetId = ch.id;
    } else if (kind === 'comic') {
      const ch = target as IComicChapter;
      if (ch.price <= 0) return true;
      targetId = ch.id;
    } else {
      if (book.chapterPrice <= 0) return true;
    }
    if (!userId) return false;
    const me = this.getUser(userId);
    if (me && isVip(me)) return true;
    const txs = read<ITx[]>('txs', []).filter((t) => t.userId === userId && t.kind === 'subscribe' && t.bookId === book.id && (!targetId || t.chapterId === targetId));
    return txs.length > 0;
  },
};

INIT_DATA();
