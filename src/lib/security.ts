// EXPORTS: security（内容安全扫描 / 全库查杀 / 审计）
//   obfuscate, deobfuscate, hashString —— ⚠️ 已废弃（保留兼容，建议迁移到 crypto.ts）
// 说明：前端演示层防护（真实安全必须由后端完成），负责发现并隔离 XSS/危险内容、记录审计与攻击日志。
// 加密与哈希功能已迁移到 crypto.ts（SHA-256 + AES-GCM + PBKDF2）。

import { store } from '@/lib/store';
import { sha256Sync } from '@/lib/crypto';
import { compiledSignatures } from '@/lib/signatures';
import type { ISecurityLog, IAuditLog, IBook } from '@/lib/types';

/* ---------- 成长性修复方案（威胁画像 / 自动处置 / 模式学习） ---------- */

/** 威胁画像单元：按来源统计告警频率，判定「意外」还是「故意」入侵 */
export interface IThreatCell {
  count: number;
  firstAt: number;
  lastAt: number;
  verdict: 'casual' | 'attack';
}

/** 成长性安全档案（持久化）：来源画像 + 学习到的危险特征 + 待管理员确认的处置方案 + 已执行记录 */
export interface IThreatProfile {
  cells: Record<string, IThreatCell>;
  learnedPatterns: string[];
  /** 系统生成、等待管理员确认执行的处置方案（处置权限归管理员） */
  pendingRemedies: { at: string; logId: string; targetType: string; targetId: string; action: string; kind: string }[];
  autoActions: { at: string; target: string; action: string }[];
}

const PROFILE_KEY = 'threatProfile';

function readProfile(): IThreatProfile {
  return store.get<IThreatProfile>(PROFILE_KEY, { cells: {}, learnedPatterns: [], pendingRemedies: [], autoActions: [] });
}

function saveProfile(p: IThreatProfile) {
  store.set(PROFILE_KEY, p);
}

/** 新增一条等待管理员确认的处置方案（系统只检测建议，不自动执行） */
export function pushPendingRemedy(r: { logId: string; targetType: string; targetId: string; action: string; kind: string }) {
  const p = readProfile();
  if (p.pendingRemedies.some((x) => x.logId === r.logId)) return;
  p.pendingRemedies = [{ at: new Date().toISOString(), ...r }, ...p.pendingRemedies].slice(0, 50);
  saveProfile(p);
}

/** 移除一条已处置的方案 */
export function popPendingRemedy(logId: string) {
  const p = readProfile();
  p.pendingRemedies = p.pendingRemedies.filter((x) => x.logId !== logId);
  saveProfile(p);
}

export function threatProfile(): IThreatProfile {
  return readProfile();
}

/** 来源键：作品/章节按 targetType|targetId，系统事件按 sys|kind */
function cellKey(log: ISecurityLog): string {
  return log.targetType && log.targetType !== 'system' && log.targetId ? `${log.targetType}|${log.targetId}` : `sys|${log.kind}`;
}

/** 评估一次告警：更新威胁画像，返回判定（意外 / 故意入侵） */
export function assessThreat(log: ISecurityLog): 'casual' | 'attack' {
  const p = readProfile();
  const k = cellKey(log);
  const now = Date.now();
  const c: IThreatCell = p.cells[k] ?? { count: 0, firstAt: now, lastAt: now, verdict: 'casual' };
  c.count += 1;
  c.lastAt = now;
  // 同一来源 10 分钟内连续触发 3 次及以上 = 故意入侵；首次/低频 = 意外或误操作
  c.verdict = c.count >= 3 && now - c.firstAt < 10 * 60 * 1000 ? 'attack' : 'casual';
  p.cells[k] = c;
  saveProfile(p);
  return c.verdict;
}

