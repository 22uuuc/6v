import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'moying-dev-secret';
const ACCESS_TTL = '30m';
const REFRESH_TTL_MS = 7 * 24 * 3600 * 1000;

export interface AuthPayload {
  sub: string;
  role: string;
}

export function signAccess(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccess(token: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, SECRET) as AuthPayload;
    return payload && payload.sub ? payload : null;
  } catch {
    return null;
  }
}

// 刷新令牌：随机 96 位 hex，仅存 sha256 哈希（库泄露不可逆推）
export function newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('hex');
  return {
    token,
    hash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  };
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
