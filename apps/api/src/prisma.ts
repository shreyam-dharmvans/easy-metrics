import { PrismaClient } from '@prisma/client';

// We declare a type on globalThis to hold our PrismaClient instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma Client:
 * During local development with hot-reloading (tsx / nodemon), re-creating
 * PrismaClient on every file change will exhaust PostgreSQL connection pools.
 * Attaching it to `globalThis` ensures we reuse the exact same connection pool.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

