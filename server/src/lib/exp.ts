import { prisma } from '../db.js';
import { audit } from './audit.js';

// 与前端 types.ts LEVELS 完全一致
export const LEVELS = [
  { level: 1, name: '见习书虫', need: 0 },
  { level: 2, name: '青藤读者', need: 200 },
  { level: 3, name: '灯火书客', need: 500 },
  { level: 4, name: '夜航执笔', need: 1000 },
  { level: 5, name: '墨海舵手', need: 2000 },
  { level: 6, name: '传奇书灵', need: 4000 },
] as const;

/** 加经验并按阈值升级；升级写审计 */
export async function addExp(userId: string, n: number, reason: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  const before = u.level;
  const exp = u.exp + n;
  let lv = u.level;
  for (const L of LEVELS) if (exp >= L.need) lv = L.level;
  await prisma.user.update({ where: { id: userId }, data: { exp, level: lv } });
  if (lv > before) {
    const L = LEVELS.find((x) => x.level === lv);
    await audit(userId, u.nickname, '等级提升', `Lv${before}→Lv${lv}`, `${L?.name ?? ''}（${reason}）`);
  }
}
