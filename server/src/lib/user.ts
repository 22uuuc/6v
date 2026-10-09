import type { User } from '@prisma/client';
import { parseJson } from './json.js';

// IUser 下发前端时的脱敏：剥 bcrypt 哈希，补占位（前端 IUser.password: string）
export interface PublicUser {
  id: string;
  username: string;
  password: string;
  nickname: string;
  role: string;
  vip: boolean;
  vipUntil?: string;
  banned: boolean;
  coins: number;
  withdrawable: number;
  level: number;
  exp: number;
  bio?: string;
  privacy?: unknown;
  verified?: unknown;
  authLevel: number;
  prefs?: unknown;
  createdAt: string;
}

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    password: '', // 哈希不下发
    nickname: u.nickname,
    role: u.role,
    vip: u.vip,
    vipUntil: u.vipUntil || undefined,
    banned: u.banned,
    coins: u.coins,
    withdrawable: u.withdrawable,
    level: u.level,
    exp: u.exp,
    bio: u.bio || undefined,
    privacy: parseJson<unknown>(u.privacy, undefined),
    verified: parseJson<unknown>(u.verified, undefined),
    authLevel: u.authLevel,
    prefs: parseJson<unknown>(u.prefs, undefined),
    createdAt: u.createdAt.toISOString(),
  };
}

export function deviceOf(ua: string | undefined): string {
  return (ua || '未知设备').slice(0, 80);
}
