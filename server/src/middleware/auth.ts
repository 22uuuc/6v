import type { NextFunction, Request, Response } from 'express';
import { fail } from '../lib/http.js';
import { verifyAccess } from '../lib/jwt.js';

/** 必须登录；通过后 req.auth = { userId, role } */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyAccess(token) : null;
  if (!payload) {
    fail(res, 401, '登录已过期，请重新登录');
    return;
  }
  req.auth = { userId: payload.sub, role: payload.role };
  next();
}

/** 必须管理员 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'admin') {
      fail(res, 403, '需要管理员权限');
      return;
    }
    next();
  });
}

/** 创作者或管理员 */
export function requireCreator(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.auth?.role !== 'creator' && req.auth?.role !== 'admin') {
      fail(res, 403, '需要创作者权限');
      return;
    }
    next();
  });
}
