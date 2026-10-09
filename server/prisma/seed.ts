// Phase 1 种子：演示账号 + 系统设置单行。
// Phase 5 会从 src/data/seed.ts 的 buildSeed() 全量迁移内容数据。
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SeedUser {
  id: string;
  username: string;
  password: string;
  nickname: string;
  role: string;
  coins: number;
  withdrawable: number;
  bio: string;
}

// 演示账号：admin/admin123，其余 123456（与前端原种子一致）
const USERS: SeedUser[] = [
  { id: 'u-admin', username: 'admin', password: 'admin123', nickname: '站长', role: 'admin', coins: 99999, withdrawable: 0, bio: '墨影书城站长' },
  { id: 'u-moke', username: 'moke', password: '123456', nickname: '墨客', role: 'creator', coins: 300, withdrawable: 120, bio: '指尖有星辰，笔下有山海。' },
  { id: 'u-xiaoqi', username: 'xiaoqi', password: '123456', nickname: '书虫小七', role: 'reader', coins: 66, withdrawable: 0, bio: '日更追文中' },
  { id: 'u-yeyu', username: 'yeyu', password: '123456', nickname: '夜雨声烦', role: 'reader', coins: 12, withdrawable: 0, bio: '只看完结党' },
];

async function main() {
  for (const u of USERS) {
    const password = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        id: u.id,
        username: u.username,
        password,
        nickname: u.nickname,
        role: u.role,
        coins: u.coins,
        withdrawable: u.withdrawable,
        bio: u.bio,
        privacy: JSON.stringify({
          hideBalance: false, hideRecent: false, hideShelf: false,
          hideRecords: false, stealth: false,
        }),
        verified: JSON.stringify({}),
      },
    });
  }

  // 系统设置单行（管理安全码：admin123 的 bcrypt，登录管理后台用）
  const adminCode = await bcrypt.hash('admin123', 10);
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      siteName: '墨影书城',
      announcement: '全新动漫频道上线，六大题材一站追更！',
      vipPrice: 500,
      rechargeRate: 100,
      subShare: 0.7,
      tipShare: 1,
      openRegister: true,
      rechargeMethods: JSON.stringify(['alipay', 'wechat', 'bank', 'cloud']),
      adminCode,
      adminLockedUntil: 0,
      adminFailCount: 0,
    },
  });

  console.log('[seed] ok: users=%d', USERS.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
