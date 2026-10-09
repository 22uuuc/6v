import { PrismaClient } from '@prisma/client';

// Prisma 单例（dev 热重载不重复建连接）
export const prisma = new PrismaClient();
