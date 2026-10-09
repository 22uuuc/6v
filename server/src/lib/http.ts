import type { NextFunction, Request, RequestHandler, Response } from 'express';

// 统一响应：成功 { ok:true, ...payload }；失败 { ok:false, error }
export function ok(res: Response, payload: Record<string, unknown> = {}): void {
  res.json({ ok: true, ...payload });
}

export function fail(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error });
}

// async 路由异常统一进错误中间件
export function wrap(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

// ── 频控：滑动窗口内存表（单实例演示够用；多实例换 Redis） ──────
const buckets = new Map<string, number[]>();

/** true = 放行；false = 超限 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

export function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

// 字段校验小工具：全部命中才返回裁剪后的字符串，否则 null
export function str(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

export function intVal(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return null;
  return n;
}
