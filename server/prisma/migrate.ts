// 全量数据迁移：读取前端 src/data/seed.ts 的 buildSeed()（唯一数据源，不复制），
// 口令全部 bcrypt 重哈希后写入 SQLite。可重复执行（先清内容表再写入）。
// 运行：node node_modules/tsx/dist/cli.mjs prisma/migrate.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildSeed } from '../../src/data/seed';

const prisma = new PrismaClient();

const date = (s?: string): Date => (s ? new Date(s) : new Date());
const j = (v: unknown): string => JSON.stringify(v ?? null);

async function main() {
  const seed = buildSeed();

  // 1. 清空内容与交易表（用户 upsert 保留）
  await prisma.$transaction([
    prisma.chapter.deleteMany(),
    prisma.book.deleteMany(),
    prisma.visualScript.deleteMany(),
    prisma.comicPage.deleteMany(),
    prisma.comicChapter.deleteMany(),
    prisma.tx.deleteMany(),
    prisma.review.deleteMany(),
    prisma.withdrawChannel.deleteMany(),
    prisma.unlock.deleteMany(),
    prisma.shelfEntry.deleteMany(),
    prisma.progress.deleteMany(),
    prisma.comment.deleteMany(),
  ]);

  // 2. 用户（口令 bcrypt 重哈希）
  for (const u of seed.users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        nickname: u.nickname,
        role: u.role,
        vip: u.vip,
        vipUntil: u.vipUntil || null,
        banned: u.banned,
        coins: u.coins,
        withdrawable: u.withdrawable,
        level: u.level,
        exp: u.exp,
        bio: u.bio || null,
        createdAt: date(u.createdAt),
      },
      create: {
        id: u.id,
        username: u.username,
        password: await bcrypt.hash(u.password, 10),
        nickname: u.nickname,
        role: u.role,
        vip: u.vip,
        vipUntil: u.vipUntil || null,
        banned: u.banned,
        coins: u.coins,
        withdrawable: u.withdrawable,
        level: u.level,
        exp: u.exp,
        bio: u.bio || null,
        privacy: j({ hideBalance: false, hideRecent: false, hideShelf: false, hideRecords: false, stealth: false }),
        verified: j({}),
        createdAt: date(u.createdAt),
      },
    });
  }

  // 3. 内容
  await prisma.book.createMany({
    data: seed.books.map((b) => ({
      id: b.id, type: b.type, title: b.title, authorId: b.authorId, authorName: b.authorName,
      genre: b.genre, status: b.status, coverSeed: b.coverSeed, coverStyle: b.coverStyle || null,
      coverType: b.coverType || null, coverFont: b.coverFont || null, description: b.description,
      tags: j(b.tags), serial: b.serial, words: b.words, views: b.views, likes: b.likes,
      rating: b.rating, createdAt: date(b.createdAt), chapterPrice: b.chapterPrice,
      chapterIds: j(b.chapterIds), featured: !!b.featured, animeKey: b.animeKey || null,
      gameKind: b.gameKind || null, quarantined: !!b.quarantined,
    })),
  });
  await prisma.chapter.createMany({
    data: seed.chapters.map((c) => ({
      id: c.id, bookId: c.bookId, index: c.index, title: c.title, content: c.content, price: c.price,
    })),
  });
  for (const v of seed.visualScripts) {
    await prisma.visualScript.upsert({
      where: { bookId: v.bookId },
      update: { startNode: v.startNode, nodes: j(v.nodes) },
      create: { bookId: v.bookId, startNode: v.startNode, nodes: j(v.nodes) },
    });
  }
  if (seed.comicChapters.length) {
    await prisma.comicChapter.createMany({
      data: seed.comicChapters.map((c) => ({
        id: c.id, bookId: c.bookId, index: c.index, title: c.title,
        pageIds: j(c.pageIds), price: c.price,
      })),
    });
  }
  if (seed.comicPages.length) {
    await prisma.comicPage.createMany({
      data: seed.comicPages.map((p) => ({
        id: p.id, bookId: p.bookId, chapterId: p.chapterId, index: p.index,
        scene: p.scene, imageKey: p.imageKey || null, caption: p.caption || null, dialogue: j(p.dialogue),
      })),
    });
  }

  // 4. 交易/审核/渠道
  if (seed.txs.length) {
    await prisma.tx.createMany({
      data: seed.txs.map((t) => ({
        id: t.id, userId: t.userId, kind: t.kind, amount: t.amount, coin: t.coin,
        note: t.note, createdAt: date(t.createdAt), bookId: t.bookId || null,
        chapterId: t.chapterId || null, method: t.method || null, payNo: t.payNo || null,
      })),
    });
  }
  if (seed.reviews.length) {
    await prisma.review.createMany({
      data: seed.reviews.map((r) => ({
        id: r.id, bookId: r.bookId, action: r.action, note: r.note || null, createdAt: date(r.createdAt),
      })),
    });
  }
  if (seed.channels.length) {
    await prisma.withdrawChannel.createMany({
      data: seed.channels.map((c) => ({
        id: c.id, userId: c.userId, type: c.type, account: c.account, accountName: c.accountName,
        bankName: c.bankName || null, status: c.status, note: c.note || null, createdAt: date(c.createdAt),
      })),
    });
  }

  // 5. 系统设置单行
  const adminCode = await bcrypt.hash('admin123', 10);
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: { subShare: 0.7, tipShare: 1 },
    create: {
      id: 'main',
      siteName: '墨影书城',
      announcement: '全新动漫频道上线，六大题材一站追更！',
      vipPrice: 500, rechargeRate: 100, subShare: 0.7, tipShare: 1,
      openRegister: true,
      rechargeMethods: j(['alipay', 'wechat', 'bank', 'cloud']),
      adminCode, adminLockedUntil: 0, adminFailCount: 0,
    },
  });

  const [users, books, chapters, comics, txs] = await Promise.all([
    prisma.user.count(), prisma.book.count(), prisma.chapter.count(),
    prisma.comicChapter.count(), prisma.tx.count(),
  ]);
  console.log(`[migrate] ok: users=${users} books=${books} chapters=${chapters} comicChapters=${comics} txs=${txs}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