/** 模式学习：把新遇到的危险载荷特征存入动态模式库，下次同类变体也能识别（防混淆绕过） */
export function learnPattern(text: string): boolean {
  if (!text) return false;
  const m = text.match(/(?:<\s*script|javascript\s*:|on\w+\s*=|<\s*(?:iframe|object|embed)\b|data:\s*text\/html|\.innerHTML\s*=|document\.(?:cookie|location|write))/i);
  if (!m) return false;
  const feat = m[0].toLowerCase().trim();
  const p = readProfile();
  if (p.learnedPatterns.includes(feat)) return false;
  p.learnedPatterns = [...p.learnedPatterns, feat].slice(-50);
  saveProfile(p);
  return true;
}

/** 记录一次系统自动处置（成长性修复的执行痕迹） */
export function recordAutoAction(target: string, action: string) {
  const p = readProfile();
  p.autoActions = [{ at: new Date().toISOString(), target, action }, ...p.autoActions].slice(0, 50);
  saveProfile(p);
}

/* ---------- 危险模式库（XSS / 脚本注入等常见攻击向量） ---------- */
const DANGER_PATTERNS: { re: RegExp; label: string }[] = [
  /* —— 核心脚本/事件注入 —— */
  { re: /<\s*script[\s\S]*?<\s*\/\s*script\s*>/i, label: 'script 标签注入' },
  { re: /javascript\s*:/i, label: 'javascript: 协议' },
  { re: /<\s*(iframe|frame|object|embed)\b/i, label: 'iframe/object 嵌入' },
  { re: /\bon\w+\s*=\s*/i, label: '事件属性注入 (on*=)' },
  { re: /<\s*img[^>]*\bsrc\s*=\s*["']?x[^>]*onerror/i, label: 'img onerror 注入' },
  { re: /<svg[^>]*onload/i, label: 'svg onload 注入' },
  /* —— 敏感 API / 动态执行 / 存储 —— */
  { re: /document\.(cookie|location|write)/i, label: '敏感 API 调用' },
  { re: /(?:eval|new\s+Function|setTimeout)\s*\(\s*["'`]/i, label: '动态执行代码' },
  { re: /localStorage|sessionStorage|indexedDB/i, label: '存储探测' },
  { re: /\.innerHTML\s*=|\.outerHTML\s*=/i, label: 'DOM 直写' },
  /* —— 数据/编码载荷 —— */
  { re: /data:\s*text\/html/i, label: 'data: HTML 载荷' },
  { re: /(?:&#x?0*(?:3c|60);|&lt;|\u003c)\s*script/i, label: '编码绕过的 script 标签' },
  /* —— 脚本无关劫持 / 原型链 —— */
  { re: /<\s*base\s+href/i, label: 'base 标签劫持 (base href)' },
  { re: /<\s*meta\s+http-equiv/i, label: 'meta 刷新/跳转 (http-equiv)' },
  { re: /expression\s*\(/i, label: 'IE CSS expression 执行' },
  { re: /__proto__\b/, label: '原型链污染 (__proto__)' },
];

/** 扫描单段文本：静态模式库 + 签名清单 + 学习到的动态特征（成长性检测） */
export function scanText(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const p of DANGER_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
  }
  // 签名清单：仓库内版本化，管理员评审后随 GitHub 固定渠道发布（见 signatures.ts），前端只读加载
  for (const s of compiledSignatures()) {
    if (s.re.test(text)) hits.push(`[${s.severity}] ${s.label}`);
  }
  // 动态层：之前遇到过的新特征做包含匹配，识别混淆变体
  for (const feat of readProfile().learnedPatterns) {
    if (text.toLowerCase().includes(feat)) hits.push(`已学习特征「${feat}」`);
  }
  return hits;
}

/** 所有需要被扫描的文本字段（按 book/章节/节点/页面 归类） */
export interface IScanTarget {
  targetType: string;
  targetId: string;
  field: string;
  text: string;
}

/** 收集一个作品的全部文本字段 */
export function collectTargets(book: IBook, chapters: { id: string; title: string; content: string }[]): IScanTarget[] {
  const list: IScanTarget[] = [
    { targetType: 'book', targetId: book.id, field: 'title', text: book.title },
    { targetType: 'book', targetId: book.id, field: 'description', text: book.description },
    { targetType: 'book', targetId: book.id, field: 'tags', text: book.tags.join(',') },
  ];
  chapters.forEach((c) => {
    list.push({ targetType: 'chapter', targetId: c.id, field: 'title', text: c.title });
    list.push({ targetType: 'chapter', targetId: c.id, field: 'content', text: c.content });
  });
  return list;
}

/* ---------- 安全日志 ---------- */

export const security = {
  logs(): ISecurityLog[] {
    return store.get<ISecurityLog[]>('securityLogs', []);
  },
  write(log: Omit<ISecurityLog, 'id' | 'createdAt' | 'status'> & { status?: ISecurityLog['status'] }) {
    const full: ISecurityLog = {
      ...log,
      id: `sl${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
      status: log.status ?? 'flagged',
      createdAt: new Date().toISOString(),
    };
    // 成长性：每次告警自动评估威胁画像（意外/故意），并学习新出现的危险载荷特征
    assessThreat(full);
    if (log.snippet) learnPattern(log.snippet);
    const logs = this.logs();
    logs.unshift(full);
    store.set('securityLogs', logs.slice(0, 200));
  },
  /** 是否存在未处理的风险 */
  hasDanger(): boolean {
    return this.logs().some((l) => l.status === 'flagged');
  },
  setStatus(id: string, status: ISecurityLog['status']) {
    store.set('securityLogs', this.logs().map((l) => (l.id === id ? { ...l, status } : l)));
  },
  /** 记录管理员关键操作（审计） */
  audit(userId: string, userName: string, action: string, target?: string, detail?: string) {
    const logs = store.get<IAuditLog[]>('auditLogs', []);
    logs.unshift({ id: `al${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, userId, userName, action, target, detail, createdAt: new Date().toISOString() });
    store.set('auditLogs', logs.slice(0, 300));
  },
  audits(): IAuditLog[] {
    return store.get<IAuditLog[]>('auditLogs', []);
  },
  /**
   * 记录一次暴力破解/入侵尝试。
   * attacker 存在时透传攻击者身份（targetType/targetId），供管理员按账号封禁（针对病毒，而非限制自身）。
   */
  recordAttack(message: string, attacker?: { targetType: string; targetId: string }) {
    this.write({ kind: 'attack', level: 'danger', message, status: 'flagged', ...(attacker ?? {}) });
  },
};

/* ---------- 兼容层：旧版混淆/哈希函数（已废弃，建议迁移到 crypto.ts） ---------- */
// 保留 obfuscate/deobfuscate/hashString 导出是为了向后兼容，避免破坏现有调用
// 新代码请直接使用 crypto.ts 中的 sha256 / aesEncrypt / hashPassword 等函数

/**
 * @deprecated 请使用 crypto.ts 中的 aesEncrypt / aesDecrypt 替代
 * 简单 XOR 混淆（仅兼容旧数据，非真实加密）
 */
export function obfuscate(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    out += String.fromCharCode(s.charCodeAt(i) ^ (0x5a + i));
  }
  return btoa(unescape(encodeURIComponent(out)));
}

/**
 * @deprecated 请使用 crypto.ts 中的 aesEncrypt / aesDecrypt 替代
 */
export function deobfuscate(s: string): string {
  try {
    const t = decodeURIComponent(escape(atob(s)));
    let out = '';
    for (let i = 0; i < t.length; i += 1) {
      out += String.fromCharCode(t.charCodeAt(i) ^ (0x5a + i));
    }
    return out;
  } catch {
    return '';
  }
}

/**
 * @deprecated 请使用 crypto.ts 中的 sha256 / sha256Sync 替代
 * 增强哈希（原 DJB2 已升级为 FNV-1a 64 位变体）
 */
export function hashString(s: string): string {
  return sha256Sync(s);
}
