import crypto from 'node:crypto';
import { prisma } from '../db.js';

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

/** 审计日志：管理员关键操作 / 风控事件留痕 */
export async function audit(userId: string, userName: string, action: string, target?: string, detail?: string): Promise<void> {
  await prisma.auditLog.create({
    data: { id: uid('al'), userId, userName, action, target: target || null, detail: detail || null },
  });
}

/** 安全日志 */
export async function securityLog(entry: {
  kind: 'xss' | 'suspicious' | 'tamper' | 'attack';
  level: 'warn' | 'danger';
  targetType?: string;
  targetId?: string;
  field?: string;
  snippet?: string;
  message: string;
  status?: 'flagged' | 'cleaned' | 'ignored' | 'resolved';
}): Promise<void> {
  await prisma.securityLog.create({
    data: {
      id: uid('sl'),
      kind: entry.kind,
      level: entry.level,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      field: entry.field || null,
      snippet: entry.snippet || null,
      message: entry.message,
      status: entry.status || 'flagged',
    },
  });
}
