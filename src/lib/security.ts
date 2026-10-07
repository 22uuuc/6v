// EXPORTS: security（内容安全扫描 / 全库查杀 / 审计 / 简单混淆）
// 说明：前端演示层防护（真实安全必须由后端完成），负责发现并隔离 XSS/危险内容、记录审计与攻击日志。

import { store } from '@/lib/store';
import type { ISecurityLog, IAuditLog, IBook } from '@/lib/types';

/* ---------- 危险模式库（XSS / 脚本注入等常见攻击向量） ---------- */
const DANGER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /<\s*script[\s\S]*?<\s*\/\s*script\s*>/i, label: 'script 标签注入' },
  { re: /javascript\s*:/i, label: 'javascript: 协议' },
  { re: /<\s*(iframe|frame|object|embed)\b/i, label: 'iframe/object 嵌入' },
  { re: /\bon\w+\s*=\s*/i, label: '事件属性注入 (on*=)' },
  { re: /<\s*img[^>]*\bsrc\s*=\s*["']?x[^>]*onerror/i, label: 'img onerror 注入' },
  { re: /document\.(cookie|location|write)/i, label: '敏感 API 调用' },
  { re: /(?:eval|new\s+Function|setTimeout)\s*\(\s*["'`]/i, label: '动态执行代码' },
  { re: /localStorage|sessionStorage|indexedDB/i, label: '存储探测' },
  { re: /\.innerHTML\s*=|\.outerHTML\s*=/i, label: 'DOM 直写' },
  { re: /<svg[^>]*onload/i, label: 'svg onload 注入' },
  { re: /data:\s*text\/html/i, label: 'data: HTML 载荷' },
];

/** 扫描单段文本，返回命中的危险标签 */
export function scanText(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const p of DANGER_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
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
    const logs = this.logs();
    logs.unshift({
      ...log,
      id: `sl${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
      status: log.status ?? 'flagged',
      createdAt: new Date().toISOString(),
    });
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
  /** 记录一次暴力破解尝试 */
  recordAttack(message: string) {
    this.write({ kind: 'attack', level: 'danger', message, status: 'flagged' });
  },
};

/* ---------- 简单混淆（演示用，非真实加密） ---------- */

export function obfuscate(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    out += String.fromCharCode(s.charCodeAt(i) ^ (0x5a + i));
  }
  return btoa(unescape(encodeURIComponent(out)));
}

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

/** 简易哈希（校验用，非安全哈希） */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `${s.length}:${h.toString(36)}`;
}
